use crate::bridge_client::BridgeClient;
use crate::tools;
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};

const PROTOCOL_VERSION: &str = "2024-11-05";
const SERVER_NAME: &str = "weekend-browser";
const SERVER_VERSION: &str = "0.2.0";

pub fn run_stdio_server() -> Result<(), String> {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut stdout_lock = stdout.lock();
    let mut client: Option<BridgeClient> = None;

    for line in stdin.lock().lines() {
        let line = line.map_err(|e| format!("failed to read stdin: {e}"))?;
        if line.trim().is_empty() {
            continue;
        }

        let message: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                let error_resp = json!({
                    "jsonrpc": "2.0",
                    "id": null,
                    "error": {
                        "code": -32700,
                        "message": format!("parse error: {e}")
                    }
                });
                write_response(&mut stdout_lock, &error_resp)?;
                continue;
            }
        };

        let id = message.get("id").cloned();
        let method = message.get("method").and_then(|v| v.as_str()).unwrap_or("");

        // Notifications (no id) — ignore
        if id.is_none() {
            // notifications/initialized etc
            continue;
        }

        let response = match method {
            "initialize" => handle_initialize(&id),
            "tools/list" => handle_tools_list(&id),
            "tools/call" => {
                // Lazily connect to bridge on first tool call
                if client.is_none() {
                    match BridgeClient::connect() {
                        Ok(c) => client = Some(c),
                        Err(e) => {
                            let resp = json!({
                                "jsonrpc": "2.0",
                                "id": id,
                                "error": {
                                    "code": -32603,
                                    "message": format!("failed to connect to weekend bridge: {e}")
                                }
                            });
                            write_response(&mut stdout_lock, &resp)?;
                            continue;
                        }
                    }
                }
                handle_tools_call(&id, &message, client.as_mut().unwrap())
            }
            _ => {
                json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": {
                        "code": -32601,
                        "message": format!("method not found: {method}")
                    }
                })
            }
        };

        write_response(&mut stdout_lock, &response)?;
    }

    Ok(())
}

fn write_response(writer: &mut impl Write, response: &Value) -> Result<(), String> {
    let mut json = serde_json::to_string(response)
        .map_err(|e| format!("failed to serialize response: {e}"))?;
    json.push('\n');
    writer
        .write_all(json.as_bytes())
        .map_err(|e| format!("failed to write to stdout: {e}"))?;
    writer
        .flush()
        .map_err(|e| format!("failed to flush stdout: {e}"))?;
    Ok(())
}

fn handle_initialize(id: &Option<Value>) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {
                "tools": {}
            },
            "serverInfo": {
                "name": SERVER_NAME,
                "version": SERVER_VERSION
            }
        }
    })
}

fn handle_tools_list(id: &Option<Value>) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": {
            "tools": tools::tool_definitions()
        }
    })
}

fn handle_tools_call(id: &Option<Value>, message: &Value, client: &mut BridgeClient) -> Value {
    let params = message.get("params").cloned().unwrap_or(json!({}));
    let tool_name = params.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let arguments = params.get("arguments").cloned().unwrap_or(json!({}));

    // Generate a unique call ID for the bridge request
    let call_id = id
        .as_ref()
        .map(|v| v.to_string())
        .unwrap_or_else(|| "0".to_string());

    // Normalize label and resolve defaults when omitted.
    let mut arguments = arguments;
    let normalized_label = arguments
        .get("label")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|label| !label.is_empty())
        .map(ToOwned::to_owned);

    if tool_name != "browser_list_webviews" {
        match normalized_label {
            Some(label) => {
                if let Some(obj) = arguments.as_object_mut() {
                    obj.insert("label".to_string(), Value::String(label));
                }
            }
            None => match resolve_default_label(&call_id, client) {
                Ok(resolved) => {
                    if let Some(obj) = arguments.as_object_mut() {
                        obj.insert("label".to_string(), Value::String(resolved));
                    }
                }
                Err(msg) => {
                    return make_tool_result(id, true, &msg);
                }
            },
        }
    }

    // Build bridge request from tool call
    let bridge_request = match tools::tool_call_to_bridge_request(&call_id, tool_name, &arguments) {
        Ok(req) => req,
        Err(e) => return make_tool_result(id, true, &format!("error: {e}")),
    };

    // Send to bridge and get response
    match client.send_request(&bridge_request) {
        Ok(resp_str) => match serde_json::from_str::<Value>(&resp_str) {
            Ok(resp) => {
                let status = resp
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("error");
                if status == "ok" {
                    let data = resp.get("data").cloned().unwrap_or(Value::Null);
                    let text = match &data {
                        Value::String(s) => s.clone(),
                        _ => serde_json::to_string_pretty(&data).unwrap_or_default(),
                    };
                    make_tool_result(id, false, &text)
                } else {
                    let msg = resp
                        .get("message")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown error");
                    make_tool_result(id, true, msg)
                }
            }
            Err(e) => make_tool_result(id, true, &format!("failed to parse bridge response: {e}")),
        },
        Err(e) => make_tool_result(id, true, &format!("bridge communication error: {e}")),
    }
}

/// Resolve the default webview label for tool calls that don't specify one.
///
/// Strategy:
///   1. Read WEEKEND_PROJECT env var (set by terminal_open)
///   2. List all browser webviews from the bridge
///   3. Pick the one matching `browser-pane:{project}:*`
///   4. If no project match: use the single available webview, otherwise require explicit label
fn resolve_default_label(call_id: &str, client: &mut BridgeClient) -> Result<String, String> {
    let project = std::env::var("WEEKEND_PROJECT")
        .ok()
        .map(|proj| proj.trim().to_string())
        .filter(|proj| !proj.is_empty());

    let list_req = json!({
        "id": format!("{call_id}-list"),
        "request": { "type": "list_webviews" }
    });
    let list_req_str =
        serde_json::to_string(&list_req).map_err(|e| format!("serialize error: {e}"))?;

    let resp_str = client
        .send_request(&list_req_str)
        .map_err(|e| format!("failed to list webviews: {e}"))?;

    let resp: Value = serde_json::from_str(&resp_str)
        .map_err(|e| format!("failed to parse webview list: {e}"))?;

    if resp.get("status").and_then(|v| v.as_str()) != Some("ok") {
        let msg = resp
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown error");
        return Err(format!("bridge error: {msg}"));
    }

    let mut labels: Vec<String> = resp
        .get("data")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default();
    labels.sort_unstable();

    if labels.is_empty() {
        return Err(
            "No browser webviews are currently open. Open a project with a browser pane first."
                .to_string(),
        );
    }

    // If we know the project, prefer the webview for this project
    if let Some(ref proj) = project {
        let prefix = format!("browser-pane:{proj}:");
        if let Some(matched) = labels.iter().find(|label| label.starts_with(&prefix)) {
            return Ok(matched.clone());
        }
    }

    if labels.len() == 1 {
        return Ok(labels[0].clone());
    }

    Err(format!(
        "Multiple browser webviews are open and no project-specific match was found. Specify `label` explicitly. Available labels: {}",
        labels.join(", ")
    ))
}

fn make_tool_result(id: &Option<Value>, is_error: bool, text: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": {
            "content": [{
                "type": "text",
                "text": text
            }],
            "isError": is_error
        }
    })
}
