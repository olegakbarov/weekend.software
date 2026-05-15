use super::*;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserWebviewPageLoadPayload {
    pub(crate) webview_label: String,
    pub(crate) window_label: String,
    pub(crate) url: String,
    pub(crate) phase: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserRuntimeProbeResult {
    ready: bool,
    status_code: Option<u16>,
    error: Option<String>,
}

pub(crate) fn project_name_from_browser_webview_label(label: &str) -> Option<&str> {
    let suffix = label.strip_prefix("browser-pane:")?;
    let (project_name, _) = suffix.rsplit_once(':')?;
    if project_name.is_empty() {
        None
    } else {
        Some(project_name)
    }
}

pub(crate) fn browser_runtime_status_is_ready(status_code: u16) -> bool {
    (200..400).contains(&status_code) || status_code == 401 || status_code == 403
}

fn probe_browser_runtime_url(url: &str) -> Result<BrowserRuntimeProbeResult, String> {
    let normalized_url =
        normalize_runtime_url(Some(url))?.ok_or_else(|| "runtime url is required".to_string())?;

    let output = std::process::Command::new("/usr/bin/curl")
        .args([
            "--insecure",
            "--location",
            "--silent",
            "--show-error",
            "--output",
            "/dev/null",
            "--write-out",
            "%{http_code}",
            "--connect-timeout",
            "1",
            "--max-time",
            "2",
            &normalized_url,
        ])
        .output()
        .map_err(|error| format!("failed probing runtime url: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let error = if stderr.is_empty() {
            format!("curl exited with status {}", output.status)
        } else {
            stderr
        };
        return Ok(BrowserRuntimeProbeResult {
            ready: false,
            status_code: None,
            error: Some(error),
        });
    }

    let status_text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let status_code = status_text.parse::<u16>().ok();

    Ok(BrowserRuntimeProbeResult {
        ready: status_code
            .map(browser_runtime_status_is_ready)
            .unwrap_or(false),
        status_code,
        error: None,
    })
}

#[tauri::command]
pub(crate) fn browser_history_navigate<R: Runtime>(
    app: AppHandle<R>,
    label: String,
    direction: String,
) -> Result<(), String> {
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview not found: {label}"))?;
    let script = match direction.as_str() {
        "back" => crate::js::history_back(),
        "forward" => crate::js::history_forward(),
        _ => return Err(format!("invalid direction: {direction}")),
    };
    webview
        .eval(script)
        .map_err(|e| format!("webview.eval failed: {e}"))
}

#[tauri::command]
pub(crate) fn browser_navigate<R: Runtime>(
    app: AppHandle<R>,
    label: String,
    url: String,
) -> Result<(), String> {
    if !label.starts_with("browser-pane:") {
        return Err(format!("invalid browser webview label: {label}"));
    }
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview not found: {label}"))?;
    let parsed = Url::parse(&url).map_err(|e| format!("invalid url '{url}': {e}"))?;
    webview
        .navigate(parsed)
        .map_err(|e| format!("webview.navigate failed: {e}"))
}

#[tauri::command]
pub(crate) fn browser_close_stale_webviews<R: Runtime>(
    app: AppHandle<R>,
    active_label: Option<String>,
) -> Result<Vec<String>, String> {
    if let Some(label) = active_label.as_deref() {
        if !label.starts_with("browser-pane:") {
            return Err(format!("invalid browser webview label: {label}"));
        }
    }

    Ok(webview_ops::close_stale_browser_webviews(
        &app,
        active_label.as_deref(),
    ))
}

#[tauri::command]
pub(crate) fn browser_probe_runtime_url(url: String) -> Result<BrowserRuntimeProbeResult, String> {
    probe_browser_runtime_url(&url)
}

#[tauri::command]
pub(crate) fn browser_push_event<R: Runtime>(
    webview: tauri::Webview<R>,
    app: AppHandle<R>,
    category: String,
    data: String,
    event_buffer: State<'_, EventBufferState>,
) -> Result<(), String> {
    let label = webview.label().to_string();
    if !label.starts_with("browser-pane:") {
        return Ok(()); // ignore events from non-browser webviews
    }
    let parsed: serde_json::Value =
        serde_json::from_str(&data).unwrap_or(serde_json::Value::String(data));
    event_buffer.push_event(&label, category.clone(), parsed.clone());
    if category == "route_change" {
        let url = parsed
            .get("url")
            .or_else(|| parsed.get("to"))
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .trim();
        if !url.is_empty() {
            let from = parsed
                .get("from")
                .and_then(|value| value.as_str())
                .map(str::to_string);
            let _ = app.emit(
                "browser-webview-route-change",
                serde_json::json!({
                    "webviewLabel": label.clone(),
                    "windowLabel": webview.window().label(),
                    "url": url,
                    "from": from,
                }),
            );
        }
    }
    if category == "element_grab" {
        let _ = app.emit(
            "browser-element-grabbed",
            serde_json::json!({
                "label": label,
                "data": parsed,
            }),
        );
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn browser_start_element_grab<R: Runtime>(
    label: String,
    app: AppHandle<R>,
) -> Result<(), String> {
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview not found: {label}"))?;
    webview
        .eval(crate::js::configure_element_grab(true))
        .map_err(|e| format!("eval failed: {e}"))
}

#[tauri::command]
pub(crate) fn browser_stop_element_grab<R: Runtime>(
    label: String,
    app: AppHandle<R>,
) -> Result<(), String> {
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview not found: {label}"))?;
    webview
        .eval(crate::js::configure_element_grab(false))
        .map_err(|e| format!("eval failed: {e}"))
}

#[tauri::command]
pub(crate) fn browser_bridge_ready<R: Runtime>(
    webview: tauri::Webview<R>,
    version: String,
    url: Option<String>,
    bridge_state: State<'_, BridgeState>,
) -> Result<(), String> {
    let label = webview.label().to_string();
    if !label.starts_with("browser-pane:") {
        return Ok(()); // ignore callbacks from non-browser webviews
    }
    let normalized_version = version.trim();
    if normalized_version.is_empty() {
        return Err("bridge version is required".to_string());
    }
    let normalized_url = url.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    });
    bridge_state.mark_bridge_ready(&label, normalized_version.to_string(), normalized_url);
    log_backend(
        "DEBUG",
        format!(
            "bridge: browser ready label={label} version={} url={}",
            normalized_version,
            webview
                .url()
                .map(|value| value.to_string())
                .unwrap_or_else(|_| "unknown".to_string())
        ),
    );
    Ok(())
}

#[tauri::command]
pub(crate) fn browser_eval_result<R: Runtime>(
    webview: tauri::Webview<R>,
    request_id: String,
    callback_token: String,
    payload: String,
    bridge_state: State<'_, BridgeState>,
) -> Result<(), String> {
    let caller_label = webview.label().to_string();
    let pending_eval = {
        let mut pending = bridge_state
            .pending_evals
            .lock()
            .map_err(|_| "failed to lock pending evals".to_string())?;

        let Some(existing) = pending.get(&request_id) else {
            log_backend(
                "DEBUG",
                format!("bridge: late eval callback ignored webview={caller_label} request_id={request_id}"),
            );
            return Ok(());
        };

        if existing.label != caller_label || existing.callback_token != callback_token {
            log_backend(
                "WARN",
                format!("bridge: rejected eval callback from webview={caller_label}"),
            );
            return Ok(());
        }

        pending.remove(&request_id)
    };

    let Some(pending_eval) = pending_eval else {
        return Ok(());
    };

    log_backend(
        "DEBUG",
        format!(
            "bridge: eval callback received webview={caller_label} request_id={request_id} payload_bytes={}",
            payload.len()
        ),
    );

    pending_eval
        .sender
        .send(payload)
        .map_err(|_| "eval receiver dropped".to_string())
}

/// Capture a screenshot of a browser webview as a base64-encoded PNG data URL.
#[tauri::command]
pub(crate) async fn browser_capture_screenshot<R: Runtime>(
    app: AppHandle<R>,
    label: String,
) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use block2::RcBlock;
        use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSImage};
        use objc2_foundation::{NSDictionary, NSError};
        use objc2_web_kit::{WKSnapshotConfiguration, WKWebView};

        let webview = app
            .get_webview(&label)
            .ok_or_else(|| format!("webview not found: {label}"))?;

        let (tx, rx) = tokio::sync::oneshot::channel::<Result<Vec<u8>, String>>();

        webview
            .with_webview(move |platform_webview| {
                // Safety: platform_webview.inner() returns the underlying WKWebView pointer on macOS.
                let wk: *mut std::ffi::c_void = platform_webview.inner().cast();
                let wk_webview: &WKWebView = unsafe { &*(wk as *const WKWebView) };

                // We're on the main thread inside with_webview, so MainThreadMarker is safe.
                let mtm = unsafe { objc2::MainThreadMarker::new_unchecked() };
                let config = unsafe { WKSnapshotConfiguration::new(mtm) };

                let tx = std::sync::Mutex::new(Some(tx));
                let block = RcBlock::new(move |image: *mut NSImage, error: *mut NSError| {
                    let result = if image.is_null() {
                        let msg = if !error.is_null() {
                            "snapshot returned an error".to_string()
                        } else {
                            "snapshot returned nil image".to_string()
                        };
                        Err(msg)
                    } else {
                        unsafe {
                            let ns_image: &NSImage = &*image;
                            let tiff_data = ns_image.TIFFRepresentation();
                            match tiff_data {
                                Some(tiff) => {
                                    let bitmap = NSBitmapImageRep::imageRepWithData(&tiff);
                                    match bitmap {
                                        Some(rep) => {
                                            let png_data = rep.representationUsingType_properties(
                                                NSBitmapImageFileType::PNG,
                                                &NSDictionary::new(),
                                            );
                                            match png_data {
                                                Some(data) => {
                                                    let slice = data.as_bytes_unchecked();
                                                    Ok(slice.to_vec())
                                                }
                                                None => Err("PNG conversion failed".to_string()),
                                            }
                                        }
                                        None => Err("bitmap rep creation failed".to_string()),
                                    }
                                }
                                None => Err("TIFF conversion failed".to_string()),
                            }
                        }
                    };
                    if let Some(sender) = tx.lock().ok().and_then(|mut g| g.take()) {
                        let _ = sender.send(result);
                    }
                });

                // RcBlock derefs to Block, so &*block gives &Block which is what the API expects.
                unsafe {
                    wk_webview
                        .takeSnapshotWithConfiguration_completionHandler(Some(&config), &block);
                }
            })
            .map_err(|e| format!("with_webview failed: {e}"))?;

        let png_bytes = rx
            .await
            .map_err(|_| "screenshot channel closed".to_string())?
            .map_err(|e| format!("screenshot capture failed: {e}"))?;

        let b64 = BASE64_STANDARD.encode(&png_bytes);
        Ok(format!("data:image/png;base64,{b64}"))
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, label);
        Err("screenshot capture is only supported on macOS".to_string())
    }
}

const PROJECT_PREVIEW_FILE_NAME: &str = "preview.png";

fn project_preview_path(project: &str) -> Result<PathBuf, String> {
    let project_dir = resolve_project_dir(project)?;
    let weekend_dir = project_dir.join(PROJECT_WEEKEND_DIR_NAME);
    Ok(weekend_dir.join(PROJECT_PREVIEW_FILE_NAME))
}

#[tauri::command]
pub(crate) async fn project_save_preview(project: String, data_url: String) -> Result<(), String> {
    let payload = data_url
        .strip_prefix("data:image/png;base64,")
        .ok_or_else(|| "preview data URL must be a base64 PNG".to_string())?;
    let bytes = BASE64_STANDARD
        .decode(payload)
        .map_err(|error| format!("failed to decode preview: {error}"))?;

    let target = project_preview_path(&project)?;
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }
    std::fs::write(&target, &bytes)
        .map_err(|error| format!("failed to write {}: {error}", target.display()))?;
    Ok(())
}

#[tauri::command]
pub(crate) async fn project_load_preview(project: String) -> Result<Option<String>, String> {
    let target = project_preview_path(&project)?;
    match std::fs::read(&target) {
        Ok(bytes) => {
            let b64 = BASE64_STANDARD.encode(&bytes);
            Ok(Some(format!("data:image/png;base64,{b64}")))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("failed to read {}: {error}", target.display())),
    }
}
