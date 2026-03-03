use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::path::PathBuf;

use serde_json::{json, Value};

pub struct BridgeClient {
    reader: BufReader<TcpStream>,
    writer: TcpStream,
}

struct BridgeConnectionInfo {
    port: u16,
    token: Option<String>,
}

impl BridgeClient {
    pub fn connect() -> Result<Self, String> {
        let connection = read_port_file()?;
        let addr = format!("127.0.0.1:{}", connection.port);
        let mut stream = TcpStream::connect(&addr)
            .map_err(|e| format!("failed to connect to bridge at {addr}: {e}"))?;
        if let Some(token) = connection.token.as_deref() {
            verify_bridge_identity(&mut stream, token)?;
        }
        let reader = BufReader::new(
            stream
                .try_clone()
                .map_err(|e| format!("failed to clone TCP stream: {e}"))?,
        );
        Ok(Self {
            reader,
            writer: stream,
        })
    }

    pub fn send_request(&mut self, request_json: &str) -> Result<String, String> {
        let mut line = request_json.to_string();
        if !line.ends_with('\n') {
            line.push('\n');
        }
        self.writer
            .write_all(line.as_bytes())
            .map_err(|e| format!("failed to write to bridge: {e}"))?;
        self.writer
            .flush()
            .map_err(|e| format!("failed to flush bridge: {e}"))?;

        let mut response = String::new();
        self.reader
            .read_line(&mut response)
            .map_err(|e| format!("failed to read from bridge: {e}"))?;

        Ok(response.trim_end().to_string())
    }
}

fn port_file_path() -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("WEEKEND_BRIDGE_PORT_FILE") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }
    let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
    Ok(PathBuf::from(home).join(".weekend").join("bridge.port"))
}

fn read_port_file() -> Result<BridgeConnectionInfo, String> {
    let path = port_file_path()?;
    let content = std::fs::read_to_string(&path).map_err(|e| {
        format!(
            "failed to read {}: {e}. Is weekend running?",
            path.display()
        )
    })?;
    let mut parsed = parse_port_file_contents(&content)?;
    if let Ok(token) = std::env::var("WEEKEND_BRIDGE_TOKEN") {
        let trimmed = token.trim();
        if !trimmed.is_empty() {
            parsed.token = Some(trimmed.to_string());
        }
    }
    Ok(parsed)
}

fn parse_port_file_contents(content: &str) -> Result<BridgeConnectionInfo, String> {
    let mut lines = content.lines();
    let port: u16 = lines
        .next()
        .ok_or_else(|| "bridge.port file is empty".to_string())?
        .trim()
        .parse()
        .map_err(|e| format!("invalid TCP port in bridge.port: {e}"))?;
    let token = lines
        .next()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned);
    Ok(BridgeConnectionInfo { port, token })
}

fn verify_bridge_identity(stream: &mut TcpStream, token: &str) -> Result<(), String> {
    let handshake_request = json!({
        "id": "bridge-handshake",
        "request": {
            "type": "hello",
            "token": token
        }
    });
    let mut line = serde_json::to_string(&handshake_request)
        .map_err(|e| format!("failed to serialize bridge handshake: {e}"))?;
    line.push('\n');
    stream
        .write_all(line.as_bytes())
        .map_err(|e| format!("failed to write bridge handshake: {e}"))?;
    stream
        .flush()
        .map_err(|e| format!("failed to flush bridge handshake: {e}"))?;

    let cloned = stream
        .try_clone()
        .map_err(|e| format!("failed to clone stream for bridge handshake: {e}"))?;
    let mut reader = BufReader::new(cloned);
    let mut response = String::new();
    reader
        .read_line(&mut response)
        .map_err(|e| format!("failed to read bridge handshake response: {e}"))?;
    if response.trim().is_empty() {
        return Err("empty bridge handshake response".to_string());
    }

    let parsed: Value = serde_json::from_str(response.trim_end())
        .map_err(|e| format!("invalid bridge handshake response: {e}"))?;
    if parsed.get("status").and_then(|v| v.as_str()) == Some("ok") {
        return Ok(());
    }

    let message = parsed
        .get("message")
        .and_then(|v| v.as_str())
        .unwrap_or("bridge handshake failed");
    Err(message.to_string())
}

#[cfg(test)]
mod tests {
    use super::parse_port_file_contents;

    #[test]
    fn parses_legacy_bridge_port_file() {
        let parsed = parse_port_file_contents("19430\n").expect("expected parsed bridge file");
        assert_eq!(parsed.port, 19430);
        assert!(parsed.token.is_none());
    }

    #[test]
    fn parses_bridge_port_file_with_token() {
        let parsed = parse_port_file_contents(
            "19430\na1b2c3-token\n/Users/example/.weekend/bridge.a1b2c3-token.port\n",
        )
        .expect("expected parsed bridge file");
        assert_eq!(parsed.port, 19430);
        assert_eq!(parsed.token.as_deref(), Some("a1b2c3-token"));
    }
}
