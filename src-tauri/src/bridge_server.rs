use crate::bridge_types::{
    BridgeRequest, BridgeRequestEnvelope, BridgeResponse, BridgeResult, BridgeState,
};
use crate::event_buffer::EventBufferState;
use crate::log_backend;
use crate::webview_ops;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use tauri::{AppHandle, Manager, Runtime};

pub fn start<R: Runtime + 'static>(app: AppHandle<R>) {
    // Bind TCP listener on OS-assigned port
    let tcp_listener = match TcpListener::bind("127.0.0.1:0") {
        Ok(listener) => listener,
        Err(error) => {
            log_backend(
                "ERROR",
                format!("bridge: failed to bind TCP listener: {error}"),
            );
            return;
        }
    };

    let tcp_port = match tcp_listener.local_addr() {
        Ok(addr) => addr.port(),
        Err(error) => {
            log_backend("ERROR", format!("bridge: failed to get TCP port: {error}"));
            return;
        }
    };

    let (connection_token, port_file_state) = {
        let bridge_state: tauri::State<'_, BridgeState> = app.state();
        (
            bridge_state.connection_token.clone(),
            bridge_state.port_file_path.clone(),
        )
    };
    if let Some(path) = write_port_file(tcp_port, &connection_token) {
        if let Ok(mut slot) = port_file_state.lock() {
            *slot = Some(path);
        }
    }
    log_backend("INFO", format!("bridge: started TCP={tcp_port}"));

    // Spawn TCP handler thread (handles MCP binary connections)
    let app_for_tcp = app.clone();
    std::thread::spawn(move || {
        run_tcp_server(tcp_listener, app_for_tcp);
    });
}

fn write_port_file(tcp_port: u16, connection_token: &str) -> Option<std::path::PathBuf> {
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => return None,
    };
    let dir = std::path::PathBuf::from(home).join(".weekend");
    let _ = std::fs::create_dir_all(&dir);
    let instance_path = dir.join(format!("bridge.{connection_token}.port"));
    let instance_content = format!("{tcp_port}\n{connection_token}\n");
    if let Err(error) = std::fs::write(&instance_path, &instance_content) {
        log_backend(
            "WARN",
            format!(
                "bridge: failed to write instance port file {}: {error}",
                instance_path.display()
            ),
        );
        return None;
    }

    // Legacy fallback for clients that do not honor WEEKEND_BRIDGE_PORT_FILE.
    let global_path = dir.join("bridge.port");
    let global_content = format!(
        "{tcp_port}\n{connection_token}\n{}\n",
        instance_path.display()
    );
    if let Err(error) = std::fs::write(&global_path, &global_content) {
        log_backend(
            "WARN",
            format!("bridge: failed to write port file: {error}"),
        );
    }

    Some(instance_path)
}

fn run_tcp_server<R: Runtime + 'static>(listener: TcpListener, app: AppHandle<R>) {
    for stream in listener.incoming() {
        let stream = match stream {
            Ok(s) => s,
            Err(error) => {
                log_backend("WARN", format!("bridge: TCP accept error: {error}"));
                continue;
            }
        };

        let app_clone = app.clone();
        std::thread::spawn(move || {
            handle_tcp_client(stream, app_clone);
        });
    }
}

fn handle_tcp_client<R: Runtime + 'static>(stream: TcpStream, app: AppHandle<R>) {
    let peer = stream
        .peer_addr()
        .map(|a| a.to_string())
        .unwrap_or_else(|_| "unknown".into());
    log_backend("INFO", format!("bridge: TCP client connected from {peer}"));

    let reader = BufReader::new(match stream.try_clone() {
        Ok(s) => s,
        Err(_) => return,
    });
    let mut writer = stream;

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };

        if line.trim().is_empty() {
            continue;
        }

        let envelope: BridgeRequestEnvelope = match serde_json::from_str(&line) {
            Ok(e) => e,
            Err(error) => {
                let resp = BridgeResponse {
                    id: "unknown".to_string(),
                    result: BridgeResult::Error {
                        message: format!("invalid request JSON: {error}"),
                    },
                };
                let _ = write_json_line(&mut writer, &resp);
                continue;
            }
        };

        let response = dispatch_request(&app, &envelope);
        if write_json_line(&mut writer, &response).is_err() {
            break;
        }
    }

    log_backend("INFO", format!("bridge: TCP client {peer} disconnected"));
}

fn dispatch_request<R: Runtime + 'static>(
    app: &AppHandle<R>,
    envelope: &BridgeRequestEnvelope,
) -> BridgeResponse {
    let result = match &envelope.request {
        BridgeRequest::Hello { token } => {
            let bridge_state: &BridgeState = app.state::<BridgeState>().inner();
            if token == &bridge_state.connection_token {
                BridgeResult::Ok {
                    data: serde_json::json!({"ready": true}),
                }
            } else {
                BridgeResult::Error {
                    message: "bridge token mismatch".to_string(),
                }
            }
        }
        BridgeRequest::ListWebviews => {
            let labels = webview_ops::list_browser_webviews(app);
            BridgeResult::Ok {
                data: serde_json::json!(labels),
            }
        }
        BridgeRequest::EvalJs { label, script } => {
            let bridge_state: &BridgeState = app.state::<BridgeState>().inner();
            if let Err(error) = webview_ops::wait_for_bridge_ready(app, label, bridge_state) {
                return BridgeResponse {
                    id: envelope.id.clone(),
                    result: BridgeResult::Error { message: error },
                };
            }
            match webview_ops::eval_js_with_result(app, label, script, bridge_state) {
                Ok(data) => {
                    // data is the raw JSON string from browser_eval_result callback
                    match serde_json::from_str::<serde_json::Value>(&data) {
                        Ok(parsed) => {
                            if parsed.get("ok").and_then(|v| v.as_bool()) == Some(true) {
                                BridgeResult::Ok {
                                    data: parsed
                                        .get("value")
                                        .cloned()
                                        .unwrap_or(serde_json::Value::Null),
                                }
                            } else {
                                let msg = parsed
                                    .get("error")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("unknown JS error")
                                    .to_string();
                                BridgeResult::Error { message: msg }
                            }
                        }
                        Err(_) => BridgeResult::Ok {
                            data: serde_json::Value::String(data),
                        },
                    }
                }
                Err(error) => BridgeResult::Error { message: error },
            }
        }
        BridgeRequest::Navigate { label, url } => {
            match webview_ops::navigate_webview(app, label, url) {
                Ok(()) => BridgeResult::Ok {
                    data: serde_json::json!(true),
                },
                Err(error) => BridgeResult::Error { message: error },
            }
        }
        BridgeRequest::GetUrl { label } => match webview_ops::get_webview_url(app, label) {
            Ok(url) => BridgeResult::Ok {
                data: serde_json::json!(url),
            },
            Err(error) => BridgeResult::Error { message: error },
        },
        BridgeRequest::DrainEvents { label, since_seq } => {
            let bridge_state: &BridgeState = app.state::<BridgeState>().inner();
            if let Err(error) = webview_ops::wait_for_bridge_ready(app, label, bridge_state) {
                return BridgeResponse {
                    id: envelope.id.clone(),
                    result: BridgeResult::Error { message: error },
                };
            }
            let ebs: &EventBufferState = app.state::<EventBufferState>().inner();
            let events = ebs.drain_events(label, *since_seq);
            BridgeResult::Ok {
                data: serde_json::json!(events),
            }
        }
        BridgeRequest::ConfigureObservers { label, config } => {
            let bridge_state: &BridgeState = app.state::<BridgeState>().inner();
            if let Err(error) = webview_ops::wait_for_bridge_ready(app, label, bridge_state) {
                return BridgeResponse {
                    id: envelope.id.clone(),
                    result: BridgeResult::Error { message: error },
                };
            }
            let ebs: &EventBufferState = app.state::<EventBufferState>().inner();
            ebs.set_observer_config(label, config.clone());

            // Eval configure() into the webview so observers activate immediately
            match serde_json::to_string(config) {
                Ok(config_json) => {
                    let script = format!(
                        "if (window.__WEEKEND_BRIDGE__) {{ window.__WEEKEND_BRIDGE__.configure({config_json}); }}"
                    );
                    let webview = app.get_webview(label);
                    match webview {
                        Some(wv) => {
                            if let Err(e) = wv.eval(&script) {
                                BridgeResult::Error {
                                    message: format!("failed to eval configure: {e}"),
                                }
                            } else {
                                BridgeResult::Ok {
                                    data: serde_json::json!(true),
                                }
                            }
                        }
                        None => BridgeResult::Error {
                            message: format!("webview not found: {label}"),
                        },
                    }
                }
                Err(e) => BridgeResult::Error {
                    message: format!("failed to serialize config: {e}"),
                },
            }
        }
    };

    BridgeResponse {
        id: envelope.id.clone(),
        result,
    }
}

fn write_json_line(writer: &mut impl Write, value: &impl serde::Serialize) -> Result<(), ()> {
    let mut json = match serde_json::to_string(value) {
        Ok(j) => j,
        Err(_) => return Err(()),
    };
    json.push('\n');
    writer.write_all(json.as_bytes()).map_err(|_| ())?;
    writer.flush().map_err(|_| ())
}
