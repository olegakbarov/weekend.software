use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct BrowserBridgeState {
    pub ready: bool,
    pub version: Option<String>,
    pub url: Option<String>,
    pub updated_at_ms: u64,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum BridgeRequest {
    #[serde(rename = "hello")]
    Hello { token: String },
    #[serde(rename = "list_webviews")]
    ListWebviews,
    #[serde(rename = "eval_js")]
    EvalJs { label: String, script: String },
    #[serde(rename = "navigate")]
    Navigate { label: String, url: String },
    #[serde(rename = "get_url")]
    GetUrl { label: String },
    #[serde(rename = "drain_events")]
    DrainEvents { label: String, since_seq: u64 },
    #[serde(rename = "configure_observers")]
    ConfigureObservers {
        label: String,
        config: crate::event_buffer::ObserverConfig,
    },
}

#[derive(Debug, Deserialize)]
pub struct BridgeRequestEnvelope {
    pub id: String,
    pub request: BridgeRequest,
}

#[derive(Debug, Serialize)]
pub struct BridgeResponse {
    pub id: String,
    #[serde(flatten)]
    pub result: BridgeResult,
}

#[derive(Debug, Serialize)]
#[serde(tag = "status")]
pub enum BridgeResult {
    #[serde(rename = "ok")]
    Ok { data: serde_json::Value },
    #[serde(rename = "error")]
    Error { message: String },
}

pub struct PendingEval {
    pub label: String,
    pub callback_token: String,
    pub sender: oneshot::Sender<String>,
}

pub struct BridgeState {
    pub pending_evals: Arc<Mutex<HashMap<String, PendingEval>>>,
    /// Tracks browser webview labels observed via on_page_load.
    /// Child webviews (browser-pane:*) don't appear in webview_windows(),
    /// so we maintain this set to enumerate them.
    pub browser_webview_labels: Arc<Mutex<HashSet<String>>>,
    /// Per-webview state for injected browser bridge readiness/version.
    pub browser_bridge_states: Arc<Mutex<HashMap<String, BrowserBridgeState>>>,
    /// Per-process token used to validate that MCP clients connected to the expected bridge.
    pub connection_token: String,
    /// Absolute path to this process's bridge port file.
    pub port_file_path: Arc<Mutex<Option<PathBuf>>>,
}

impl BridgeState {
    pub fn new() -> Self {
        Self {
            pending_evals: Arc::new(Mutex::new(HashMap::new())),
            browser_webview_labels: Arc::new(Mutex::new(HashSet::new())),
            browser_bridge_states: Arc::new(Mutex::new(HashMap::new())),
            connection_token: Uuid::new_v4().to_string(),
            port_file_path: Arc::new(Mutex::new(None)),
        }
    }

    pub fn mark_bridge_loading(&self, label: &str, url: Option<String>) {
        if let Ok(mut map) = self.browser_bridge_states.lock() {
            map.insert(
                label.to_string(),
                BrowserBridgeState {
                    ready: false,
                    version: None,
                    url,
                    updated_at_ms: now_unix_ms(),
                },
            );
        }
    }

    pub fn mark_bridge_ready(&self, label: &str, version: String, url: Option<String>) {
        if let Ok(mut map) = self.browser_bridge_states.lock() {
            map.insert(
                label.to_string(),
                BrowserBridgeState {
                    ready: true,
                    version: Some(version),
                    url,
                    updated_at_ms: now_unix_ms(),
                },
            );
        }
    }

    pub fn is_bridge_ready(&self, label: &str) -> bool {
        if let Ok(map) = self.browser_bridge_states.lock() {
            return map.get(label).map(|state| state.ready).unwrap_or(false);
        }
        false
    }

    pub fn bridge_state(&self, label: &str) -> Option<BrowserBridgeState> {
        if let Ok(map) = self.browser_bridge_states.lock() {
            return map.get(label).cloned();
        }
        None
    }

    pub fn remove_bridge_state(&self, label: &str) {
        if let Ok(mut map) = self.browser_bridge_states.lock() {
            map.remove(label);
        }
    }
}

fn now_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
