use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

const MAX_EVENTS_PER_WEBVIEW: usize = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeEvent {
    pub seq: u64,
    pub category: String,
    pub data: serde_json::Value,
    pub timestamp_ms: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ObserverConfig {
    #[serde(default)]
    pub console: bool,
    #[serde(default)]
    pub errors: bool,
    #[serde(default)]
    pub navigation: bool,
    #[serde(default)]
    pub clicks: bool,
    #[serde(default)]
    pub inputs: bool,
    #[serde(default)]
    pub dom_mutations: bool,
    #[serde(default)]
    pub network: bool,
    #[serde(default)]
    pub element_grab: bool,
    #[serde(default)]
    pub custom: bool,
}

struct WebviewBuffer {
    events: Vec<BridgeEvent>,
    next_seq: u64,
    observer_config: ObserverConfig,
}

impl WebviewBuffer {
    fn new() -> Self {
        Self {
            events: Vec::new(),
            next_seq: 1,
            observer_config: ObserverConfig::default(),
        }
    }

    fn push(&mut self, category: String, data: serde_json::Value) {
        let event = BridgeEvent {
            seq: self.next_seq,
            category,
            data,
            timestamp_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        };
        self.next_seq += 1;
        self.events.push(event);
        if self.events.len() > MAX_EVENTS_PER_WEBVIEW {
            let excess = self.events.len() - MAX_EVENTS_PER_WEBVIEW;
            self.events.drain(..excess);
        }
    }

    fn drain_since(&mut self, since_seq: u64) -> Vec<BridgeEvent> {
        let idx = self
            .events
            .iter()
            .position(|e| e.seq > since_seq)
            .unwrap_or(self.events.len());
        self.events.drain(..idx);
        // Return remaining events (all have seq > since_seq)
        // We drain the ones at or below since_seq, then return (clone) and clear what's left
        let result = self.events.clone();
        self.events.clear();
        result
    }
}

pub struct EventBufferState {
    buffers: Arc<Mutex<HashMap<String, WebviewBuffer>>>,
}

impl EventBufferState {
    pub fn new() -> Self {
        Self {
            buffers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn push_event(&self, label: &str, category: String, data: serde_json::Value) {
        if let Ok(mut map) = self.buffers.lock() {
            map.entry(label.to_string())
                .or_insert_with(WebviewBuffer::new)
                .push(category, data);
        }
    }

    pub fn drain_events(&self, label: &str, since_seq: u64) -> Vec<BridgeEvent> {
        if let Ok(mut map) = self.buffers.lock() {
            if let Some(buf) = map.get_mut(label) {
                return buf.drain_since(since_seq);
            }
        }
        Vec::new()
    }

    pub fn get_observer_config(&self, label: &str) -> ObserverConfig {
        if let Ok(map) = self.buffers.lock() {
            if let Some(buf) = map.get(label) {
                return buf.observer_config.clone();
            }
        }
        ObserverConfig::default()
    }

    pub fn set_observer_config(&self, label: &str, config: ObserverConfig) {
        if let Ok(mut map) = self.buffers.lock() {
            map.entry(label.to_string())
                .or_insert_with(WebviewBuffer::new)
                .observer_config = config;
        }
    }
}
