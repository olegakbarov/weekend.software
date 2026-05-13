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

fn stale_browser_webview_labels(labels: Vec<String>, active_label: Option<&str>) -> Vec<String> {
    labels
        .into_iter()
        .filter(|label| label.starts_with("browser-pane:") && active_label != Some(label.as_str()))
        .collect()
}

pub fn close_stale_browser_webviews<R: Runtime>(
    app: &AppHandle<R>,
    active_label: Option<&str>,
) -> Vec<String> {
    let bridge_state: &BridgeState = app.state::<BridgeState>().inner();
    let stale_labels = stale_browser_webview_labels(list_browser_webviews(app), active_label);

    for label in &stale_labels {
        if let Some(webview) = app.get_webview(label) {
            if let Err(error) = webview.hide() {
                log_backend(
                    "WARN",
                    format!("bridge: failed to hide stale browser webview {label}: {error}"),
                );
            }
            if let Err(error) = webview.close() {
                log_backend(
                    "WARN",
                    format!("bridge: failed to close stale browser webview {label}: {error}"),
                );
            }
        }

        if let Ok(mut labels) = bridge_state.browser_webview_labels.lock() {
            labels.remove(label);
        }
        bridge_state.remove_bridge_state(label);
    }

    stale_labels
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

    let wrapper = build_eval_wrapper(script, &request_id, &callback_token)?;

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
    request_id: &str,
    callback_token: &str,
) -> Result<String, String> {
    crate::js::eval_with_result(script, request_id, callback_token)
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

    let script = crate::js::navigate_webview(url)?;
    webview
        .eval(script)
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
    use super::{build_eval_wrapper, stale_browser_webview_labels};

    #[test]
    fn eval_wrapper_uses_camel_case_callback_fields() {
        let wrapper = build_eval_wrapper("return 1 + 1;", "req-1", "cb-1").expect("wrapper");
        assert!(wrapper.contains("requestId: __weekend_request_id"));
        assert!(wrapper.contains("callbackToken: __weekend_callback_token"));
        assert!(!wrapper.contains("request_id: __weekend_request_id"));
        assert!(!wrapper.contains("callback_token: __weekend_callback_token"));
    }

    #[test]
    fn stale_browser_webview_labels_keeps_only_active_browser_pane() {
        let stale = stale_browser_webview_labels(
            vec![
                "browser-pane:home:0".to_string(),
                "browser-pane:sports:3".to_string(),
                "browser-pane:sandbox:1".to_string(),
                "main".to_string(),
            ],
            Some("browser-pane:sports:3"),
        );

        assert_eq!(
            stale,
            vec![
                "browser-pane:home:0".to_string(),
                "browser-pane:sandbox:1".to_string(),
            ]
        );
    }
}
