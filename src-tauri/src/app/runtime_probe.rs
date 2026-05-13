use super::*;

#[tauri::command]
pub(crate) fn find_available_port(
    preferred: u16,
    min: Option<u16>,
    max: Option<u16>,
) -> Result<u16, String> {
    let min_port = min.unwrap_or(43000).max(1);
    let max_port = max.unwrap_or(49999);
    if min_port > max_port {
        return Err("invalid port range".to_string());
    }

    let mut start = preferred;
    if start < min_port || start > max_port {
        start = min_port;
    }

    let span = u32::from(max_port - min_port) + 1;
    for offset in 0..span {
        let candidate = min_port + (((start - min_port) as u32 + offset) % span) as u16;
        if let Ok(listener) = TcpListener::bind(("127.0.0.1", candidate)) {
            drop(listener);
            return Ok(candidate);
        }
    }

    Err(format!(
        "no available loopback port found in range {min_port}-{max_port}"
    ))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeUrlProbeStatus {
    ok: bool,
    reachable: bool,
    status: Option<u16>,
}

fn build_runtime_probe_request(url: &Url) -> Result<(String, String), String> {
    let scheme = url.scheme();
    if scheme != "http" {
        return Err(format!(
            "runtime probing only supports http URLs (received '{scheme}')"
        ));
    }

    let host = url
        .host_str()
        .ok_or_else(|| "runtime.url must include a host".to_string())?;
    let port = url
        .port_or_known_default()
        .ok_or_else(|| "runtime.url must include a port".to_string())?;
    let connect_target = if host == "::1" {
        format!("[::1]:{port}")
    } else {
        format!("127.0.0.1:{port}")
    };
    let request_path = match url.query() {
        Some(query) => format!("{}?{query}", url.path()),
        None => url.path().to_string(),
    };
    let host_header = match (scheme, port) {
        ("http", 80) | ("https", 443) => host.to_string(),
        _ => format!("{host}:{port}"),
    };
    let request = format!(
        "GET {request_path} HTTP/1.1\r\nHost: {host_header}\r\nConnection: close\r\nAccept: text/html,*/*\r\nUser-Agent: weekend-runtime-probe\r\n\r\n"
    );
    Ok((connect_target, request))
}

fn parse_runtime_probe_status(response: &str) -> Option<u16> {
    let status_line = response.lines().next()?.trim();
    let mut parts = status_line.split_whitespace();
    let protocol = parts.next()?;
    if !protocol.starts_with("HTTP/") {
        return None;
    }
    parts.next()?.parse::<u16>().ok()
}

#[tauri::command]
pub(crate) async fn probe_runtime_url(url: String) -> Result<RuntimeUrlProbeStatus, String> {
    let parsed = Url::parse(url.trim())
        .map_err(|error| format!("runtime.url must be a valid URL: {error}"))?;
    let (connect_target, request) = match build_runtime_probe_request(&parsed) {
        Ok(value) => value,
        Err(_) => {
            return Ok(RuntimeUrlProbeStatus {
                ok: false,
                reachable: false,
                status: None,
            })
        }
    };

    let connect_result = tokio::time::timeout(
        Duration::from_millis(800),
        tokio::net::TcpStream::connect(connect_target),
    )
    .await;
    let mut stream = match connect_result {
        Ok(Ok(stream)) => stream,
        _ => {
            return Ok(RuntimeUrlProbeStatus {
                ok: false,
                reachable: false,
                status: None,
            })
        }
    };

    let write_result = tokio::time::timeout(
        Duration::from_millis(800),
        stream.write_all(request.as_bytes()),
    )
    .await;
    if !matches!(write_result, Ok(Ok(()))) {
        return Ok(RuntimeUrlProbeStatus {
            ok: false,
            reachable: false,
            status: None,
        });
    }

    let mut buffer = [0u8; 1024];
    let read_result =
        tokio::time::timeout(Duration::from_millis(800), stream.read(&mut buffer)).await;
    let bytes_read = match read_result {
        Ok(Ok(bytes)) if bytes > 0 => bytes,
        _ => {
            return Ok(RuntimeUrlProbeStatus {
                ok: false,
                reachable: false,
                status: None,
            })
        }
    };

    let response = String::from_utf8_lossy(&buffer[..bytes_read]);
    let status = parse_runtime_probe_status(&response);
    Ok(RuntimeUrlProbeStatus {
        ok: status
            .map(|value| (200..400).contains(&value))
            .unwrap_or(false),
        reachable: status.is_some(),
        status,
    })
}
