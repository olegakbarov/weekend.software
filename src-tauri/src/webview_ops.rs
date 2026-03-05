use crate::bridge_types::{BridgeState, PendingEval};
use crate::log_backend;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, Runtime};
use tokio::sync::oneshot::{self, error::TryRecvError};
use uuid::Uuid;

const EVAL_TIMEOUT: Duration = Duration::from_secs(30);
const EVAL_POLL_INTERVAL: Duration = Duration::from_millis(25);
const BRIDGE_READY_TIMEOUT: Duration = Duration::from_secs(5);
const BRIDGE_READY_POLL_INTERVAL: Duration = Duration::from_millis(25);

type PendingEvalMap =
    std::sync::Arc<std::sync::Mutex<std::collections::HashMap<String, PendingEval>>>;

pub fn list_browser_webviews<R: Runtime>(app: &AppHandle<R>) -> Vec<String> {
    let bridge_state: &BridgeState = app.state::<BridgeState>().inner();
    let Ok(mut labels) = bridge_state.browser_webview_labels.lock() else {
        return Vec::new();
    };

    // Return labels that still have a live webview, prune stale ones
    let mut live = Vec::new();
    let mut stale = Vec::new();
    for label in labels.iter() {
        if app.get_webview(label).is_some() {
            live.push(label.clone());
        } else {
            stale.push(label.clone());
        }
    }
    for s in stale {
        labels.remove(&s);
        bridge_state.remove_bridge_state(&s);
    }

    live
}

pub fn wait_for_bridge_ready<R: Runtime>(
    app: &AppHandle<R>,
    label: &str,
    bridge_state: &BridgeState,
) -> Result<(), String> {
    let deadline = Instant::now() + BRIDGE_READY_TIMEOUT;
    loop {
        if app.get_webview(label).is_none() {
            return Err(format!("webview not found: {label}"));
        }
        if bridge_state.is_bridge_ready(label) {
            return Ok(());
        }
        if Instant::now() >= deadline {
            let details = bridge_state.bridge_state(label);
            let detail_text = if let Some(state) = details {
                format!(
                    "ready={} version={} url={} updated_at_ms={}",
                    state.ready,
                    state.version.unwrap_or_else(|| "unknown".to_string()),
                    state.url.unwrap_or_else(|| "unknown".to_string()),
                    state.updated_at_ms
                )
            } else {
                "no bridge state recorded".to_string()
            };
            return Err(format!(
                "timed out waiting for browser bridge readiness on {label}; {detail_text}"
            ));
        }
        std::thread::sleep(BRIDGE_READY_POLL_INTERVAL);
    }
}

pub fn eval_js_with_result<R: Runtime>(
    app: &AppHandle<R>,
    label: &str,
    script: &str,
    bridge_state: &BridgeState,
) -> Result<String, String> {
    let webview = app
        .get_webview(label)
        .ok_or_else(|| format!("webview not found: {label}"))?;

    let request_id = Uuid::new_v4().to_string();
    let callback_token = Uuid::new_v4().to_string();
    let (tx, mut rx) = oneshot::channel::<String>();

    {
        let mut pending = bridge_state
            .pending_evals
            .lock()
            .map_err(|_| "failed to lock pending evals".to_string())?;
        pending.insert(
            request_id.clone(),
            PendingEval {
                label: label.to_string(),
                callback_token: callback_token.clone(),
                sender: tx,
            },
        );
    }

    let request_id_literal = serde_json::to_string(&request_id)
        .map_err(|e| format!("failed to serialize request id: {e}"))?;
    let callback_token_literal = serde_json::to_string(&callback_token)
        .map_err(|e| format!("failed to serialize callback token: {e}"))?;

    let wrapper = build_eval_wrapper(script, &request_id_literal, &callback_token_literal);

    if let Err(error) = webview.eval(&wrapper) {
        cleanup_pending(&bridge_state.pending_evals, &request_id);
        log_backend(
            "WARN",
            format!("bridge: webview.eval failed label={label} request_id={request_id}: {error}"),
        );
        return Err(format!("webview.eval failed: {error}"));
    }

    let deadline = Instant::now() + EVAL_TIMEOUT;
    loop {
        match rx.try_recv() {
            Ok(data) => return Ok(data),
            Err(TryRecvError::Closed) => {
                cleanup_pending(&bridge_state.pending_evals, &request_id);
                log_backend(
                    "WARN",
                    format!(
                        "bridge: eval result sender dropped label={label} request_id={request_id}"
                    ),
                );
                return Err("eval result sender dropped".to_string());
            }
            Err(TryRecvError::Empty) => {}
        }

        if Instant::now() >= deadline {
            cleanup_pending(&bridge_state.pending_evals, &request_id);
            let detail_text = describe_bridge_state(label, bridge_state);
            log_backend(
                "WARN",
                format!(
                    "bridge: eval timed out label={label} request_id={request_id}; {detail_text}"
                ),
            );
            return Err(format!("eval timed out on {label}; {detail_text}"));
        }

        std::thread::sleep(EVAL_POLL_INTERVAL);
    }
}

fn describe_bridge_state(label: &str, bridge_state: &BridgeState) -> String {
    if let Some(state) = bridge_state.bridge_state(label) {
        format!(
            "ready={} version={} url={} updated_at_ms={}",
            state.ready,
            state.version.unwrap_or_else(|| "unknown".to_string()),
            state.url.unwrap_or_else(|| "unknown".to_string()),
            state.updated_at_ms
        )
    } else {
        "no bridge state recorded".to_string()
    }
}

fn build_eval_wrapper(
    script: &str,
    request_id_literal: &str,
    callback_token_literal: &str,
) -> String {
    format!(
        r#"(async function() {{
  const __weekend_request_id = {request_id_literal};
  const __weekend_callback_token = {callback_token_literal};
  const __weekend_sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const __weekend_has_low_level_ipc = () => {{
    const i = window.__TAURI_INTERNALS__;
    return Boolean(
      i &&
      typeof i.ipc === "function" &&
      typeof i.transformCallback === "function" &&
      typeof i.unregisterCallback === "function"
    );
  }};
  const __weekend_wait_for_ipc = async (timeoutMs = 2000) => {{
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {{
      if (
        window.__TAURI_INTERNALS__ &&
        (
          typeof window.__TAURI_INTERNALS__.invoke === "function" ||
          __weekend_has_low_level_ipc()
        )
      ) {{
        return;
      }}
      await __weekend_sleep(25);
    }}
    throw new Error("Tauri IPC bridge unavailable");
  }};
  const __weekend_invoke = async (cmd, payload) => {{
    const i = window.__TAURI_INTERNALS__;
    if (i && typeof i.invoke === "function") {{
      try {{
        return await i.invoke(cmd, payload);
      }} catch (__weekend_invoke_err) {{
        if (!__weekend_has_low_level_ipc()) {{
          throw __weekend_invoke_err;
        }}
      }}
    }}
    if (!__weekend_has_low_level_ipc()) {{
      throw new Error("Tauri low-level IPC unavailable");
    }}
    return await new Promise((resolve, reject) => {{
      const callback = i.transformCallback((response) => {{
        try {{ i.unregisterCallback(error); }} catch (_) {{}}
        resolve(response);
      }}, true);
      const error = i.transformCallback((invokeError) => {{
        try {{ i.unregisterCallback(callback); }} catch (_) {{}}
        reject(invokeError);
      }}, true);
      try {{
        i.ipc({{
          cmd,
          callback,
          error,
          payload
        }});
      }} catch (sendError) {{
        try {{
          i.unregisterCallback(callback);
          i.unregisterCallback(error);
        }} catch (_) {{}}
        reject(sendError);
      }}
    }});
  }};
  const __weekend_send = async (payload) => {{
    await __weekend_wait_for_ipc();
    await __weekend_invoke("browser_eval_result", {{
      requestId: __weekend_request_id,
      callbackToken: __weekend_callback_token,
      payload: JSON.stringify(payload),
    }});
  }};
  try {{
    let __weekend_result = await (async function() {{ {user_script} }})();
    if (__weekend_result === undefined) __weekend_result = null;
    await __weekend_send({{ ok: true, value: __weekend_result }});
}} catch (__weekend_err) {{
    try {{
      await __weekend_send({{ ok: false, error: String(__weekend_err) }});
    }} catch (__weekend_send_err) {{
      console.error("[Weekend Software] eval callback failed", __weekend_send_err);
    }}
  }}
}})()"#,
        user_script = script,
    )
}

fn cleanup_pending(pending_evals: &PendingEvalMap, request_id: &str) {
    if let Ok(mut map) = pending_evals.lock() {
        map.remove(request_id);
    }
}

pub fn navigate_webview<R: Runtime>(
    app: &AppHandle<R>,
    label: &str,
    url: &str,
) -> Result<(), String> {
    let webview = app
        .get_webview(label)
        .ok_or_else(|| format!("webview not found: {label}"))?;

    let url_literal =
        serde_json::to_string(url).map_err(|e| format!("failed to serialize URL: {e}"))?;
    webview
        .eval(&format!("window.location.href = {url_literal}"))
        .map_err(|e| format!("navigate failed: {e}"))
}

pub fn get_webview_url<R: Runtime>(app: &AppHandle<R>, label: &str) -> Result<String, String> {
    let webview = app
        .get_webview(label)
        .ok_or_else(|| format!("webview not found: {label}"))?;
    Ok(webview
        .url()
        .map_err(|e| format!("failed to get URL: {e}"))?
        .to_string())
}

#[cfg(test)]
mod tests {
    use super::build_eval_wrapper;

    #[test]
    fn eval_wrapper_uses_camel_case_callback_fields() {
        let wrapper = build_eval_wrapper("return 1 + 1;", "\"req-1\"", "\"cb-1\"");
        assert!(wrapper.contains("requestId: __weekend_request_id"));
        assert!(wrapper.contains("callbackToken: __weekend_callback_token"));
        assert!(!wrapper.contains("request_id: __weekend_request_id"));
        assert!(!wrapper.contains("callback_token: __weekend_callback_token"));
    }
}
