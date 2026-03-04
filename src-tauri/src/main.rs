#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bridge_server;
mod bridge_types;
mod event_buffer;
mod webview_ops;

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine as _;
use bridge_types::BridgeState;
use event_buffer::EventBufferState;
use notify::{
    Config as NotifyConfig, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

struct TerminalSession {
    master: Mutex<Box<dyn portable_pty::MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    #[allow(dead_code)]
    child: Mutex<Box<dyn portable_pty::Child + Send>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalSessionInfo {
    terminal_id: String,
    project: String,
    display_name: String,
    custom_name: Option<String>,
    status: String,
    #[serde(default)]
    has_active_process: bool,
    #[serde(default)]
    foreground_process_name: Option<String>,
    created_at: u64,
    #[serde(default)]
    play_spawned: bool,
    #[serde(default)]
    process_role: Option<String>,
}

/// Lock ordering: when both `sessions` and `session_info` are needed,
/// acquire `sessions` first, drop it, then acquire `session_info`. Never hold both.
#[derive(Clone)]
struct TerminalState {
    sessions: Arc<Mutex<HashMap<String, Arc<TerminalSession>>>>,
    opening_sessions: Arc<Mutex<HashSet<String>>>,
    session_info: Arc<Mutex<HashMap<String, TerminalSessionInfo>>>,
}

impl TerminalState {
    fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            opening_sessions: Arc::new(Mutex::new(HashSet::new())),
            session_info: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalOutputPayload {
    terminal_id: String,
    seq: u64,
    data: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RuntimeDebugSnapshot {
    generated_at_unix_ms: u64,
    terminal_ids: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProjectTreeNode {
    name: String,
    path: String,
    is_dir: bool,
    children: Vec<ProjectTreeNode>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProjectTreeChangedPayload {
    project: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFileBinaryPayload {
    data_base64: String,
    size_bytes: u64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct BrowserWebviewPageLoadPayload {
    webview_label: String,
    window_label: String,
    url: String,
    phase: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UiLogEntry {
    level: String,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WeekendLogsSnapshot {
    backend: String,
    frontend: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectLogsSnapshot {
    project: String,
    content: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SharedAssetSnapshot {
    file_name: String,
    size_bytes: u64,
    modified_at_unix_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SharedAssetUploadInput {
    file_name: String,
    data_base64: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFileImportInput {
    file_name: String,
    source_path: Option<String>,
    data_base64: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProjectRuntimeConfig {
    host: String,
    port: Option<u16>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct ProjectStartupConfig {
    #[serde(default)]
    commands: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProcessEntry {
    command: String,
    role: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProjectConfig {
    runtime: ProjectRuntimeConfig,
    #[serde(default)]
    startup: ProjectStartupConfig,
    #[serde(default)]
    processes: Option<HashMap<String, ProcessEntry>>,
    #[serde(default)]
    archived: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProcessEntrySnapshot {
    command: String,
    role: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectConfigReadSnapshot {
    project: String,
    project_dir: String,
    config_path: String,
    config_exists: bool,
    config_valid: bool,
    runtime_host: Option<String>,
    runtime_port: Option<u16>,
    startup_commands: Vec<String>,
    processes: HashMap<String, ProcessEntrySnapshot>,
    source: String,
    error: Option<String>,
    port_range_start: u16,
    port_range_end: u16,
    archived: bool,
}

#[derive(Debug, Clone)]
struct ProjectConfigResolved {
    runtime: ProjectRuntimeConfig,
    startup_commands: Vec<String>,
    processes: HashMap<String, ProcessEntrySnapshot>,
    archived: bool,
}

enum ProjectConfigLookup {
    Missing,
    Valid(ProjectConfigResolved),
    Invalid(String),
}

fn weekend_root() -> Result<PathBuf, String> {
    let home =
        std::env::var("HOME").map_err(|_| "HOME environment variable is not set".to_string())?;
    Ok(PathBuf::from(home).join(".weekend"))
}

fn legacy_aios_root() -> Result<PathBuf, String> {
    let home =
        std::env::var("HOME").map_err(|_| "HOME environment variable is not set".to_string())?;
    Ok(PathBuf::from(home).join(".aios"))
}

const PORT_RANGE_START: u16 = 8457;
const PORT_RANGE_END: u16 = 8999;
const DEFAULT_RUNTIME_HOST: &str = "127.0.0.1";
const DEFAULT_STARTUP_COMMAND: &str = "pnpm dev";
const DEFAULT_AGENT_COMMAND: &str = "claude";
const PROJECT_CONFIG_FILE_NAME: &str = "weekend.config.json";
const LEGACY_PROJECT_CONFIG_FILE_NAME: &str = "aios.config.json";
const PROJECT_CLAUDE_FILE_NAME: &str = "CLAUDE.md";
const PROJECT_AGENTS_FILE_NAME: &str = "AGENTS.md";
const PROJECT_GITIGNORE_FILE_NAME: &str = ".gitignore";
const SHARED_ASSETS_ROOT_DIR_NAME: &str = "shared-assets";
const PROJECT_SHARED_ASSETS_DIR_NAME: &str = "shared-assets";
const LOG_ROTATE_MAX_BYTES: u64 = 2 * 1024 * 1024;
const LOG_ROTATE_ARCHIVE_COUNT: usize = 6;
const LOG_MESSAGE_MAX_CHARS: usize = 8000;
const LOG_TAIL_DEFAULT_MAX_BYTES: usize = 128 * 1024;
const MAX_PREVIEW_FILE_BYTES: u64 = 20 * 1024 * 1024;

const PROJECT_AGENT_RUNTIME_GUIDANCE: &str = r#"# Runtime Configuration

Read `./weekend.config.json` before launching any runtime command.
Use `runtime.host` and `runtime.port` from that file as the runtime endpoint.
Use backend commands (or browser controls) to update `weekend.config.json`.

# Shared Assets

Shared assets are available at `./shared-assets/`.
Before using any shared asset, ask the user which files from
`./shared-assets/` should be used for this project.
Do not assume every shared asset should be applied automatically.

# Browser Interaction (weekend-browser MCP)

You have access to a live browser pane via the `weekend-browser` MCP server.
Always prefer these tools over spawning headless browsers, curl, or wget
when you need to inspect, test, or interact with the running application.

## Available tools

- `browser_snapshot` — Capture an accessibility snapshot with stable refs.
- `browser_click_ref` — Click an element using a snapshot ref.
- `browser_type_ref` — Type into an input using a snapshot ref.
- `browser_wait_for` — Wait for text, URL, or time between action steps.
- `browser_eval_js` — Execute JS in the page, return result.
- `browser_get_text` — Get innerText of the page or a CSS selector.
- `browser_get_dom` — Get outerHTML of the page or a CSS selector.
- `browser_click` — Click an element by CSS selector.
- `browser_type` — Type into an input by CSS selector.
- `browser_scroll` — Scroll the page or an element.
- `browser_navigate` — Navigate to a URL.
- `browser_get_url` — Get the current URL.
- `browser_list_webviews` — List open browser panes.

## When to use

- Verifying UI changes after editing code (check text, layout, errors).
- Reading error messages, console output, or page state.
- Filling out forms, clicking buttons, testing user flows.
- Checking what URL is loaded or navigating to a different page.
- Extracting data visible on the page (table contents, element counts, etc.).

## Tips

- You do not need to specify a `label` — your project's browser pane is
  auto-selected via WEEKEND_PROJECT.
- Start with `browser_snapshot`, then use ref-based actions (`browser_click_ref`,
  `browser_type_ref`) for interactions.
- Re-run `browser_snapshot` after navigation or significant DOM changes before
  taking the next ref-based action.
- Use `browser_wait_for` between action steps to make flows more reliable.
- `browser_eval_js` runs in an async context. Use `return <expr>` to get
  values back. Example: `return document.title`
- Chain multiple reads before acting: get the DOM, understand it, then click.
- Prefer `browser_get_text` for quick content checks over full DOM dumps.
"#;

static LOG_FILE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn shared_assets_root() -> Result<PathBuf, String> {
    Ok(weekend_root()?.join(SHARED_ASSETS_ROOT_DIR_NAME))
}

fn ensure_shared_assets_root() -> Result<PathBuf, String> {
    let path = shared_assets_root()?;
    std::fs::create_dir_all(&path).map_err(|error| {
        format!(
            "failed to create shared assets directory {}: {error}",
            path.display()
        )
    })?;
    Ok(path)
}

fn project_shared_assets_dir(project_dir: &Path) -> PathBuf {
    project_dir.join(PROJECT_SHARED_ASSETS_DIR_NAME)
}

fn sanitize_shared_asset_file_name(file_name: &str) -> Result<String, String> {
    let trimmed = file_name.trim();
    if trimmed.is_empty() {
        return Err("shared asset filename is required".to_string());
    }
    let normalized = Path::new(trimmed)
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .ok_or_else(|| format!("invalid shared asset filename: {trimmed}"))?;
    if normalized.is_empty() || normalized == "." || normalized == ".." {
        return Err(format!("invalid shared asset filename: {trimmed}"));
    }
    if normalized.contains('/') || normalized.contains('\\') {
        return Err(format!("invalid shared asset filename: {trimmed}"));
    }
    Ok(normalized.to_string())
}

fn decode_shared_asset_payload(data_base64: &str) -> Result<Vec<u8>, String> {
    let trimmed = data_base64.trim();
    if trimmed.is_empty() {
        return Err("shared asset payload is required".to_string());
    }
    let payload = trimmed
        .split_once(',')
        .map(|(_, encoded)| encoded)
        .unwrap_or(trimmed)
        .trim();
    if payload.is_empty() {
        return Err("shared asset payload is required".to_string());
    }
    BASE64_STANDARD
        .decode(payload)
        .map_err(|error| format!("invalid shared asset payload: {error}"))
}

fn decode_project_file_payload(data_base64: &str) -> Result<Vec<u8>, String> {
    let trimmed = data_base64.trim();
    if trimmed.is_empty() {
        return Err("file payload is required".to_string());
    }
    let payload = trimmed
        .split_once(',')
        .map(|(_, encoded)| encoded)
        .unwrap_or(trimmed)
        .trim();
    if payload.is_empty() {
        return Err("file payload is required".to_string());
    }
    BASE64_STANDARD
        .decode(payload)
        .map_err(|error| format!("invalid file payload: {error}"))
}

fn to_unix_ms(time: SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|duration| u64::try_from(duration.as_millis()).ok())
}

fn list_shared_asset_snapshots(shared_root: &Path) -> Result<Vec<SharedAssetSnapshot>, String> {
    if !shared_root.exists() {
        return Ok(Vec::new());
    }

    let entries = std::fs::read_dir(shared_root)
        .map_err(|error| format!("failed to read {}: {error}", shared_root.display()))?;

    let mut snapshots: Vec<SharedAssetSnapshot> = entries
        .flatten()
        .filter_map(|entry| {
            let file_type = entry.file_type().ok()?;
            if !file_type.is_file() {
                return None;
            }
            let file_name = entry.file_name().into_string().ok()?;
            let metadata = entry.metadata().ok()?;
            Some(SharedAssetSnapshot {
                file_name,
                size_bytes: metadata.len(),
                modified_at_unix_ms: metadata.modified().ok().and_then(to_unix_ms),
            })
        })
        .collect();

    snapshots.sort_by(|left, right| {
        left.file_name
            .to_ascii_lowercase()
            .cmp(&right.file_name.to_ascii_lowercase())
            .then_with(|| left.file_name.cmp(&right.file_name))
    });

    Ok(snapshots)
}

fn sync_shared_assets_into_project(project_dir: &Path, shared_root: &Path) -> Result<u32, String> {
    if !shared_root.exists() {
        return Ok(0);
    }

    let source_paths: Vec<(String, PathBuf)> = std::fs::read_dir(shared_root)
        .map_err(|error| format!("failed to read {}: {error}", shared_root.display()))?
        .flatten()
        .filter_map(|entry| {
            let file_type = entry.file_type().ok()?;
            if !file_type.is_file() {
                return None;
            }
            let file_name = entry.file_name().into_string().ok()?;
            Some((file_name, entry.path()))
        })
        .collect();

    if source_paths.is_empty() {
        return Ok(0);
    }

    let project_shared_assets = project_shared_assets_dir(project_dir);
    std::fs::create_dir_all(&project_shared_assets).map_err(|error| {
        format!(
            "failed to create project shared assets directory {}: {error}",
            project_shared_assets.display()
        )
    })?;

    for (file_name, source_path) in &source_paths {
        let target_path = project_shared_assets.join(file_name);
        std::fs::copy(source_path, &target_path).map_err(|error| {
            format!(
                "failed to sync shared asset {} -> {}: {error}",
                source_path.display(),
                target_path.display()
            )
        })?;
    }

    Ok(u32::try_from(source_paths.len()).unwrap_or(u32::MAX))
}

fn sync_shared_assets_into_all_projects(
    weekend_root: &Path,
    shared_root: &Path,
) -> Result<u32, String> {
    if !shared_root.exists() {
        return Ok(0);
    }

    let entries = std::fs::read_dir(weekend_root)
        .map_err(|error| format!("failed to read ~/.weekend: {error}"))?;

    let mut synced_projects = 0u32;
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }

        let project_name = match entry.file_name().into_string() {
            Ok(name) => name,
            Err(_) => continue,
        };
        if is_reserved_root_entry(&project_name) || !is_safe_project_name(&project_name) {
            continue;
        }

        sync_shared_assets_into_project(&entry.path(), shared_root)?;
        synced_projects += 1;
    }

    Ok(synced_projects)
}
static PROJECT_PORT_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().try_into().unwrap_or(u64::MAX))
        .unwrap_or(0)
}

fn log_file_lock() -> &'static Mutex<()> {
    LOG_FILE_LOCK.get_or_init(|| Mutex::new(()))
}

fn project_port_lock() -> &'static Mutex<()> {
    PROJECT_PORT_LOCK.get_or_init(|| Mutex::new(()))
}

fn logs_dir() -> Result<PathBuf, String> {
    let root = weekend_root()?;
    let dir = root.join("logs");
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("failed to create log directory {}: {error}", dir.display()))?;
    Ok(dir)
}

fn surface_log_path(surface: &str) -> Result<PathBuf, String> {
    let file_name = match surface.trim() {
        "frontend" => "frontend.log",
        _ => "backend.log",
    };
    Ok(logs_dir()?.join(file_name))
}

fn rotated_path_for(path: &Path, index: usize) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("log");
    path.with_file_name(format!("{file_name}.{index}"))
}

fn rotate_log_if_needed(path: &Path) -> Result<(), String> {
    let Ok(metadata) = std::fs::metadata(path) else {
        return Ok(());
    };
    if metadata.len() < LOG_ROTATE_MAX_BYTES {
        return Ok(());
    }

    let oldest = rotated_path_for(path, LOG_ROTATE_ARCHIVE_COUNT);
    if oldest.exists() {
        std::fs::remove_file(&oldest).map_err(|error| {
            format!("failed removing rotated log {}: {error}", oldest.display())
        })?;
    }

    for index in (2..=LOG_ROTATE_ARCHIVE_COUNT).rev() {
        let source = rotated_path_for(path, index - 1);
        if !source.exists() {
            continue;
        }
        let target = rotated_path_for(path, index);
        std::fs::rename(&source, &target).map_err(|error| {
            format!(
                "failed rotating log {} -> {}: {error}",
                source.display(),
                target.display()
            )
        })?;
    }

    let first_archive = rotated_path_for(path, 1);
    std::fs::rename(path, &first_archive).map_err(|error| {
        format!(
            "failed rotating active log {} -> {}: {error}",
            path.display(),
            first_archive.display()
        )
    })?;
    Ok(())
}

fn truncate_log_message(message: &str) -> String {
    let normalized = message.trim().replace('\r', "");
    if normalized.chars().count() <= LOG_MESSAGE_MAX_CHARS {
        return normalized;
    }
    let truncated: String = normalized.chars().take(LOG_MESSAGE_MAX_CHARS - 3).collect();
    format!("{truncated}...")
}

fn append_log_to_path(path: &Path, level: &str, message: &str) -> Result<(), String> {
    rotate_log_if_needed(path)?;

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| format!("failed to open log file {}: {error}", path.display()))?;

    let timestamp = now_unix_ms();
    let normalized_level = {
        let trimmed = level.trim();
        if trimmed.is_empty() {
            "INFO".to_string()
        } else {
            trimmed.to_ascii_uppercase()
        }
    };
    let normalized_message = truncate_log_message(message);
    if normalized_message.is_empty() {
        writeln!(file, "[{timestamp}] [{normalized_level}]")
            .map_err(|error| format!("failed to write log entry: {error}"))?;
        return Ok(());
    }

    for line in normalized_message.lines() {
        writeln!(file, "[{timestamp}] [{normalized_level}] {line}")
            .map_err(|error| format!("failed to write log entry: {error}"))?;
    }

    Ok(())
}

fn append_log(surface: &str, level: &str, message: &str) -> Result<(), String> {
    let _guard = log_file_lock()
        .lock()
        .map_err(|_| "failed to lock log writer".to_string())?;
    let path = surface_log_path(surface)?;
    append_log_to_path(&path, level, message)
}

fn log_backend(level: &str, message: impl AsRef<str>) {
    let _ = append_log("backend", level, message.as_ref());
}

fn project_logs_dir() -> Result<PathBuf, String> {
    let dir = logs_dir()?.join("projects");
    std::fs::create_dir_all(&dir).map_err(|error| {
        format!(
            "failed to create project log directory {}: {error}",
            dir.display()
        )
    })?;
    Ok(dir)
}

fn project_log_path(project: &str) -> Result<PathBuf, String> {
    if !is_safe_project_name(project) {
        return Err("invalid project name".to_string());
    }
    Ok(project_logs_dir()?.join(format!("{project}.log")))
}

fn read_log_tail_from_path(path: &Path, max_bytes: usize) -> Result<String, String> {
    if !path.exists() {
        return Ok(String::new());
    }
    let bytes = std::fs::read(path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    if bytes.is_empty() {
        return Ok(String::new());
    }
    if bytes.len() <= max_bytes {
        return Ok(String::from_utf8_lossy(&bytes).to_string());
    }
    let start = bytes.len().saturating_sub(max_bytes);
    Ok(String::from_utf8_lossy(&bytes[start..]).to_string())
}

fn project_config_path(project_dir: &Path) -> PathBuf {
    project_dir.join(PROJECT_CONFIG_FILE_NAME)
}

fn legacy_project_config_path(project_dir: &Path) -> PathBuf {
    project_dir.join(LEGACY_PROJECT_CONFIG_FILE_NAME)
}

fn configs_are_json_equivalent(left_raw: &str, right_raw: &str) -> bool {
    if left_raw.trim() == right_raw.trim() {
        return true;
    }

    let Ok(left_json) = serde_json::from_str::<serde_json::Value>(left_raw) else {
        return false;
    };
    let Ok(right_json) = serde_json::from_str::<serde_json::Value>(right_raw) else {
        return false;
    };

    left_json == right_json
}

fn read_project_config_from_path(config_path: &Path) -> ProjectConfigLookup {
    if !config_path.exists() {
        return ProjectConfigLookup::Missing;
    }

    let raw = match std::fs::read_to_string(config_path) {
        Ok(value) => value,
        Err(error) => {
            return ProjectConfigLookup::Invalid(format!(
                "failed reading {}: {error}",
                config_path.display()
            ));
        }
    };

    let parsed = match serde_json::from_str::<ProjectConfig>(&raw) {
        Ok(value) => value,
        Err(error) => {
            return ProjectConfigLookup::Invalid(format!(
                "failed parsing {}: {error}",
                config_path.display()
            ));
        }
    };

    let Some(host) = normalize_runtime_host(&parsed.runtime.host) else {
        return ProjectConfigLookup::Invalid("runtime.host is required".to_string());
    };
    if let Some(port) = parsed.runtime.port {
        if !is_runtime_port_in_range(port) {
            return ProjectConfigLookup::Invalid(format!(
                "runtime.port must be in range {PORT_RANGE_START}-{PORT_RANGE_END}"
            ));
        }
    }

    let startup_commands = normalize_startup_commands(&parsed.startup.commands);
    let processes = resolve_processes(parsed.processes.as_ref(), &startup_commands);

    ProjectConfigLookup::Valid(ProjectConfigResolved {
        runtime: ProjectRuntimeConfig {
            host,
            port: parsed.runtime.port,
        },
        startup_commands,
        processes,
        archived: parsed.archived,
    })
}

fn maybe_migrate_legacy_project_config(project_dir: &Path) {
    let canonical_path = project_config_path(project_dir);
    let legacy_path = legacy_project_config_path(project_dir);

    if !legacy_path.exists() {
        return;
    }

    if !canonical_path.exists() {
        match std::fs::rename(&legacy_path, &canonical_path) {
            Ok(_) => {
                log_backend(
                    "INFO",
                    format!(
                        "migrated legacy config {} -> {}",
                        legacy_path.display(),
                        canonical_path.display()
                    ),
                );
            }
            Err(error) => {
                log_backend(
                    "WARN",
                    format!(
                        "failed migrating legacy config {} -> {}: {error}",
                        legacy_path.display(),
                        canonical_path.display()
                    ),
                );
            }
        }
        return;
    }

    let canonical_raw = match std::fs::read_to_string(&canonical_path) {
        Ok(raw) => raw,
        Err(error) => {
            log_backend(
                "WARN",
                format!(
                    "failed reading canonical config {} during legacy cleanup: {error}",
                    canonical_path.display()
                ),
            );
            return;
        }
    };
    let legacy_raw = match std::fs::read_to_string(&legacy_path) {
        Ok(raw) => raw,
        Err(error) => {
            log_backend(
                "WARN",
                format!(
                    "failed reading legacy config {} during cleanup: {error}",
                    legacy_path.display()
                ),
            );
            return;
        }
    };

    if configs_are_json_equivalent(&canonical_raw, &legacy_raw) {
        if let Err(error) = std::fs::remove_file(&legacy_path) {
            log_backend(
                "WARN",
                format!(
                    "failed removing duplicate legacy config {}: {error}",
                    legacy_path.display()
                ),
            );
        } else {
            log_backend(
                "INFO",
                format!("removed duplicate legacy config {}", legacy_path.display()),
            );
        }
        return;
    }

    let promote_legacy = matches!(
        (
            read_project_config_from_path(&canonical_path),
            read_project_config_from_path(&legacy_path),
        ),
        (
            ProjectConfigLookup::Invalid(_),
            ProjectConfigLookup::Valid(_)
        )
    );

    if promote_legacy {
        let normalized = format!("{}\n", legacy_raw.trim_end());
        match std::fs::write(&canonical_path, normalized) {
            Ok(_) => {
                log_backend(
                    "WARN",
                    format!(
                        "replaced invalid {} with valid legacy config from {}",
                        canonical_path.display(),
                        legacy_path.display()
                    ),
                );
            }
            Err(error) => {
                log_backend(
                    "WARN",
                    format!(
                        "failed promoting legacy config {} -> {}: {error}",
                        legacy_path.display(),
                        canonical_path.display()
                    ),
                );
                return;
            }
        }
    } else {
        log_backend(
            "WARN",
            format!(
                "keeping canonical config {} and dropping legacy {}",
                canonical_path.display(),
                legacy_path.display()
            ),
        );
    }

    if let Err(error) = std::fs::remove_file(&legacy_path) {
        log_backend(
            "WARN",
            format!(
                "failed removing legacy config {}: {error}",
                legacy_path.display()
            ),
        );
    }
}

fn normalize_runtime_host(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn normalize_startup_commands(commands: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();
    for command in commands {
        let trimmed = command.trim();
        if trimmed.is_empty() {
            continue;
        }
        if normalized
            .iter()
            .any(|existing: &String| existing == trimmed)
        {
            continue;
        }
        normalized.push(trimmed.to_string());
    }
    normalized
}

fn normalize_process_command(command: &str) -> Option<String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn normalize_process_role(role: &str, command: &str) -> String {
    let normalized_role = role.trim().to_ascii_lowercase();
    match normalized_role.as_str() {
        "agent" | "default-agent" => "agent".to_string(),
        "dev-server" | "dev" | "runtime" | "server" => "dev-server".to_string(),
        "service" => "service".to_string(),
        _ => {
            let normalized_name = normalize_process_name(command);
            if is_wrapper_process_name(&normalized_name) {
                "agent".to_string()
            } else {
                "service".to_string()
            }
        }
    }
}

fn next_unique_process_label(base: &str, used_labels: &mut HashSet<String>) -> String {
    let normalized_base = if base.trim().is_empty() {
        "process"
    } else {
        base
    };
    if used_labels.insert(normalized_base.to_string()) {
        return normalized_base.to_string();
    }

    let mut suffix = 2u32;
    loop {
        let candidate = format!("{normalized_base}-{suffix}");
        if used_labels.insert(candidate.clone()) {
            return candidate;
        }
        suffix += 1;
    }
}

fn resolve_processes(
    parsed_processes: Option<&HashMap<String, ProcessEntry>>,
    startup_commands: &[String],
) -> HashMap<String, ProcessEntrySnapshot> {
    let mut resolved = HashMap::<String, ProcessEntrySnapshot>::new();
    let mut used_labels = HashSet::<String>::new();
    let mut seen_commands = HashSet::<String>::new();
    let mut has_dev_server = false;

    if let Some(processes) = parsed_processes {
        for (raw_label, entry) in processes {
            let Some(command) = normalize_process_command(&entry.command) else {
                continue;
            };
            let role = normalize_process_role(&entry.role, &command);
            if role == "dev-server" {
                has_dev_server = true;
            }

            let base_label = raw_label.trim();
            let label = next_unique_process_label(base_label, &mut used_labels);
            seen_commands.insert(command.clone());
            resolved.insert(label, ProcessEntrySnapshot { command, role });
        }
    }

    for startup_command in startup_commands {
        let Some(command) = normalize_process_command(startup_command) else {
            continue;
        };
        if seen_commands.contains(&command) {
            continue;
        }

        let normalized_name = normalize_process_name(&command);
        let role = if is_wrapper_process_name(&normalized_name) {
            "agent".to_string()
        } else if !has_dev_server {
            has_dev_server = true;
            "dev-server".to_string()
        } else {
            "service".to_string()
        };

        let base_label = match role.as_str() {
            "agent" => "agent",
            "dev-server" => "dev",
            _ => "process",
        };
        let label = next_unique_process_label(base_label, &mut used_labels);
        seen_commands.insert(command.clone());
        resolved.insert(label, ProcessEntrySnapshot { command, role });
    }

    resolved
}

fn default_startup_commands() -> Vec<String> {
    vec![DEFAULT_STARTUP_COMMAND.to_string()]
}

fn default_processes_map(agent_command: &str) -> HashMap<String, ProcessEntrySnapshot> {
    let mut map = HashMap::new();
    map.insert(
        "dev".to_string(),
        ProcessEntrySnapshot {
            command: DEFAULT_STARTUP_COMMAND.to_string(),
            role: "dev-server".to_string(),
        },
    );
    map.insert(
        "agent".to_string(),
        ProcessEntrySnapshot {
            command: agent_command.to_string(),
            role: "agent".to_string(),
        },
    );
    map
}

fn is_runtime_port_in_range(port: u16) -> bool {
    (PORT_RANGE_START..=PORT_RANGE_END).contains(&port)
}

fn read_project_config(project_dir: &Path) -> ProjectConfigLookup {
    maybe_migrate_legacy_project_config(project_dir);
    let config_path = project_config_path(project_dir);
    read_project_config_from_path(&config_path)
}

fn extract_runtime_port_from_raw_config(project_dir: &Path) -> Option<u16> {
    let config_path = project_config_path(project_dir);
    let raw = std::fs::read_to_string(config_path).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let port_u64 = parsed.get("runtime")?.get("port")?.as_u64()?;
    let port = u16::try_from(port_u64).ok()?;
    if is_runtime_port_in_range(port) {
        Some(port)
    } else {
        None
    }
}

fn collect_runtime_port_claims(weekend_root: &Path) -> Result<HashMap<u16, Vec<String>>, String> {
    let mut claims: HashMap<u16, Vec<String>> = HashMap::new();
    if !weekend_root.exists() {
        return Ok(claims);
    }

    let entries = std::fs::read_dir(weekend_root)
        .map_err(|error| format!("failed to read ~/.weekend: {error}"))?;

    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }

        let project_name = match entry.file_name().into_string() {
            Ok(name) => name,
            Err(_) => continue,
        };
        if is_reserved_root_entry(&project_name) || !is_safe_project_name(&project_name) {
            continue;
        }

        let project_dir = entry.path();
        let claimed_port = match read_project_config(&project_dir) {
            ProjectConfigLookup::Valid(config) => config.runtime.port,
            ProjectConfigLookup::Missing => None,
            ProjectConfigLookup::Invalid(error) => {
                log_backend(
                    "WARN",
                    format!(
                        "ignoring invalid {PROJECT_CONFIG_FILE_NAME} for project={project_name}: {error}"
                    ),
                );
                extract_runtime_port_from_raw_config(&project_dir)
            }
        };

        let Some(port) = claimed_port else {
            continue;
        };
        let owners = claims.entry(port).or_default();
        if owners.iter().any(|owner| owner == &project_name) {
            continue;
        }
        owners.push(project_name);
        owners.sort_unstable();
    }

    Ok(claims)
}

fn is_localhost_tcp_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

fn validate_runtime_port_available_for_project(
    weekend_root: &Path,
    project_name: &str,
    port: u16,
) -> Result<(), String> {
    let claims = collect_runtime_port_claims(weekend_root)?;
    let Some(owners) = claims.get(&port) else {
        return Ok(());
    };

    let mut conflicting_projects: Vec<String> = owners
        .iter()
        .filter(|owner| owner.as_str() != project_name)
        .cloned()
        .collect();
    conflicting_projects.sort_unstable();
    conflicting_projects.dedup();

    if conflicting_projects.is_empty() {
        return Ok(());
    }

    let owner = conflicting_projects[0].clone();
    Err(format!(
        "runtime.port {port} is already assigned to project '{owner}'"
    ))
}

fn stable_project_hash(input: &str) -> u64 {
    let mut hash: u64 = 1469598103934665603;
    for byte in input.bytes() {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(1099511628211);
    }
    hash
}

fn allocate_deterministic_project_port(
    weekend_root: &Path,
    project_name: &str,
) -> Result<u16, String> {
    let claims = collect_runtime_port_claims(weekend_root)?;
    let used_ports: HashSet<u16> = claims.keys().copied().collect();
    let range_size = usize::from(PORT_RANGE_END - PORT_RANGE_START + 1);

    if used_ports.len() >= range_size {
        return Err(format!(
            "no available ports in range {PORT_RANGE_START}-{PORT_RANGE_END}"
        ));
    }

    let seed = stable_project_hash(project_name);
    let start_offset = (seed % u64::try_from(range_size).unwrap_or(1)) as usize;

    for offset in 0..range_size {
        let index = (start_offset + offset) % range_size;
        let candidate = PORT_RANGE_START + u16::try_from(index).unwrap_or(0);
        if !used_ports.contains(&candidate) && is_localhost_tcp_port_available(candidate) {
            return Ok(candidate);
        }
    }

    Err(format!(
        "no available ports in range {PORT_RANGE_START}-{PORT_RANGE_END}"
    ))
}

fn write_project_config(
    project_dir: &Path,
    host: &str,
    port: Option<u16>,
    startup_commands: &[String],
    processes: Option<&HashMap<String, ProcessEntrySnapshot>>,
    archived: bool,
) -> Result<PathBuf, String> {
    let config = ProjectConfig {
        runtime: ProjectRuntimeConfig {
            host: host.to_string(),
            port,
        },
        startup: ProjectStartupConfig {
            commands: normalize_startup_commands(startup_commands),
        },
        processes: processes.map(|procs| {
            procs
                .iter()
                .map(|(key, entry)| {
                    (
                        key.clone(),
                        ProcessEntry {
                            command: entry.command.clone(),
                            role: entry.role.clone(),
                        },
                    )
                })
                .collect()
        }),
        archived,
    };
    let serialized = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("failed to serialize {PROJECT_CONFIG_FILE_NAME}: {error}"))?;
    let config_path = project_config_path(project_dir);
    if config_path.exists() {
        let metadata = std::fs::metadata(&config_path).map_err(|error| {
            format!("failed to read {} metadata: {error}", config_path.display())
        })?;
        let mut permissions = metadata.permissions();
        if permissions.readonly() {
            permissions.set_readonly(false);
            std::fs::set_permissions(&config_path, permissions).map_err(|error| {
                format!(
                    "failed to make {} writable before update: {error}",
                    config_path.display()
                )
            })?;
        }
    }
    std::fs::write(&config_path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", config_path.display()))?;
    Ok(config_path)
}

fn seed_agent_runtime_guidance_files(project_dir: &Path) -> Result<(), String> {
    let claude_path = project_dir.join(PROJECT_CLAUDE_FILE_NAME);
    std::fs::write(&claude_path, PROJECT_AGENT_RUNTIME_GUIDANCE)
        .map_err(|error| format!("failed to write {}: {error}", claude_path.display()))?;

    let agents_path = project_dir.join(PROJECT_AGENTS_FILE_NAME);
    std::fs::write(&agents_path, PROJECT_AGENT_RUNTIME_GUIDANCE)
        .map_err(|error| format!("failed to write {}: {error}", agents_path.display()))?;

    seed_mcp_json(project_dir)?;

    Ok(())
}

fn seed_mcp_json(project_dir: &Path) -> Result<(), String> {
    let mcp_path = project_dir.join(".mcp.json");
    let binary_path = resolve_mcp_binary_path();
    let content = serde_json::json!({
        "mcpServers": {
            "weekend-browser": {
                "command": binary_path,
                "args": []
            }
        }
    });
    let serialized = serde_json::to_string_pretty(&content)
        .map_err(|error| format!("failed to serialize .mcp.json: {error}"))?;
    std::fs::write(&mcp_path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", mcp_path.display()))?;
    Ok(())
}

fn init_git_repo(project_dir: &Path) -> Result<(), String> {
    let gitignore_content = "\
# dependencies
node_modules/
.pnpm-store/

# build output
dist/
build/
out/
.next/
.nuxt/
.output/
.svelte-kit/
target/

# environment & secrets
.env
.env.*
!.env.example

# editor & OS
.DS_Store
Thumbs.db
*.swp
*.swo
*~
.idea/
.vscode/
*.code-workspace

# logs
*.log
logs/

# test & coverage
coverage/
.nyc_output/

# misc
*.tgz
.cache/
.turbo/
.parcel-cache/
.vercel/
";

    let gitignore_path = project_dir.join(PROJECT_GITIGNORE_FILE_NAME);
    std::fs::write(&gitignore_path, gitignore_content)
        .map_err(|error| format!("failed to write {}: {error}", gitignore_path.display()))?;

    let status = std::process::Command::new("git")
        .args(["init"])
        .current_dir(project_dir)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();

    match status {
        Ok(s) if s.success() => {
            log_backend(
                "INFO",
                format!("initialized git repo in {}", project_dir.display()),
            );
        }
        Ok(s) => {
            log_backend(
                "WARN",
                format!(
                    "git init exited with status {} in {}",
                    s,
                    project_dir.display()
                ),
            );
        }
        Err(error) => {
            log_backend(
                "WARN",
                format!("git not available, skipping repo init: {error}"),
            );
        }
    }

    Ok(())
}

fn resolve_mcp_binary_path() -> String {
    const BINARY_NAME: &str = "weekend-browser-mcp";

    // Primary: sibling of the running executable.
    // In dev: both binaries land in target/debug/.
    // In production: the Tauri bundle places the sidecar next to the app binary.
    if let Ok(exe) = std::env::current_exe() {
        // Resolve symlinks so we get the real directory
        let exe = exe.canonicalize().unwrap_or(exe);
        if let Some(dir) = exe.parent() {
            let candidate = dir.join(BINARY_NAME);
            if candidate.exists() {
                return candidate.display().to_string();
            }

            // Tauri sidecar convention: binary-<target-triple> (e.g., weekend-browser-mcp-aarch64-apple-darwin)
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let name = entry.file_name();
                    let name_str = name.to_string_lossy();
                    if name_str.starts_with(&format!("{BINARY_NAME}-")) && !name_str.ends_with(".d")
                    {
                        return entry.path().display().to_string();
                    }
                }
            }
        }
    }

    // Fallback: just use the binary name and rely on PATH
    BINARY_NAME.to_string()
}

fn sanitize_project_name(input: &str) -> String {
    let mut out = String::new();
    let mut last_was_sep = false;

    for ch in input.trim().chars() {
        let keep = ch.is_ascii_alphanumeric() || ch == '-' || ch == '_';
        let make_sep = ch.is_ascii_whitespace();

        if keep {
            out.push(ch.to_ascii_lowercase());
            last_was_sep = false;
        } else if make_sep && !last_was_sep {
            out.push('-');
            last_was_sep = true;
        }
    }

    out.trim_matches('-').to_string()
}

fn is_safe_project_name(name: &str) -> bool {
    !(name.is_empty() || name.contains('/') || name.contains('\\') || name.contains(".."))
}

fn resolve_project_dir(project: &str) -> Result<PathBuf, String> {
    let project_name = project.trim();
    if project_name.is_empty() {
        return Err("project name is required".to_string());
    }

    if !is_safe_project_name(project_name) {
        return Err("invalid project name".to_string());
    }

    let root = weekend_root()?;
    std::fs::create_dir_all(&root)
        .map_err(|error| format!("failed to create ~/.weekend: {error}"))?;

    let path = root.join(project_name);
    if !path.exists() || !path.is_dir() {
        return Err(format!(
            "project directory does not exist: {}",
            path.display()
        ));
    }

    Ok(path)
}

fn sanitize_project_relative_path(path: &str) -> Result<String, String> {
    let sanitized = path.trim().replace('\\', "/");
    if sanitized.is_empty() {
        return Err("path is required".to_string());
    }
    if sanitized.starts_with('/') {
        return Err("absolute paths are not allowed".to_string());
    }
    if sanitized
        .split('/')
        .any(|segment| segment.is_empty() || segment == "." || segment == "..")
    {
        return Err("invalid path".to_string());
    }
    Ok(sanitized)
}

fn sanitize_project_file_name(file_name: &str) -> Result<String, String> {
    let trimmed = file_name.trim();
    if trimmed.is_empty() {
        return Err("file name is required".to_string());
    }
    let normalized = Path::new(trimmed)
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .ok_or_else(|| format!("invalid file name: {trimmed}"))?;
    if normalized.is_empty() || matches!(normalized, "." | "..") {
        return Err(format!("invalid file name: {trimmed}"));
    }
    if normalized.contains('/') || normalized.contains('\\') {
        return Err(format!("invalid file name: {trimmed}"));
    }
    Ok(normalized.to_string())
}

fn resolve_project_target_dir(
    project_dir: &Path,
    target_dir: Option<String>,
) -> Result<PathBuf, String> {
    let Some(raw_target) = target_dir else {
        return Ok(project_dir.to_path_buf());
    };
    if raw_target.trim().is_empty() {
        return Ok(project_dir.to_path_buf());
    }

    let sanitized = sanitize_project_relative_path(&raw_target)?;
    let resolved = project_dir.join(&sanitized);
    let canonical_project_dir = project_dir
        .canonicalize()
        .unwrap_or_else(|_| project_dir.to_path_buf());
    let canonical = resolved
        .canonicalize()
        .map_err(|error| format!("cannot resolve target directory {sanitized}: {error}"))?;
    if !canonical.starts_with(&canonical_project_dir) {
        return Err("target directory is outside project directory".to_string());
    }
    if !canonical.is_dir() {
        return Err(format!("target directory does not exist: {sanitized}"));
    }
    Ok(resolved)
}

fn move_file_with_fallback(source: &Path, target: &Path) -> Result<(), String> {
    match std::fs::rename(source, target) {
        Ok(()) => Ok(()),
        Err(rename_error) if rename_error.raw_os_error() == Some(18) => {
            std::fs::copy(source, target).map_err(|error| {
                format!(
                    "failed to move {} to {}: {error}",
                    source.display(),
                    target.display()
                )
            })?;
            std::fs::remove_file(source).map_err(|error| {
                let _ = std::fs::remove_file(target);
                format!(
                    "failed to remove original {} after copy: {error}",
                    source.display()
                )
            })?;
            Ok(())
        }
        Err(error) => Err(format!(
            "failed to move {} to {}: {error}",
            source.display(),
            target.display()
        )),
    }
}

fn resolve_existing_project_path(project_dir: &Path, path: &str) -> Result<PathBuf, String> {
    let sanitized = sanitize_project_relative_path(path)?;
    let resolved = project_dir.join(&sanitized);
    let canonical = resolved
        .canonicalize()
        .map_err(|error| format!("cannot resolve path {sanitized}: {error}"))?;
    if !canonical.starts_with(project_dir) {
        return Err("path is outside project directory".to_string());
    }
    if canonical == *project_dir {
        return Err("project root cannot be modified".to_string());
    }
    Ok(canonical)
}

fn resolve_terminal_working_dir(project: Option<&str>) -> Result<PathBuf, String> {
    let root = weekend_root()?;
    std::fs::create_dir_all(&root)
        .map_err(|error| format!("failed to create ~/.weekend: {error}"))?;

    let Some(project_name) = project.map(str::trim) else {
        return Ok(root);
    };

    if project_name.is_empty() {
        return Ok(root);
    }

    resolve_project_dir(project_name)
}

fn shell_path() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
}

#[tauri::command]
fn shell_name() -> String {
    let shell = shell_path();
    Path::new(&shell)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("zsh")
        .to_string()
}

#[derive(Debug, Clone)]
struct PsProcessEntry {
    pid: i32,
    ppid: i32,
    command: String,
}

fn normalize_process_name(command: &str) -> String {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return "shell".to_string();
    }
    let base = Path::new(trimmed)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(trimmed);
    base.strip_suffix(".exe").unwrap_or(base).to_string()
}

fn is_shell_process_name(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "shell" | "sh" | "bash" | "zsh" | "fish" | "pwsh" | "powershell" | "nu" | "nushell" | "cmd"
    )
}

/// CLI tools that spawn child processes (node, npm, etc.) as implementation
/// details. When one of these is found, prefer it over its descendants.
fn is_wrapper_process_name(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "claude" | "cursor" | "aider" | "copilot"
    )
}

fn humanize_process_name(raw: &str) -> String {
    let normalized = normalize_process_name(raw);
    if normalized.is_empty() {
        return "Shell".to_string();
    }
    let lower = normalized.to_ascii_lowercase();
    let known = match lower.as_str() {
        "bash" => "Bash Shell",
        "cmd" => "Command Prompt",
        "fish" => "Fish Shell",
        "nu" | "nushell" => "Nushell",
        "powershell" | "pwsh" => "PowerShell",
        "sh" => "Shell",
        "xonsh" => "Xonsh Shell",
        "zsh" => "Zsh Shell",
        "node" => "Node.js",
        "python" | "python3" => "Python",
        "ruby" => "Ruby",
        "cargo" => "Cargo",
        "rustc" => "Rust Compiler",
        "go" => "Go",
        "java" => "Java",
        "deno" => "Deno",
        "bun" => "Bun",
        "vim" | "nvim" => "Vim",
        "nano" => "Nano",
        "git" => "Git",
        "npm" => "npm",
        "pnpm" => "pnpm",
        "yarn" => "Yarn",
        "make" => "Make",
        "docker" => "Docker",
        "claude" => "Claude",
        "cursor" => "Cursor",
        "aider" => "Aider",
        "copilot" => "Copilot",
        _ => "",
    };
    if !known.is_empty() {
        return known.to_string();
    }
    // Title-case the name and append "Shell" if it looks like one
    let titled = normalized
        .replace(|c: char| c == '_' || c == '-', " ")
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => {
                    let upper: String = first.to_uppercase().collect();
                    upper + &chars.as_str().to_lowercase()
                }
            }
        })
        .collect::<Vec<_>>()
        .join(" ");
    if titled.is_empty() {
        return "Shell".to_string();
    }
    if is_shell_process_name(&normalized) {
        format!("{titled} Shell")
    } else {
        titled
    }
}

fn parse_ps_process_entries(raw: &str) -> Vec<PsProcessEntry> {
    let mut entries = Vec::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let mut parts = trimmed.split_whitespace();
        let Some(pid_raw) = parts.next() else {
            continue;
        };
        let Some(ppid_raw) = parts.next() else {
            continue;
        };
        let pid = match pid_raw.parse::<i32>() {
            Ok(value) if value > 0 => value,
            _ => continue,
        };
        let ppid = match ppid_raw.parse::<i32>() {
            Ok(value) if value >= 0 => value,
            _ => continue,
        };
        let command = parts.collect::<Vec<_>>().join(" ");
        if command.is_empty() {
            continue;
        }
        entries.push(PsProcessEntry { pid, ppid, command });
    }
    entries
}

fn collect_descendants_by_depth(
    root_pid: i32,
    child_pids_by_parent: &HashMap<i32, Vec<i32>>,
) -> Vec<(i32, usize)> {
    let mut descendants = Vec::new();
    let mut stack = vec![(root_pid, 0usize)];
    let mut visited = HashSet::new();
    visited.insert(root_pid);

    while let Some((pid, depth)) = stack.pop() {
        let Some(children) = child_pids_by_parent.get(&pid) else {
            continue;
        };
        for child_pid in children {
            if !visited.insert(*child_pid) {
                continue;
            }
            let next_depth = depth + 1;
            descendants.push((*child_pid, next_depth));
            stack.push((*child_pid, next_depth));
        }
    }

    descendants
}

fn login_interactive_flag(shell: &str) -> String {
    let shell_name = std::path::Path::new(shell)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();

    if shell_name.contains("fish") {
        "-i".to_string()
    } else {
        "-il".to_string()
    }
}

fn terminal_debug_enabled() -> bool {
    std::env::var("WEEKEND_TERMINAL_DEBUG")
        .ok()
        .map(|raw| {
            let normalized = raw.trim().to_ascii_lowercase();
            matches!(normalized.as_str(), "1" | "true" | "yes" | "on")
        })
        .unwrap_or(false)
}

fn decode_utf8_stream_chunk(pending_utf8: &mut Vec<u8>, incoming: &[u8]) -> (String, usize) {
    if !incoming.is_empty() {
        pending_utf8.extend_from_slice(incoming);
    }

    let mut decoded = String::new();
    let mut replacement_count = 0usize;

    loop {
        match std::str::from_utf8(pending_utf8.as_slice()) {
            Ok(valid) => {
                decoded.push_str(valid);
                pending_utf8.clear();
                break;
            }
            Err(error) => {
                let valid_up_to = error.valid_up_to();
                let error_len = error.error_len();

                if valid_up_to > 0 {
                    if let Ok(valid_prefix) = std::str::from_utf8(&pending_utf8[..valid_up_to]) {
                        decoded.push_str(valid_prefix);
                    }
                    pending_utf8.drain(..valid_up_to);
                }

                match error_len {
                    Some(len) => {
                        replacement_count += 1;
                        decoded.push('\u{FFFD}');
                        let drop_len = len.min(pending_utf8.len());
                        if drop_len == 0 {
                            break;
                        }
                        pending_utf8.drain(..drop_len);
                    }
                    None => {
                        // Incomplete multi-byte sequence; keep trailing bytes
                        // buffered for the next PTY read.
                        break;
                    }
                }
            }
        }
    }

    (decoded, replacement_count)
}

fn spawn_terminal_reader<R: Runtime>(
    app: AppHandle<R>,
    terminal_id: String,
    mut reader: Box<dyn Read + Send>,
    sessions: Arc<Mutex<HashMap<String, Arc<TerminalSession>>>>,
    session_info: Arc<Mutex<HashMap<String, TerminalSessionInfo>>>,
) {
    std::thread::spawn(move || {
        let mut read_buffer = [0u8; 8192];
        let mut pending_utf8 = Vec::new();
        let mut seq: u64 = 0;
        let mut replacement_total = 0usize;
        let debug_enabled = terminal_debug_enabled();

        loop {
            match reader.read(&mut read_buffer) {
                Ok(0) => break,
                Ok(count) => {
                    let (data, replacement_count) =
                        decode_utf8_stream_chunk(&mut pending_utf8, &read_buffer[..count]);
                    replacement_total += replacement_count;
                    if data.is_empty() {
                        continue;
                    }
                    seq = seq.saturating_add(1);
                    let payload = TerminalOutputPayload {
                        terminal_id: terminal_id.clone(),
                        seq,
                        data,
                    };
                    let _ = app.emit("terminal-output", payload);
                }
                Err(_) => break,
            }
        }

        if !pending_utf8.is_empty() {
            let data = String::from_utf8_lossy(&pending_utf8).to_string();
            if !data.is_empty() {
                seq = seq.saturating_add(1);
                let payload = TerminalOutputPayload {
                    terminal_id: terminal_id.clone(),
                    seq,
                    data,
                };
                let _ = app.emit("terminal-output", payload);
            }
            pending_utf8.clear();
        }

        if debug_enabled && replacement_total > 0 {
            log_backend(
                "WARN",
                format!(
                    "terminal reader utf8 replacements terminal_id={} replacements={replacement_total}",
                    terminal_id
                ),
            );
        }

        if let Ok(mut map) = sessions.lock() {
            map.remove(&terminal_id);
        }

        // Mark session as exited and emit event (only if not already removed
        // by terminal_remove_session — avoids ghost re-add race condition)
        if let Ok(mut info_map) = session_info.lock() {
            if let Some(info) = info_map.get_mut(&terminal_id) {
                if info.status != "exited" {
                    info.status = "exited".to_string();
                    info.has_active_process = false;
                    info.foreground_process_name = None;
                    emit_session_changed(&app, info);
                }
            }
        }
    });
}

const MAX_TREE_DEPTH: usize = 10;
const MAX_DIR_ENTRIES: usize = 1000;

fn sort_tree_nodes(nodes: &mut [ProjectTreeNode]) {
    nodes.sort_by(|left, right| match (left.is_dir, right.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => left.name.to_lowercase().cmp(&right.name.to_lowercase()),
    });
}

fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn build_project_tree(
    root: &Path,
    current: &Path,
    depth: usize,
) -> Result<Vec<ProjectTreeNode>, String> {
    if depth > MAX_TREE_DEPTH {
        return Ok(Vec::new());
    }

    let mut nodes = Vec::new();
    let read_dir = std::fs::read_dir(current)
        .map_err(|error| format!("failed to read {}: {error}", current.display()))?;

    for entry in read_dir.flatten().take(MAX_DIR_ENTRIES) {
        let file_name = match entry.file_name().into_string() {
            Ok(name) => name,
            Err(_) => continue,
        };
        let file_type = match entry.file_type() {
            Ok(kind) => kind,
            Err(_) => continue,
        };
        let path = entry.path();
        let is_dir = file_type.is_dir();
        if is_dir && is_runtime_noise_dir_name(&file_name) {
            continue;
        }
        let children = if is_dir {
            build_project_tree(root, &path, depth + 1)?
        } else {
            Vec::new()
        };

        nodes.push(ProjectTreeNode {
            name: file_name,
            path: relative_path(root, &path),
            is_dir,
            children,
        });
    }

    sort_tree_nodes(&mut nodes);
    Ok(nodes)
}

fn should_emit_project_tree_change(kind: &EventKind) -> bool {
    matches!(
        kind,
        EventKind::Any | EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
    )
}

fn is_reserved_root_entry(name: &str) -> bool {
    matches!(name, "logs" | SHARED_ASSETS_ROOT_DIR_NAME)
}

const RUNTIME_NOISE_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".cache",
    ".vite",
    "target",
    ".turbo",
];

fn is_runtime_noise_dir_name(segment: &str) -> bool {
    RUNTIME_NOISE_DIRS.contains(&segment)
}

fn should_ignore_runtime_noise_path(relative: &Path) -> bool {
    let mut components = relative.components();
    let _project = components.next();

    components.any(|component| match component {
        std::path::Component::Normal(name) => {
            let segment = name.to_string_lossy();
            is_runtime_noise_dir_name(segment.as_ref())
        }
        _ => false,
    })
}

fn is_transient_project_file_name(name: &str) -> bool {
    name.eq_ignore_ascii_case(LEGACY_PROJECT_CONFIG_FILE_NAME)
        || name.eq_ignore_ascii_case("weekend.config.from-aios.backup.json")
        || name.ends_with(".from-aios.backup.json")
}

fn should_ignore_transient_project_path(relative: &Path) -> bool {
    let mut components = relative.components();
    let _project = components.next();

    components.any(|component| match component {
        std::path::Component::Normal(name) => {
            let segment = name.to_string_lossy();
            is_transient_project_file_name(segment.as_ref())
        }
        _ => false,
    })
}

#[derive(Clone)]
struct GitignoreRule {
    pattern: String,
    negated: bool,
    directory_only: bool,
}

#[derive(Clone)]
struct ProjectGitignore {
    rules: Vec<GitignoreRule>,
}

impl ProjectGitignore {
    fn parse(contents: &str) -> Self {
        let mut rules = Vec::new();

        for line in contents.lines() {
            let mut raw = line.trim();
            if raw.is_empty() || raw.starts_with('#') {
                continue;
            }

            let mut negated = false;
            if let Some(rest) = raw.strip_prefix('!') {
                negated = true;
                raw = rest.trim();
            }

            if raw.is_empty() {
                continue;
            }

            let directory_only = raw.ends_with('/');
            let pattern = raw
                .trim_start_matches("./")
                .trim_end_matches('/')
                .replace('\\', "/");
            if pattern.is_empty() {
                continue;
            }

            rules.push(GitignoreRule {
                pattern,
                negated,
                directory_only,
            });
        }

        Self { rules }
    }

    fn is_ignored(&self, relative_in_project: &Path) -> bool {
        let candidate = relative_in_project.to_string_lossy().replace('\\', "/");
        if candidate.is_empty() {
            return false;
        }

        let mut ignored = false;
        for rule in &self.rules {
            if rule_matches_path(rule, &candidate) {
                ignored = !rule.negated;
            }
        }
        ignored
    }
}

fn simple_glob_match(pattern: &str, text: &str) -> bool {
    let pattern_chars: Vec<char> = pattern.chars().collect();
    let text_chars: Vec<char> = text.chars().collect();
    let mut dp = vec![vec![false; text_chars.len() + 1]; pattern_chars.len() + 1];
    dp[0][0] = true;

    for i in 1..=pattern_chars.len() {
        if pattern_chars[i - 1] == '*' {
            dp[i][0] = dp[i - 1][0];
        }
    }

    for i in 1..=pattern_chars.len() {
        for j in 1..=text_chars.len() {
            let p = pattern_chars[i - 1];
            let t = text_chars[j - 1];
            dp[i][j] = match p {
                '*' => dp[i - 1][j] || dp[i][j - 1],
                '?' => dp[i - 1][j - 1],
                _ => dp[i - 1][j - 1] && p == t,
            };
        }
    }

    dp[pattern_chars.len()][text_chars.len()]
}

fn rule_matches_non_directory_path(pattern: &str, relative: &str) -> bool {
    let anchored = pattern.starts_with('/');
    let normalized = pattern.trim_start_matches('/');
    let has_slash = normalized.contains('/');
    let has_glob = normalized.contains('*') || normalized.contains('?');

    if has_glob {
        if has_slash || anchored {
            return simple_glob_match(normalized, relative);
        }
        return relative
            .split('/')
            .any(|segment| simple_glob_match(normalized, segment));
    }

    if has_slash || anchored {
        relative == normalized || relative.starts_with(&format!("{normalized}/"))
    } else {
        relative
            .split('/')
            .any(|segment| segment == normalized || relative == normalized)
    }
}

fn rule_matches_path(rule: &GitignoreRule, relative: &str) -> bool {
    if rule.directory_only {
        let mut prefix = String::new();
        for segment in relative.split('/') {
            if segment.is_empty() {
                continue;
            }
            if !prefix.is_empty() {
                prefix.push('/');
            }
            prefix.push_str(segment);
            if rule_matches_non_directory_path(&rule.pattern, &prefix) {
                return true;
            }
        }
        return false;
    }

    rule_matches_non_directory_path(&rule.pattern, relative)
}

fn build_project_gitignore(project_dir: &Path) -> Option<ProjectGitignore> {
    let gitignore_path = project_dir.join(".gitignore");
    if !gitignore_path.exists() {
        return None;
    }

    match std::fs::read_to_string(&gitignore_path) {
        Ok(contents) => Some(ProjectGitignore::parse(&contents)),
        Err(error) => {
            log_backend(
                "WARN",
                format!(
                    "failed to read .gitignore for {}: {error}",
                    project_dir.display()
                ),
            );
            None
        }
    }
}

fn path_contains_gitignore(relative_in_project: &Path) -> bool {
    relative_in_project
        .components()
        .any(|component| match component {
            std::path::Component::Normal(name) => name.to_string_lossy() == ".gitignore",
            _ => false,
        })
}

fn should_ignore_by_project_gitignore(
    project_root: &Path,
    project: &str,
    relative_in_project: &Path,
    cache: &mut HashMap<String, Option<ProjectGitignore>>,
) -> bool {
    if relative_in_project.as_os_str().is_empty() {
        return false;
    }

    let matcher_entry = cache.entry(project.to_string()).or_insert_with(|| {
        let project_dir = project_root.join(project);
        build_project_gitignore(&project_dir)
    });

    let Some(matcher) = matcher_entry.as_ref() else {
        return false;
    };

    matcher.is_ignored(relative_in_project)
}

fn extract_project_change_candidates(
    watched_roots: &[PathBuf],
    paths: &[PathBuf],
) -> Vec<(String, PathBuf)> {
    paths
        .iter()
        .filter_map(|path| {
            let relative = watched_roots
                .iter()
                .find_map(|root| path.strip_prefix(root).ok())?;

            if should_ignore_runtime_noise_path(relative) {
                return None;
            }
            if should_ignore_transient_project_path(relative) {
                return None;
            }

            let mut components = relative.components();
            let first = components.next()?;
            let std::path::Component::Normal(project_name) = first else {
                return None;
            };
            let project_name = project_name.to_str()?;
            if is_reserved_root_entry(project_name) {
                return None;
            }
            if !is_safe_project_name(project_name) {
                return None;
            }

            let relative_in_project = components.as_path().to_path_buf();
            if relative_in_project.as_os_str().is_empty() {
                return None;
            }

            Some((project_name.to_string(), relative_in_project))
        })
        .collect()
}

#[cfg(test)]
fn extract_projects_from_event_paths(watched_roots: &[PathBuf], paths: &[PathBuf]) -> Vec<String> {
    let mut projects: Vec<String> = extract_project_change_candidates(watched_roots, paths)
        .into_iter()
        .map(|(project, _)| project)
        .collect();

    projects.sort_unstable();
    projects.dedup();
    projects
}

#[cfg(test)]
mod project_file_import_tests {
    use super::{resolve_project_target_dir, sanitize_project_file_name};
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn make_temp_dir(prefix: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("{prefix}-{unique}"));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn sanitize_project_file_name_uses_basename() {
        let file_name = sanitize_project_file_name("Desktop/screenshot.png").expect("sanitize");
        assert_eq!(file_name, "screenshot.png");
    }

    #[test]
    fn sanitize_project_file_name_rejects_invalid_names() {
        assert!(sanitize_project_file_name("").is_err());
        assert!(sanitize_project_file_name(".").is_err());
        assert!(sanitize_project_file_name("..").is_err());
    }

    #[test]
    fn resolve_project_target_dir_handles_root_and_nested_targets() {
        let project_dir = make_temp_dir("weekend-project-target-dir");
        let nested = project_dir.join("assets");
        std::fs::create_dir_all(&nested).expect("create nested target");

        let root_target =
            resolve_project_target_dir(&project_dir, None).expect("resolve project root target");
        let nested_target = resolve_project_target_dir(&project_dir, Some("assets".to_string()))
            .expect("resolve nested target");
        let missing_target = resolve_project_target_dir(&project_dir, Some("missing".to_string()));

        let _ = std::fs::remove_dir_all(&project_dir);

        assert_eq!(root_target, project_dir);
        assert_eq!(nested_target, nested);
        assert!(missing_target.is_err());
    }
}

#[cfg(test)]
mod watcher_tests {
    use super::build_project_tree;
    use super::extract_projects_from_event_paths;
    use super::should_ignore_by_project_gitignore;
    use std::collections::HashMap;
    use std::path::Path;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn extracts_project_from_primary_watched_root() {
        let watched_roots = vec![PathBuf::from("/home/user/.weekend")];
        let changed_paths = vec![PathBuf::from("/home/user/.weekend/sandbox/index.html")];

        let projects = extract_projects_from_event_paths(&watched_roots, &changed_paths);

        assert_eq!(projects, vec!["sandbox".to_string()]);
    }

    #[test]
    fn extracts_project_from_alternate_watched_root_alias() {
        let watched_roots = vec![
            PathBuf::from("/home/user/.weekend"),
            PathBuf::from("/mnt/storage/weekend-projects"),
        ];
        let changed_paths = vec![PathBuf::from(
            "/mnt/storage/weekend-projects/sandbox/index.html",
        )];

        let projects = extract_projects_from_event_paths(&watched_roots, &changed_paths);

        assert_eq!(projects, vec!["sandbox".to_string()]);
    }

    #[test]
    fn deduplicates_projects_from_multiple_changed_files() {
        let watched_roots = vec![PathBuf::from("/home/user/.weekend")];
        let changed_paths = vec![
            PathBuf::from("/home/user/.weekend/sandbox/index.html"),
            PathBuf::from("/home/user/.weekend/sandbox/style.css"),
        ];

        let projects = extract_projects_from_event_paths(&watched_roots, &changed_paths);

        assert_eq!(projects, vec!["sandbox".to_string()]);
    }

    #[test]
    fn ignores_runtime_noise_paths() {
        let watched_roots = vec![PathBuf::from("/home/user/.weekend")];
        let changed_paths = vec![
            PathBuf::from("/home/user/.weekend/sandbox/node_modules/.vite/deps/chunk.js"),
            PathBuf::from("/home/user/.weekend/sandbox/dist/assets/index.js"),
            PathBuf::from("/home/user/.weekend/sandbox/src/main.ts"),
        ];

        let projects = extract_projects_from_event_paths(&watched_roots, &changed_paths);

        assert_eq!(projects, vec!["sandbox".to_string()]);
    }

    #[test]
    fn ignores_reserved_root_entries() {
        let watched_roots = vec![PathBuf::from("/home/user/.weekend")];
        let changed_paths = vec![
            PathBuf::from("/home/user/.weekend/logs/frontend.log"),
            PathBuf::from("/home/user/.weekend/logs/projects/sandbox.log"),
            PathBuf::from("/home/user/.weekend/shared-assets/logo.png"),
            PathBuf::from("/home/user/.weekend/sandbox/src/main.ts"),
        ];

        let projects = extract_projects_from_event_paths(&watched_roots, &changed_paths);

        assert_eq!(projects, vec!["sandbox".to_string()]);
    }

    #[test]
    fn ignores_root_level_non_project_files() {
        let watched_roots = vec![PathBuf::from("/home/user/.weekend")];
        let changed_paths = vec![
            PathBuf::from("/home/user/.weekend/weekend.config.from-aios.backup.json"),
            PathBuf::from("/home/user/.weekend/README.md"),
            PathBuf::from("/home/user/.weekend/sandbox/src/main.ts"),
        ];

        let projects = extract_projects_from_event_paths(&watched_roots, &changed_paths);

        assert_eq!(projects, vec!["sandbox".to_string()]);
    }

    #[test]
    fn ignores_transient_project_config_alias_files() {
        let watched_roots = vec![PathBuf::from("/home/user/.weekend")];
        let changed_paths = vec![
            PathBuf::from("/home/user/.weekend/sandbox/aios.config.json"),
            PathBuf::from("/home/user/.weekend/sandbox/weekend.config.from-aios.backup.json"),
        ];

        let projects = extract_projects_from_event_paths(&watched_roots, &changed_paths);

        assert!(projects.is_empty());
    }

    #[test]
    fn project_tree_ignores_runtime_noise_dirs() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("weekend-tree-noise-test-{unique}"));
        std::fs::create_dir_all(root.join("src")).expect("create src");
        std::fs::create_dir_all(root.join("node_modules/pkg")).expect("create node_modules");
        std::fs::create_dir_all(root.join(".next/cache")).expect("create .next");
        std::fs::write(root.join("src/main.ts"), "export {};").expect("write src");
        std::fs::write(
            root.join("node_modules/pkg/index.js"),
            "module.exports = {};",
        )
        .expect("write node_modules");
        std::fs::write(root.join(".next/cache/index.txt"), "cache").expect("write .next");

        let tree = build_project_tree(&root, &root, 0).expect("build tree");
        let names: Vec<String> = tree.iter().map(|node| node.name.clone()).collect();

        let _ = std::fs::remove_dir_all(&root);

        assert!(names.contains(&"src".to_string()));
        assert!(!names.contains(&"node_modules".to_string()));
        assert!(!names.contains(&".next".to_string()));
    }

    #[test]
    fn respects_project_gitignore_patterns() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("weekend-gitignore-test-{unique}"));
        let project = "sandbox";
        let project_dir = root.join(project);
        std::fs::create_dir_all(project_dir.join("generated")).expect("create generated");
        std::fs::create_dir_all(project_dir.join("src")).expect("create src");
        std::fs::write(project_dir.join(".gitignore"), "generated/\n*.log\n")
            .expect("write .gitignore");

        let mut cache = HashMap::new();
        let ignored_generated = should_ignore_by_project_gitignore(
            &root,
            project,
            Path::new("generated/output.js"),
            &mut cache,
        );
        let ignored_log =
            should_ignore_by_project_gitignore(&root, project, Path::new("server.log"), &mut cache);
        let ignored_src = should_ignore_by_project_gitignore(
            &root,
            project,
            Path::new("src/main.ts"),
            &mut cache,
        );

        let _ = std::fs::remove_dir_all(&root);

        assert!(ignored_generated);
        assert!(ignored_log);
        assert!(!ignored_src);
    }
}

#[cfg(test)]
mod config_tests {
    use super::{
        read_project_config, ProcessEntrySnapshot, ProjectConfigLookup,
        LEGACY_PROJECT_CONFIG_FILE_NAME, PROJECT_CONFIG_FILE_NAME,
    };
    use std::collections::HashMap;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn make_temp_project_dir(prefix: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("{prefix}-{unique}"));
        std::fs::create_dir_all(&dir).expect("create project dir");
        dir
    }

    fn write_config(project_dir: &Path, config_json: &str) {
        std::fs::write(project_dir.join(PROJECT_CONFIG_FILE_NAME), config_json)
            .expect("write config");
    }

    fn find_process_by_command<'a>(
        processes: &'a HashMap<String, ProcessEntrySnapshot>,
        command: &str,
    ) -> Option<&'a ProcessEntrySnapshot> {
        processes.values().find(|entry| entry.command == command)
    }

    #[test]
    fn merges_startup_commands_into_explicit_processes() {
        let project_dir = make_temp_project_dir("weekend-config-process-merge");
        write_config(
            &project_dir,
            r#"{
  "runtime": { "host": "127.0.0.1", "port": 8744 },
  "startup": { "commands": ["pnpm dev", "claude"] },
  "processes": {
    "dev": { "command": "pnpm dev", "role": "dev-server" }
  }
}"#,
        );

        let lookup = read_project_config(&project_dir);
        let _ = std::fs::remove_dir_all(&project_dir);

        let ProjectConfigLookup::Valid(config) = lookup else {
            panic!("expected valid config");
        };
        assert_eq!(config.processes.len(), 2);

        let dev = find_process_by_command(&config.processes, "pnpm dev")
            .expect("expected dev command in resolved processes");
        assert_eq!(dev.role, "dev-server");

        let agent = find_process_by_command(&config.processes, "claude")
            .expect("expected claude command in resolved processes");
        assert_eq!(agent.role, "agent");
    }

    #[test]
    fn expands_startup_commands_when_processes_are_missing() {
        let project_dir = make_temp_project_dir("weekend-config-startup-expand");
        write_config(
            &project_dir,
            r#"{
  "runtime": { "host": "127.0.0.1", "port": 8744 },
  "startup": { "commands": ["claude", "pnpm dev"] }
}"#,
        );

        let lookup = read_project_config(&project_dir);
        let _ = std::fs::remove_dir_all(&project_dir);

        let ProjectConfigLookup::Valid(config) = lookup else {
            panic!("expected valid config");
        };
        assert_eq!(config.processes.len(), 2);

        let agent = find_process_by_command(&config.processes, "claude")
            .expect("expected claude command in resolved processes");
        assert_eq!(agent.role, "agent");

        let dev = find_process_by_command(&config.processes, "pnpm dev")
            .expect("expected dev command in resolved processes");
        assert_eq!(dev.role, "dev-server");
    }

    #[test]
    fn migrates_legacy_config_file_name_when_canonical_is_missing() {
        let project_dir = make_temp_project_dir("weekend-config-legacy-migrate");
        std::fs::write(
            project_dir.join(LEGACY_PROJECT_CONFIG_FILE_NAME),
            r#"{
  "runtime": { "host": "127.0.0.1", "port": 8744 },
  "startup": { "commands": ["pnpm dev"] }
}"#,
        )
        .expect("write legacy config");

        let lookup = read_project_config(&project_dir);
        let canonical_exists = project_dir.join(PROJECT_CONFIG_FILE_NAME).exists();
        let legacy_exists = project_dir.join(LEGACY_PROJECT_CONFIG_FILE_NAME).exists();
        let _ = std::fs::remove_dir_all(&project_dir);

        let ProjectConfigLookup::Valid(config) = lookup else {
            panic!("expected valid config");
        };
        assert_eq!(config.runtime.port, Some(8744));
        assert!(canonical_exists);
        assert!(!legacy_exists);
    }

    #[test]
    fn promotes_legacy_config_when_canonical_is_invalid() {
        let project_dir = make_temp_project_dir("weekend-config-legacy-promote");
        write_config(
            &project_dir,
            r#"{
  "runtime": { "host": "", "port": 8744 }
}"#,
        );
        std::fs::write(
            project_dir.join(LEGACY_PROJECT_CONFIG_FILE_NAME),
            r#"{
  "runtime": { "host": "127.0.0.1", "port": 8745 },
  "startup": { "commands": ["pnpm dev"] }
}"#,
        )
        .expect("write legacy config");

        let lookup = read_project_config(&project_dir);
        let canonical_raw = std::fs::read_to_string(project_dir.join(PROJECT_CONFIG_FILE_NAME))
            .expect("read canonical");
        let legacy_exists = project_dir.join(LEGACY_PROJECT_CONFIG_FILE_NAME).exists();
        let _ = std::fs::remove_dir_all(&project_dir);

        let ProjectConfigLookup::Valid(config) = lookup else {
            panic!("expected valid config");
        };
        assert_eq!(config.runtime.port, Some(8745));
        assert!(canonical_raw.contains("\"port\": 8745"));
        assert!(!legacy_exists);
    }
}

#[cfg(test)]
mod wrapper_repair_tests {
    use super::replace_legacy_node_modules_paths;

    #[test]
    fn rewrites_single_legacy_node_modules_path() {
        let input = r#"export NODE_PATH="/Users/test/.aios/music/node_modules/.pnpm/vite@1/node_modules/vite/node_modules""#;
        let (rewritten, replacements) = replace_legacy_node_modules_paths(
            input,
            "/Users/test/.aios/",
            "/Users/test/.weekend/music/node_modules",
        );

        assert_eq!(replacements, 1);
        assert!(rewritten.contains("/Users/test/.weekend/music/node_modules/.pnpm/vite@1"));
        assert!(!rewritten.contains("/Users/test/.aios/"));
    }

    #[test]
    fn rewrites_multiple_legacy_node_modules_paths() {
        let input =
            r#"A="/Users/test/.aios/foo/node_modules/x" B="/Users/test/.aios/bar/node_modules/y""#;
        let (rewritten, replacements) = replace_legacy_node_modules_paths(
            input,
            "/Users/test/.aios/",
            "/Users/test/.weekend/target/node_modules",
        );

        assert_eq!(replacements, 2);
        assert_eq!(
            rewritten,
            r#"A="/Users/test/.weekend/target/node_modules/x" B="/Users/test/.weekend/target/node_modules/y""#
        );
    }

    #[test]
    fn leaves_content_unchanged_when_no_legacy_path_present() {
        let input = "export NODE_PATH=\"/Users/test/.weekend/music/node_modules/.pnpm\"";
        let (rewritten, replacements) = replace_legacy_node_modules_paths(
            input,
            "/Users/test/.aios/",
            "/Users/test/.weekend/music/node_modules",
        );

        assert_eq!(replacements, 0);
        assert_eq!(rewritten, input);
    }
}

#[cfg(test)]
mod port_allocation_tests {
    use super::{
        allocate_deterministic_project_port, collect_runtime_port_claims,
        validate_runtime_port_available_for_project, PROJECT_CONFIG_FILE_NAME,
    };
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn make_temp_root(prefix: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("{prefix}-{unique}"));
        std::fs::create_dir_all(&root).expect("create temp root");
        root
    }

    fn write_config(project_dir: &Path, config_json: &str) {
        std::fs::create_dir_all(project_dir).expect("create project dir");
        std::fs::write(project_dir.join(PROJECT_CONFIG_FILE_NAME), config_json)
            .expect("write config");
    }

    #[test]
    fn claims_port_from_invalid_config_when_runtime_port_is_present() {
        let root = make_temp_root("weekend-port-claims");
        write_config(
            &root.join("music"),
            r#"{
  "runtime": { "host": "", "port": 8611 }
}"#,
        );

        let claims = collect_runtime_port_claims(&root).expect("collect claims");
        let _ = std::fs::remove_dir_all(&root);

        let owners = claims.get(&8611).expect("expected claimed port");
        assert!(owners.iter().any(|owner| owner == "music"));
    }

    #[test]
    fn rejects_runtime_port_assigned_to_another_project() {
        let root = make_temp_root("weekend-port-conflict");
        write_config(
            &root.join("video"),
            r#"{
  "runtime": { "host": "127.0.0.1", "port": 8650 }
}"#,
        );
        write_config(
            &root.join("music"),
            r#"{
  "runtime": { "host": "127.0.0.1", "port": 8651 }
}"#,
        );

        let conflict =
            validate_runtime_port_available_for_project(&root, "music", 8650).unwrap_err();
        let same_project = validate_runtime_port_available_for_project(&root, "video", 8650);
        let _ = std::fs::remove_dir_all(&root);

        assert!(conflict.contains("already assigned"));
        assert!(same_project.is_ok());
    }

    #[test]
    fn allocator_skips_port_that_is_bound_on_localhost() {
        let root = make_temp_root("weekend-port-bind-skip");
        let project_name = "music";

        // Some sandboxed CI environments disallow binding localhost sockets.
        if std::net::TcpListener::bind(("127.0.0.1", 0)).is_err() {
            let _ = std::fs::remove_dir_all(&root);
            return;
        }

        let first_port =
            allocate_deterministic_project_port(&root, project_name).expect("allocate first port");
        let listener =
            std::net::TcpListener::bind(("127.0.0.1", first_port)).expect("bind first port");

        let second_port =
            allocate_deterministic_project_port(&root, project_name).expect("allocate second port");
        drop(listener);
        let _ = std::fs::remove_dir_all(&root);

        assert_ne!(first_port, second_port);
    }
}

fn spawn_project_tree_watcher<R: Runtime + 'static>(app: AppHandle<R>) {
    let root = match weekend_root() {
        Ok(path) => path,
        Err(error) => {
            log_backend(
                "ERROR",
                format!("failed to resolve ~/.weekend root for watcher: {error}"),
            );
            return;
        }
    };

    if let Err(error) = std::fs::create_dir_all(&root) {
        log_backend(
            "ERROR",
            format!("failed to create ~/.weekend for watcher: {error}"),
        );
        return;
    }

    let canonical_root = std::fs::canonicalize(&root).unwrap_or_else(|_| root.clone());
    let mut watched_roots = vec![root.clone()];
    if canonical_root != root {
        watched_roots.push(canonical_root.clone());
    }

    let project_root = canonical_root;

    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel::<notify::Result<Event>>();
        let mut watcher = match RecommendedWatcher::new(
            move |result| {
                let _ = tx.send(result);
            },
            NotifyConfig::default(),
        ) {
            Ok(watcher) => watcher,
            Err(error) => {
                log_backend(
                    "ERROR",
                    format!("failed to initialize project watcher: {error}"),
                );
                return;
            }
        };

        let mut watched_any_root = false;
        for watched_root in &watched_roots {
            match watcher.watch(watched_root, RecursiveMode::Recursive) {
                Ok(_) => watched_any_root = true,
                Err(error) => {
                    log_backend(
                        "ERROR",
                        format!("failed to watch {}: {error}", watched_root.display()),
                    );
                }
            }
        }

        if !watched_any_root {
            return;
        }

        let debounce_window = Duration::from_millis(200);
        let poll_interval = Duration::from_millis(50);
        let mut dirty_projects: HashSet<String> = HashSet::new();
        let mut last_event_by_project: HashMap<String, Instant> = HashMap::new();
        let mut gitignore_cache: HashMap<String, Option<ProjectGitignore>> = HashMap::new();

        loop {
            match rx.recv_timeout(poll_interval) {
                Ok(event_result) => {
                    let event = match event_result {
                        Ok(event) => event,
                        Err(error) => {
                            log_backend("WARN", format!("project watcher event error: {error}"));
                            continue;
                        }
                    };

                    if !should_emit_project_tree_change(&event.kind) {
                        continue;
                    }

                    let now = Instant::now();
                    for (project, relative_in_project) in
                        extract_project_change_candidates(&watched_roots, &event.paths)
                    {
                        if path_contains_gitignore(&relative_in_project) {
                            gitignore_cache.remove(&project);
                        }
                        if should_ignore_by_project_gitignore(
                            &project_root,
                            &project,
                            &relative_in_project,
                            &mut gitignore_cache,
                        ) {
                            continue;
                        }
                        dirty_projects.insert(project.clone());
                        last_event_by_project.insert(project, now);
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
            }

            if dirty_projects.is_empty() {
                continue;
            }

            let now = Instant::now();
            let ready_projects: Vec<String> = dirty_projects
                .iter()
                .filter(|project| {
                    last_event_by_project
                        .get(*project)
                        .map(|last_event| now.duration_since(*last_event) >= debounce_window)
                        .unwrap_or(false)
                })
                .cloned()
                .collect();

            for project in ready_projects {
                dirty_projects.remove(&project);
                if let Err(error) = app.emit(
                    "project-tree-changed",
                    ProjectTreeChangedPayload { project },
                ) {
                    log_backend(
                        "WARN",
                        format!("failed to emit project-tree-changed: {error}"),
                    );
                }
            }
        }
    });
}

fn backfill_mcp_configs() -> Result<(), String> {
    let root = weekend_root()?;
    if !root.exists() {
        return Ok(());
    }

    let entries =
        std::fs::read_dir(&root).map_err(|error| format!("failed to read ~/.weekend: {error}"))?;

    let mut mcp_count = 0u32;
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }

        let project_name = match entry.file_name().into_string() {
            Ok(name) => name,
            Err(_) => continue,
        };
        if is_reserved_root_entry(&project_name) || !is_safe_project_name(&project_name) {
            continue;
        }

        let project_dir = entry.path();

        // Always refresh guidance files so existing projects get latest instructions
        if let Err(error) = seed_agent_runtime_guidance_files(&project_dir) {
            log_backend(
                "WARN",
                format!("failed to refresh guidance for project={project_name}: {error}"),
            );
        }

        // Only seed .mcp.json if missing
        let mcp_path = project_dir.join(".mcp.json");
        if mcp_path.exists() {
            continue;
        }

        if let Err(error) = seed_mcp_json(&project_dir) {
            log_backend(
                "WARN",
                format!("failed to backfill .mcp.json for project={project_name}: {error}"),
            );
        } else {
            mcp_count += 1;
        }
    }

    if mcp_count > 0 {
        log_backend(
            "INFO",
            format!("backfilled .mcp.json for {mcp_count} existing project(s)"),
        );
    }
    Ok(())
}

fn backfill_shared_assets_to_projects() -> Result<(), String> {
    let root = weekend_root()?;
    std::fs::create_dir_all(&root)
        .map_err(|error| format!("failed to create ~/.weekend: {error}"))?;

    let shared_root = ensure_shared_assets_root()?;
    let shared_assets = list_shared_asset_snapshots(&shared_root)?;
    if shared_assets.is_empty() {
        return Ok(());
    }

    let synced_projects = sync_shared_assets_into_all_projects(&root, &shared_root)?;
    if synced_projects > 0 {
        log_backend(
            "INFO",
            format!("synced shared assets to {synced_projects} project(s) during startup backfill"),
        );
    }

    Ok(())
}

fn replace_legacy_node_modules_paths(
    content: &str,
    legacy_root_prefix: &str,
    replacement_node_modules: &str,
) -> (String, usize) {
    let mut rewritten = String::with_capacity(content.len());
    let mut cursor = 0usize;
    let mut replacements = 0usize;

    while let Some(relative_start) = content[cursor..].find(legacy_root_prefix) {
        let start = cursor + relative_start;
        rewritten.push_str(&content[cursor..start]);

        let project_start = start + legacy_root_prefix.len();
        let Some(node_modules_rel) = content[project_start..].find("/node_modules") else {
            rewritten.push_str(&content[start..]);
            cursor = content.len();
            break;
        };

        let node_modules_end = project_start + node_modules_rel + "/node_modules".len();
        rewritten.push_str(replacement_node_modules);
        replacements += 1;
        cursor = node_modules_end;
    }

    if cursor < content.len() {
        rewritten.push_str(&content[cursor..]);
    }

    (rewritten, replacements)
}

fn repair_project_bin_wrappers(
    project_dir: &Path,
    legacy_root_prefix: &str,
) -> Result<(usize, usize), String> {
    let bin_dir = project_dir.join("node_modules").join(".bin");
    if !bin_dir.is_dir() {
        return Ok((0, 0));
    }

    let replacement_node_modules = project_dir.join("node_modules").display().to_string();
    let mut files_changed = 0usize;
    let mut replacements = 0usize;

    let entries = std::fs::read_dir(&bin_dir)
        .map_err(|error| format!("failed to read {}: {error}", bin_dir.display()))?;
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_file() {
            continue;
        }

        let path = entry.path();
        let Ok(raw) = std::fs::read_to_string(&path) else {
            continue;
        };
        if !raw.contains(legacy_root_prefix) {
            continue;
        }

        let (rewritten, count) = replace_legacy_node_modules_paths(
            &raw,
            legacy_root_prefix,
            replacement_node_modules.as_str(),
        );
        if count == 0 || rewritten == raw {
            continue;
        }

        std::fs::write(&path, rewritten)
            .map_err(|error| format!("failed to write {}: {error}", path.display()))?;
        files_changed += 1;
        replacements += count;
    }

    Ok((files_changed, replacements))
}

fn backfill_project_bin_wrappers() -> Result<(), String> {
    let root = weekend_root()?;
    if !root.exists() {
        return Ok(());
    }

    let legacy_root = legacy_aios_root()?;
    let legacy_prefix = format!("{}/", legacy_root.display());

    let mut total_files_changed = 0usize;
    let mut total_replacements = 0usize;

    let entries =
        std::fs::read_dir(&root).map_err(|error| format!("failed to read ~/.weekend: {error}"))?;
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }

        let project_name = match entry.file_name().into_string() {
            Ok(name) => name,
            Err(_) => continue,
        };
        if is_reserved_root_entry(&project_name) || !is_safe_project_name(&project_name) {
            continue;
        }

        let project_dir = entry.path();
        let (files_changed, replacements) =
            repair_project_bin_wrappers(&project_dir, legacy_prefix.as_str())?;
        total_files_changed += files_changed;
        total_replacements += replacements;
    }

    if total_files_changed > 0 {
        log_backend(
            "INFO",
            format!(
                "repaired {total_replacements} legacy node wrapper path(s) across {total_files_changed} file(s)"
            ),
        );
    }

    Ok(())
}

fn backfill_existing_project_configs() -> Result<(), String> {
    let root = weekend_root()?;
    if !root.exists() {
        return Ok(());
    }

    let _port_guard = project_port_lock()
        .lock()
        .map_err(|_| "failed to lock project port allocator".to_string())?;

    let mut entries: Vec<(String, PathBuf)> = std::fs::read_dir(&root)
        .map_err(|error| format!("failed to read ~/.weekend: {error}"))?
        .flatten()
        .filter_map(|entry| {
            let file_type = entry.file_type().ok()?;
            if !file_type.is_dir() {
                return None;
            }
            let project_name = entry.file_name().into_string().ok()?;
            if is_reserved_root_entry(&project_name) || !is_safe_project_name(&project_name) {
                return None;
            }
            Some((project_name, entry.path()))
        })
        .collect();
    entries.sort_unstable_by(|left, right| left.0.cmp(&right.0));

    let mut seen_runtime_ports = HashSet::<u16>::new();
    for (project_name, project_dir) in entries {
        match read_project_config(&project_dir) {
            ProjectConfigLookup::Valid(config) => {
                let startup_commands = if config.startup_commands.is_empty() {
                    default_startup_commands()
                } else {
                    config.startup_commands
                };
                let procs = if config.processes.is_empty() {
                    None
                } else {
                    Some(config.processes)
                };
                let mut runtime_port = config.runtime.port;
                if let Some(port) = runtime_port {
                    if !seen_runtime_ports.insert(port) {
                        let reassigned_port =
                            allocate_deterministic_project_port(&root, &project_name)?;
                        log_backend(
                            "WARN",
                            format!(
                                "project={project_name} had duplicate runtime.port={port}; reassigning to {reassigned_port}"
                            ),
                        );
                        runtime_port = Some(reassigned_port);
                        let _ = seen_runtime_ports.insert(reassigned_port);
                    }
                }
                write_project_config(
                    &project_dir,
                    &config.runtime.host,
                    runtime_port,
                    &startup_commands,
                    procs.as_ref(),
                    config.archived,
                )?;
            }
            ProjectConfigLookup::Missing => {
                let allocated_port = allocate_deterministic_project_port(&root, &project_name)?;
                let default_procs = default_processes_map(DEFAULT_AGENT_COMMAND);
                write_project_config(
                    &project_dir,
                    DEFAULT_RUNTIME_HOST,
                    Some(allocated_port),
                    &default_startup_commands(),
                    Some(&default_procs),
                    false,
                )?;
                let _ = seen_runtime_ports.insert(allocated_port);
            }
            ProjectConfigLookup::Invalid(error) => {
                log_backend(
                    "WARN",
                    format!("skipping config backfill for project={project_name}: {error}"),
                );
            }
        }
    }

    Ok(())
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|raw| {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn validate_github_repo_url(repo_url: &str) -> Result<(), String> {
    if repo_url.chars().any(char::is_whitespace) {
        return Err("github repo URL cannot contain whitespace".to_string());
    }

    if repo_url.starts_with("https://github.com/")
        || repo_url.starts_with("http://github.com/")
        || repo_url.starts_with("git@github.com:")
    {
        return Ok(());
    }

    Err("github repo URL must start with https://github.com/ or git@github.com:".to_string())
}

fn clone_github_repo(repo_url: &str, target_dir: &Path) -> Result<(), String> {
    let output = std::process::Command::new("git")
        .arg("clone")
        .arg("--depth")
        .arg("1")
        .arg(repo_url)
        .arg(target_dir)
        .output()
        .map_err(|error| format!("failed to run git clone: {error}"))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let detail = if !stderr.trim().is_empty() {
        stderr.trim().to_string()
    } else if !stdout.trim().is_empty() {
        stdout.trim().to_string()
    } else {
        format!("exit status {}", output.status)
    };

    Err(format!("git clone failed: {detail}"))
}

#[tauri::command]
fn create_new_project(
    name: Option<String>,
    default_agent_command: Option<String>,
    github_repo_url: Option<String>,
) -> Result<String, String> {
    let weekend_root = weekend_root()?;

    std::fs::create_dir_all(&weekend_root)
        .map_err(|error| format!("failed to create ~/.weekend: {error}"))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| format!("failed to read system clock: {error}"))?
        .as_secs();

    let sanitized_name = sanitize_project_name(name.as_deref().unwrap_or_default());
    let base_name = if sanitized_name.is_empty() {
        format!("project-{timestamp}")
    } else {
        sanitized_name
    };

    let mut candidate = weekend_root.join(&base_name);
    let mut suffix: u32 = 2;

    while candidate.exists() {
        candidate = weekend_root.join(format!("{base_name}-{suffix}"));
        suffix += 1;
    }

    let resolved_agent_command =
        normalize_process_command(default_agent_command.as_deref().unwrap_or(DEFAULT_AGENT_COMMAND))
            .ok_or_else(|| "default agent command is required".to_string())?;
    let resolved_github_repo_url = normalize_optional_string(github_repo_url);
    if let Some(repo_url) = resolved_github_repo_url.as_deref() {
        validate_github_repo_url(repo_url)?;
        if let Err(error) = clone_github_repo(repo_url, &candidate) {
            let _ = std::fs::remove_dir_all(&candidate);
            return Err(error);
        }
    } else {
        std::fs::create_dir(&candidate)
            .map_err(|error| format!("failed to create project directory: {error}"))?;
    }

    let project_name = candidate
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "failed to resolve project name".to_string())?;
    let allocated_port = {
        let _port_guard = project_port_lock()
            .lock()
            .map_err(|_| "failed to lock project port allocator".to_string())?;
        let allocated_port = allocate_deterministic_project_port(&weekend_root, project_name)?;
        let default_processes = default_processes_map(&resolved_agent_command);
        write_project_config(
            &candidate,
            DEFAULT_RUNTIME_HOST,
            Some(allocated_port),
            &default_startup_commands(),
            Some(&default_processes),
            false,
        )?;
        allocated_port
    };
    let shared_root = ensure_shared_assets_root()?;
    sync_shared_assets_into_project(&candidate, &shared_root)?;
    seed_agent_runtime_guidance_files(&candidate)?;
    if resolved_github_repo_url.is_none() {
        init_git_repo(&candidate)?;
    }

    log_backend(
        "INFO",
        format!(
            "created project {} with runtime endpoint {DEFAULT_RUNTIME_HOST}:{allocated_port}",
            candidate.display()
        ),
    );

    Ok(candidate.display().to_string())
}

#[tauri::command]
fn shared_assets_list() -> Result<Vec<SharedAssetSnapshot>, String> {
    let shared_root = ensure_shared_assets_root()?;
    list_shared_asset_snapshots(&shared_root)
}

#[tauri::command]
fn shared_assets_upload_batch(
    files: Vec<SharedAssetUploadInput>,
) -> Result<Vec<SharedAssetSnapshot>, String> {
    if files.is_empty() {
        return shared_assets_list();
    }

    let root = weekend_root()?;
    std::fs::create_dir_all(&root)
        .map_err(|error| format!("failed to create ~/.weekend: {error}"))?;
    let shared_root = ensure_shared_assets_root()?;

    let mut uploaded_count = 0u32;
    for file in files {
        let file_name = sanitize_shared_asset_file_name(&file.file_name)?;
        let decoded = decode_shared_asset_payload(&file.data_base64)?;
        let target_path = shared_root.join(&file_name);
        std::fs::write(&target_path, decoded)
            .map_err(|error| format!("failed to write {}: {error}", target_path.display()))?;
        uploaded_count += 1;
    }

    let synced_projects = sync_shared_assets_into_all_projects(&root, &shared_root)?;
    log_backend(
        "INFO",
        format!(
            "uploaded {uploaded_count} shared asset(s) and synced {synced_projects} project(s)"
        ),
    );

    list_shared_asset_snapshots(&shared_root)
}

#[tauri::command]
fn list_projects(archived: Option<bool>) -> Result<Vec<String>, String> {
    let weekend_root = weekend_root()?;

    if !weekend_root.exists() {
        return Ok(Vec::new());
    }

    let all_dirs: Vec<(String, PathBuf)> = std::fs::read_dir(&weekend_root)
        .map_err(|error| format!("failed to read ~/.weekend: {error}"))?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            entry
                .file_type()
                .ok()
                .filter(|file_type| file_type.is_dir())
                .and_then(|_| {
                    let name = entry.file_name().into_string().ok()?;
                    if is_reserved_root_entry(&name) || !is_safe_project_name(&name) {
                        return None;
                    }
                    Some((name, entry.path()))
                })
        })
        .collect();

    let mut projects: Vec<String> = match archived {
        None => all_dirs.into_iter().map(|(name, _)| name).collect(),
        Some(want_archived) => all_dirs
            .into_iter()
            .filter(|(_, path)| is_project_archived(path) == want_archived)
            .map(|(name, _)| name)
            .collect(),
    };

    projects.sort_unstable();
    Ok(projects)
}

#[tauri::command]
fn project_config_read(project: String) -> Result<ProjectConfigReadSnapshot, String> {
    let project_dir = resolve_project_dir(&project)?;
    let config_path = project_config_path(&project_dir);
    let project_dir_string = project_dir.display().to_string();
    let config_path_string = config_path.display().to_string();

    match read_project_config(&project_dir) {
        ProjectConfigLookup::Valid(config) => Ok(ProjectConfigReadSnapshot {
            project,
            project_dir: project_dir_string,
            config_path: config_path_string,
            config_exists: true,
            config_valid: true,
            runtime_host: Some(config.runtime.host),
            runtime_port: config.runtime.port,
            startup_commands: config.startup_commands,
            processes: config.processes,
            source: "project-config".to_string(),
            error: None,
            port_range_start: PORT_RANGE_START,
            port_range_end: PORT_RANGE_END,
            archived: config.archived,
        }),
        ProjectConfigLookup::Missing => Ok(ProjectConfigReadSnapshot {
            project,
            project_dir: project_dir_string,
            config_path: config_path_string,
            config_exists: false,
            config_valid: false,
            runtime_host: None,
            runtime_port: None,
            startup_commands: Vec::new(),
            processes: HashMap::new(),
            source: "missing".to_string(),
            error: None,
            port_range_start: PORT_RANGE_START,
            port_range_end: PORT_RANGE_END,
            archived: false,
        }),
        ProjectConfigLookup::Invalid(error) => Ok(ProjectConfigReadSnapshot {
            project,
            project_dir: project_dir_string,
            config_path: config_path_string,
            config_exists: true,
            config_valid: false,
            runtime_host: None,
            runtime_port: None,
            startup_commands: Vec::new(),
            processes: HashMap::new(),
            source: "invalid".to_string(),
            error: Some(error),
            port_range_start: PORT_RANGE_START,
            port_range_end: PORT_RANGE_END,
            archived: false,
        }),
    }
}

#[tauri::command]
fn project_config_write(
    project: String,
    runtime_host: String,
    runtime_port: Option<u16>,
    startup_commands: Option<Vec<String>>,
) -> Result<ProjectConfigReadSnapshot, String> {
    let project_name = project.trim();
    if project_name.is_empty() {
        return Err("project is required".to_string());
    }

    let Some(host) = normalize_runtime_host(&runtime_host) else {
        return Err("runtime.host is required".to_string());
    };
    if let Some(port) = runtime_port {
        if !is_runtime_port_in_range(port) {
            return Err(format!(
                "runtime.port must be in range {PORT_RANGE_START}-{PORT_RANGE_END}"
            ));
        }
    }

    let project_dir = resolve_project_dir(project_name)?;
    let existing = read_project_config(&project_dir);
    let resolved_startup_commands = match startup_commands {
        Some(commands) => normalize_startup_commands(&commands),
        None => match &existing {
            ProjectConfigLookup::Valid(config) => config.startup_commands.clone(),
            ProjectConfigLookup::Missing | ProjectConfigLookup::Invalid(_) => {
                default_startup_commands()
            }
        },
    };
    let resolved_processes = match &existing {
        ProjectConfigLookup::Valid(config) if !config.processes.is_empty() => {
            Some(config.processes.clone())
        }
        _ => None,
    };
    let resolved_archived = match &existing {
        ProjectConfigLookup::Valid(config) => config.archived,
        _ => false,
    };
    {
        let _port_guard = project_port_lock()
            .lock()
            .map_err(|_| "failed to lock project port allocator".to_string())?;
        if let Some(port) = runtime_port {
            let root = weekend_root()?;
            validate_runtime_port_available_for_project(&root, project_name, port)?;
        }
        write_project_config(
            &project_dir,
            &host,
            runtime_port,
            &resolved_startup_commands,
            resolved_processes.as_ref(),
            resolved_archived,
        )?;
    }

    project_config_read(project_name.to_string())
}

const ARCHIVE_CLEANUP_DIRS: &[&str] = &[
    "node_modules",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".output",
    ".svelte-kit",
    "target",
    "__pycache__",
    ".pytest_cache",
    "venv",
    ".venv",
    "vendor",
    ".gradle",
    ".dart_tool",
    ".pub-cache",
    ".turbo",
    ".cache",
    ".parcel-cache",
];

fn set_project_archived(project_dir: &Path, archived: bool) -> Result<(), String> {
    let config_path = project_config_path(project_dir);

    if config_path.exists() {
        let raw = std::fs::read_to_string(&config_path)
            .map_err(|error| format!("failed reading {}: {error}", config_path.display()))?;
        let mut value: serde_json::Value = serde_json::from_str(&raw)
            .map_err(|error| format!("failed parsing {}: {error}", config_path.display()))?;
        if let Some(obj) = value.as_object_mut() {
            obj.insert("archived".to_string(), serde_json::Value::Bool(archived));
        }
        let serialized = serde_json::to_string_pretty(&value)
            .map_err(|error| format!("failed to serialize config: {error}"))?;
        std::fs::write(&config_path, format!("{serialized}\n"))
            .map_err(|error| format!("failed to write {}: {error}", config_path.display()))?;
    } else {
        // Create minimal config with default host/port + archived flag
        let config = serde_json::json!({
            "runtime": {
                "host": DEFAULT_RUNTIME_HOST,
                "port": null
            },
            "archived": archived
        });
        let serialized = serde_json::to_string_pretty(&config)
            .map_err(|error| format!("failed to serialize config: {error}"))?;
        std::fs::write(&config_path, format!("{serialized}\n"))
            .map_err(|error| format!("failed to write {}: {error}", config_path.display()))?;
    }

    Ok(())
}

fn clean_build_artifacts(project_dir: &Path) -> u64 {
    let mut bytes_freed: u64 = 0;

    for dir_name in ARCHIVE_CLEANUP_DIRS {
        let path = project_dir.join(dir_name);
        if path.is_dir() {
            if let Ok(size) = dir_size(&path) {
                bytes_freed += size;
            }
            let _ = std::fs::remove_dir_all(&path);
        }
    }

    // Recurse for __pycache__ and .pyc in subdirectories
    if let Ok(walker) = walkdir_pycache(project_dir) {
        for path in walker {
            if path.is_dir() {
                if let Ok(size) = dir_size(&path) {
                    bytes_freed += size;
                }
                let _ = std::fs::remove_dir_all(&path);
            } else if path.extension().map_or(false, |ext| ext == "pyc") {
                if let Ok(meta) = std::fs::metadata(&path) {
                    bytes_freed += meta.len();
                }
                let _ = std::fs::remove_file(&path);
            }
        }
    }

    bytes_freed
}

fn dir_size(path: &Path) -> Result<u64, std::io::Error> {
    let mut total: u64 = 0;
    if path.is_dir() {
        for entry in std::fs::read_dir(path)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                total += dir_size(&path).unwrap_or(0);
            } else {
                total += entry.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
    }
    Ok(total)
}

fn walkdir_pycache(root: &Path) -> Result<Vec<PathBuf>, std::io::Error> {
    let mut results = Vec::new();
    walkdir_pycache_inner(root, root, &mut results)?;
    Ok(results)
}

fn walkdir_pycache_inner(
    root: &Path,
    current: &Path,
    results: &mut Vec<PathBuf>,
) -> Result<(), std::io::Error> {
    let entries = std::fs::read_dir(current)?;
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        // Skip top-level cleanup dirs (already handled)
        if current == root && ARCHIVE_CLEANUP_DIRS.contains(&name_str.as_ref()) {
            continue;
        }

        if path.is_dir() {
            if name_str == "__pycache__" {
                results.push(path);
            } else {
                walkdir_pycache_inner(root, &path, results)?;
            }
        } else if path.extension().map_or(false, |ext| ext == "pyc") {
            results.push(path);
        }
    }
    Ok(())
}

fn is_project_archived(project_dir: &Path) -> bool {
    match read_project_config(project_dir) {
        ProjectConfigLookup::Valid(config) => config.archived,
        _ => false,
    }
}

#[tauri::command]
fn archive_project(
    project: String,
    terminal_state: State<'_, TerminalState>,
) -> Result<u64, String> {
    log_backend(
        "INFO",
        format!("archive_project requested project={project}"),
    );
    let project_dir = resolve_project_dir(&project)?;

    // Kill all terminal sessions for the project (same pattern as delete_project)
    let detached_sessions = {
        let project_prefix = format!("{project}:");
        let mut sessions = terminal_state
            .sessions
            .lock()
            .map_err(|_| "failed to lock terminal sessions".to_string())?;
        let terminal_ids: Vec<String> = sessions
            .keys()
            .filter(|terminal_id| {
                terminal_id.starts_with(project_prefix.as_str())
                    || terminal_id.as_str() == format!("main-{project}")
            })
            .cloned()
            .collect();

        let mut detached = Vec::<Arc<TerminalSession>>::new();
        for terminal_id in terminal_ids {
            if let Some(session) = sessions.remove(&terminal_id) {
                detached.push(session);
            }
        }
        detached
    };

    if let Ok(mut opening_sessions) = terminal_state.opening_sessions.lock() {
        let project_prefix = format!("{project}:");
        opening_sessions.retain(|terminal_id| {
            !terminal_id.starts_with(project_prefix.as_str())
                && terminal_id.as_str() != format!("main-{project}")
        });
    }

    for session in detached_sessions {
        std::thread::spawn(move || {
            if let Ok(mut child) = session.child.lock() {
                let _ = child.kill();
            }
        });
    }

    let bytes_freed = clean_build_artifacts(&project_dir);
    set_project_archived(&project_dir, true)?;

    log_backend(
        "INFO",
        format!("archived project={project}, freed {} bytes", bytes_freed),
    );
    Ok(bytes_freed)
}

#[tauri::command]
fn unarchive_project(project: String) -> Result<(), String> {
    log_backend(
        "INFO",
        format!("unarchive_project requested project={project}"),
    );
    let project_dir = resolve_project_dir(&project)?;
    set_project_archived(&project_dir, false)?;
    log_backend("INFO", format!("unarchived project={project}"));
    Ok(())
}

#[tauri::command]
fn delete_project(project: String, terminal_state: State<'_, TerminalState>) -> Result<(), String> {
    log_backend(
        "INFO",
        format!("delete_project requested project={project}"),
    );
    let project_dir = resolve_project_dir(&project)?;

    let detached_sessions = {
        let project_prefix = format!("{project}:");
        let mut sessions = terminal_state
            .sessions
            .lock()
            .map_err(|_| "failed to lock terminal sessions".to_string())?;
        let terminal_ids: Vec<String> = sessions
            .keys()
            .filter(|terminal_id| {
                terminal_id.starts_with(project_prefix.as_str())
                    || terminal_id.as_str() == format!("main-{project}")
            })
            .cloned()
            .collect();

        let mut detached = Vec::<Arc<TerminalSession>>::new();
        for terminal_id in terminal_ids {
            if let Some(session) = sessions.remove(&terminal_id) {
                detached.push(session);
            }
        }
        detached
    };

    if let Ok(mut opening_sessions) = terminal_state.opening_sessions.lock() {
        let project_prefix = format!("{project}:");
        opening_sessions.retain(|terminal_id| {
            !terminal_id.starts_with(project_prefix.as_str())
                && terminal_id.as_str() != format!("main-{project}")
        });
    }

    for session in detached_sessions {
        std::thread::spawn(move || {
            if let Ok(mut child) = session.child.lock() {
                let _ = child.kill();
            }
        });
    }

    std::fs::remove_dir_all(&project_dir).map_err(|error| {
        format!(
            "failed to delete project directory {}: {error}",
            project_dir.display()
        )
    })?;
    log_backend("INFO", format!("deleted project={project}"));
    Ok(())
}

#[tauri::command]
fn rename_project(
    old_name: String,
    new_name: String,
    terminal_state: State<'_, TerminalState>,
) -> Result<String, String> {
    let old_name = old_name.trim().to_string();
    let sanitized = sanitize_project_name(&new_name);
    if sanitized.is_empty() {
        return Err("invalid project name".to_string());
    }
    if sanitized == old_name {
        return Ok(old_name);
    }

    let root = weekend_root()?;
    let old_dir = root.join(&old_name);
    if !old_dir.is_dir() {
        return Err(format!("project '{old_name}' does not exist"));
    }

    let new_dir = root.join(&sanitized);
    if new_dir.exists() {
        return Err(format!("a project named '{sanitized}' already exists"));
    }

    // Update terminal session keys in backend state
    {
        let old_prefix = format!("{old_name}:");
        let mut sessions = terminal_state
            .sessions
            .lock()
            .map_err(|_| "failed to lock terminal sessions".to_string())?;

        // Collect terminal IDs that belong to this project
        let terminal_ids: Vec<String> = sessions
            .keys()
            .filter(|id| id.starts_with(&old_prefix))
            .cloned()
            .collect();

        // Re-key sessions with new project name
        for old_id in terminal_ids {
            if let Some(session) = sessions.remove(&old_id) {
                let new_id = format!("{sanitized}:{}", &old_id[old_prefix.len()..]);
                sessions.insert(new_id, session);
            }
        }
    }

    std::fs::rename(&old_dir, &new_dir)
        .map_err(|error| format!("failed to rename project directory: {error}"))?;

    log_backend(
        "INFO",
        format!("renamed project '{old_name}' -> '{sanitized}'"),
    );
    Ok(sanitized)
}

#[tauri::command]
fn list_project_tree(project: String) -> Result<Vec<ProjectTreeNode>, String> {
    let project_dir = resolve_project_dir(&project)?;
    build_project_tree(&project_dir, &project_dir, 0)
}

#[tauri::command]
fn read_project_file(project: String, path: String) -> Result<String, String> {
    let project_dir = resolve_project_dir(&project)?;
    let sanitized = sanitize_project_relative_path(&path)?;
    let resolved = project_dir.join(&sanitized);
    let canonical = resolved
        .canonicalize()
        .map_err(|error| format!("cannot resolve path {sanitized}: {error}"))?;
    if !canonical.starts_with(&project_dir) {
        return Err("path is outside project directory".to_string());
    }
    if canonical.is_dir() {
        return Err("path is a directory".to_string());
    }
    std::fs::read_to_string(&canonical)
        .map_err(|error| format!("failed to read {}: {error}", canonical.display()))
}

#[tauri::command]
fn write_project_file(project: String, path: String, content: String) -> Result<(), String> {
    let project_dir = resolve_project_dir(&project)?;
    let sanitized = sanitize_project_relative_path(&path)?;
    let resolved = project_dir.join(&sanitized);
    // For new files the target may not exist yet, so canonicalize the parent.
    let parent = resolved
        .parent()
        .ok_or_else(|| "invalid path".to_string())?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|error| format!("cannot resolve parent of {sanitized}: {error}"))?;
    if !canonical_parent.starts_with(&project_dir) {
        return Err("path is outside project directory".to_string());
    }
    let target = canonical_parent.join(
        resolved
            .file_name()
            .ok_or_else(|| "invalid file name".to_string())?,
    );
    let file_name = target
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "invalid file name".to_string())?;
    if file_name.eq_ignore_ascii_case(LEGACY_PROJECT_CONFIG_FILE_NAME) {
        return Err(format!(
            "{LEGACY_PROJECT_CONFIG_FILE_NAME} is deprecated; use {PROJECT_CONFIG_FILE_NAME}"
        ));
    }
    if file_name.ends_with(".from-aios.backup.json") {
        return Err("writing transient config backup files is not allowed".to_string());
    }
    std::fs::write(&target, content)
        .map_err(|error| format!("failed to write {}: {error}", target.display()))
}

#[tauri::command]
fn read_project_file_binary(
    project: String,
    path: String,
) -> Result<ProjectFileBinaryPayload, String> {
    let project_dir = resolve_project_dir(&project)?;
    let sanitized = sanitize_project_relative_path(&path)?;
    let resolved = project_dir.join(&sanitized);
    let canonical = resolved
        .canonicalize()
        .map_err(|error| format!("cannot resolve path {sanitized}: {error}"))?;
    if !canonical.starts_with(&project_dir) {
        return Err("path is outside project directory".to_string());
    }
    if canonical.is_dir() {
        return Err("path is a directory".to_string());
    }

    let metadata = std::fs::metadata(&canonical)
        .map_err(|error| format!("failed to inspect {}: {error}", canonical.display()))?;
    if metadata.len() > MAX_PREVIEW_FILE_BYTES {
        return Err(format!(
            "file is too large to preview ({} bytes, limit {} bytes)",
            metadata.len(),
            MAX_PREVIEW_FILE_BYTES
        ));
    }

    let bytes = std::fs::read(&canonical)
        .map_err(|error| format!("failed to read {}: {error}", canonical.display()))?;
    Ok(ProjectFileBinaryPayload {
        data_base64: BASE64_STANDARD.encode(bytes.as_slice()),
        size_bytes: bytes.len() as u64,
    })
}

#[tauri::command]
fn rename_project_path(project: String, path: String, new_name: String) -> Result<String, String> {
    let project_dir = resolve_project_dir(&project)?;
    let source = resolve_existing_project_path(&project_dir, &path)?;

    let trimmed_new_name = new_name.trim();
    if trimmed_new_name.is_empty() {
        return Err("new name is required".to_string());
    }
    if trimmed_new_name.contains('/') || trimmed_new_name.contains('\\') {
        return Err("new name cannot include path separators".to_string());
    }
    if matches!(trimmed_new_name, "." | "..") {
        return Err("invalid new name".to_string());
    }

    let parent = source.parent().ok_or_else(|| "invalid path".to_string())?;
    let target = parent.join(trimmed_new_name);
    if target.exists() {
        return Err(format!("'{trimmed_new_name}' already exists"));
    }

    std::fs::rename(&source, &target)
        .map_err(|error| format!("failed to rename {}: {error}", source.display()))?;

    Ok(relative_path(&project_dir, &target))
}

#[tauri::command]
fn delete_project_path(project: String, path: String) -> Result<(), String> {
    let project_dir = resolve_project_dir(&project)?;
    let target = resolve_existing_project_path(&project_dir, &path)?;

    if target.is_dir() {
        std::fs::remove_dir_all(&target)
            .map_err(|error| format!("failed to delete {}: {error}", target.display()))?;
        return Ok(());
    }

    std::fs::remove_file(&target)
        .map_err(|error| format!("failed to delete {}: {error}", target.display()))
}

#[tauri::command]
fn import_external_files_to_project(
    project: String,
    target_dir: Option<String>,
    files: Vec<ProjectFileImportInput>,
) -> Result<Vec<String>, String> {
    if files.is_empty() {
        return Ok(Vec::new());
    }

    let project_dir = resolve_project_dir(&project)?;
    let destination_dir = resolve_project_target_dir(&project_dir, target_dir)?;
    let mut imported_paths = Vec::with_capacity(files.len());

    for file in files {
        let file_name = sanitize_project_file_name(&file.file_name)?;
        let target = destination_dir.join(&file_name);
        if target.exists() {
            return Err(format!(
                "cannot import '{file_name}': destination already exists"
            ));
        }

        let mut imported = false;
        if let Some(raw_source_path) = file.source_path.as_deref() {
            let trimmed_source = raw_source_path.trim();
            if !trimmed_source.is_empty() {
                let source = PathBuf::from(trimmed_source);
                if !source.exists() {
                    return Err(format!(
                        "cannot import '{file_name}': source file does not exist"
                    ));
                }
                if source.is_dir() {
                    return Err(format!(
                        "cannot import '{file_name}': source path is a directory"
                    ));
                }

                move_file_with_fallback(&source, &target)?;
                imported = true;
            }
        }

        if !imported {
            let data_base64 = file
                .data_base64
                .as_deref()
                .ok_or_else(|| format!("cannot import '{file_name}': file payload is missing"))?;
            let decoded = decode_project_file_payload(data_base64)?;
            std::fs::write(&target, decoded).map_err(|error| {
                format!(
                    "failed to write imported file {}: {error}",
                    target.display()
                )
            })?;
        }

        imported_paths.push(relative_path(&project_dir, &target));
    }

    Ok(imported_paths)
}

#[tauri::command]
fn terminal_open<R: Runtime>(
    terminal_id: String,
    project: Option<String>,
    cols: u16,
    rows: u16,
    play_spawned: Option<bool>,
    process_role: Option<String>,
    terminal_state: State<'_, TerminalState>,
    app: AppHandle<R>,
) -> Result<(), String> {
    let terminal_id = terminal_id.trim().to_string();
    if terminal_id.is_empty() {
        return Err("terminal id is required".to_string());
    }
    let debug_enabled = terminal_debug_enabled();

    {
        let sessions = terminal_state
            .sessions
            .lock()
            .map_err(|_| "failed to lock terminal sessions".to_string())?;
        if sessions.contains_key(&terminal_id) {
            return Ok(());
        }
    }

    {
        let opening = terminal_state
            .opening_sessions
            .lock()
            .map_err(|_| "failed to lock opening terminal sessions".to_string())?;
        if opening.contains(&terminal_id) {
            drop(opening);
            for _ in 0..200 {
                if let Ok(sessions) = terminal_state.sessions.lock() {
                    if sessions.contains_key(&terminal_id) {
                        return Ok(());
                    }
                }
                if let Ok(opening_sessions) = terminal_state.opening_sessions.lock() {
                    if !opening_sessions.contains(&terminal_id) {
                        break;
                    }
                }
                std::thread::sleep(Duration::from_millis(10));
            }
            return Err("terminal is still opening".to_string());
        }
    }

    {
        let mut opening = terminal_state
            .opening_sessions
            .lock()
            .map_err(|_| "failed to lock opening terminal sessions".to_string())?;
        if !opening.insert(terminal_id.clone()) {
            return Ok(());
        }
    }

    let open_result = (|| -> Result<(), String> {
        let working_dir = resolve_terminal_working_dir(project.as_deref())?;
        let size = PtySize {
            rows: rows.max(2),
            cols: cols.max(2),
            pixel_width: 0,
            pixel_height: 0,
        };
        if debug_enabled {
            log_backend(
                "INFO",
                format!(
                    "terminal_open terminal_id={} cols={} rows={}",
                    terminal_id, size.cols, size.rows
                ),
            );
        }

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(size)
            .map_err(|error| format!("failed to open PTY: {error}"))?;

        let shell = shell_path();
        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(working_dir);
        cmd.arg(login_interactive_flag(&shell));
        cmd.env("TERM", "xterm-256color");
        {
            let bridge_state: tauri::State<'_, BridgeState> = app.state();
            let bridge_token = bridge_state.connection_token.clone();
            let bridge_port_file = bridge_state
                .port_file_path
                .lock()
                .ok()
                .and_then(|guard| guard.as_ref().map(|path| path.display().to_string()));
            cmd.env("WEEKEND_BRIDGE_TOKEN", bridge_token);
            if let Some(value) = bridge_port_file {
                cmd.env("WEEKEND_BRIDGE_PORT_FILE", value);
            }
        }
        if let Some(project_name) = project
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            cmd.env("WEEKEND_PROJECT", project_name);
            let project_dir = resolve_project_dir(project_name)?;
            match read_project_config(&project_dir) {
                ProjectConfigLookup::Valid(config) => {
                    let runtime_host = config.runtime.host;
                    cmd.env("HOST", &runtime_host);
                    cmd.env("HOSTNAME", &runtime_host);
                    cmd.env("WEEKEND_RUNTIME_HOST", &runtime_host);

                    if let Some(port) = config.runtime.port {
                        let runtime_port = port.to_string();
                        cmd.env("PORT", &runtime_port);
                        cmd.env("WEEKEND_RUNTIME_PORT", &runtime_port);
                    }
                }
                ProjectConfigLookup::Missing => {
                    log_backend(
                        "WARN",
                        format!(
                            "terminal_open project={project_name}: missing {PROJECT_CONFIG_FILE_NAME}; runtime env not injected"
                        ),
                    );
                }
                ProjectConfigLookup::Invalid(error) => {
                    log_backend(
                        "WARN",
                        format!(
                            "terminal_open project={project_name}: invalid {PROJECT_CONFIG_FILE_NAME} ({error}); runtime env not injected"
                        ),
                    );
                }
            }
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|error| format!("failed to spawn shell: {error}"))?;

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|error| format!("failed to clone PTY reader: {error}"))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|error| format!("failed to take PTY writer: {error}"))?;

        let session = Arc::new(TerminalSession {
            master: Mutex::new(pair.master),
            writer: Mutex::new(writer),
            child: Mutex::new(child),
        });

        {
            let mut sessions = terminal_state
                .sessions
                .lock()
                .map_err(|_| "failed to lock terminal sessions".to_string())?;
            if sessions.contains_key(&terminal_id) {
                return Ok(());
            }
            sessions.insert(terminal_id.clone(), session);
        }

        // Extract project name from terminal_id (format: "project:label")
        let session_project = terminal_id
            .find(':')
            .map(|idx| terminal_id[..idx].to_string())
            .unwrap_or_default();
        let shell_raw = normalize_process_name(&shell_path());
        let shell_display = humanize_process_name(&shell_raw);

        let info = TerminalSessionInfo {
            terminal_id: terminal_id.clone(),
            project: session_project,
            display_name: shell_display,
            custom_name: None,
            status: "alive".to_string(),
            has_active_process: false,
            foreground_process_name: Some(shell_raw),
            created_at: now_unix_ms(),
            play_spawned: play_spawned.unwrap_or(false),
            process_role: process_role.clone(),
        };

        {
            let mut session_info = terminal_state
                .session_info
                .lock()
                .map_err(|_| "failed to lock session info".to_string())?;
            session_info.insert(terminal_id.clone(), info.clone());
        }

        emit_session_changed(&app, &info);

        spawn_terminal_reader(
            app,
            terminal_id.clone(),
            reader,
            Arc::clone(&terminal_state.sessions),
            Arc::clone(&terminal_state.session_info),
        );

        Ok(())
    })();

    if let Ok(mut opening) = terminal_state.opening_sessions.lock() {
        opening.remove(&terminal_id);
    }

    open_result
}

#[tauri::command]
fn terminal_write(
    terminal_id: String,
    data: String,
    terminal_state: State<'_, TerminalState>,
) -> Result<(), String> {
    let session = {
        let sessions = terminal_state
            .sessions
            .lock()
            .map_err(|_| "failed to lock terminal sessions".to_string())?;
        sessions
            .get(&terminal_id)
            .cloned()
            .ok_or_else(|| "terminal session not found".to_string())?
    };

    let mut writer = session
        .writer
        .lock()
        .map_err(|_| "failed to lock terminal writer".to_string())?;
    writer
        .write_all(data.as_bytes())
        .map_err(|error| format!("failed to write to PTY: {error}"))?;
    writer
        .flush()
        .map_err(|error| format!("failed to flush PTY: {error}"))?;
    Ok(())
}

#[tauri::command]
fn terminal_resize(
    terminal_id: String,
    cols: u16,
    rows: u16,
    terminal_state: State<'_, TerminalState>,
) -> Result<(), String> {
    let debug_enabled = terminal_debug_enabled();
    let session = {
        let sessions = terminal_state
            .sessions
            .lock()
            .map_err(|_| "failed to lock terminal sessions".to_string())?;
        sessions
            .get(&terminal_id)
            .cloned()
            .ok_or_else(|| "terminal session not found".to_string())?
    };

    let size = PtySize {
        rows: rows.max(2),
        cols: cols.max(2),
        pixel_width: 0,
        pixel_height: 0,
    };
    let master = session
        .master
        .lock()
        .map_err(|_| "failed to lock terminal master".to_string())?;
    master
        .resize(size)
        .map_err(|error| format!("failed to resize PTY: {error}"))?;
    if debug_enabled {
        log_backend(
            "INFO",
            format!(
                "terminal_resize terminal_id={} cols={} rows={}",
                terminal_id, size.cols, size.rows
            ),
        );
    }
    Ok(())
}

#[tauri::command]
fn terminal_close(
    terminal_id: String,
    _terminal_state: State<'_, TerminalState>,
) -> Result<(), String> {
    if terminal_id.trim().is_empty() {
        return Err("terminal id is required".to_string());
    }

    // Session lifecycle is backend-owned. Close from the UI means "detach renderer",
    // so we intentionally keep the PTY process alive across page/project navigation.
    Ok(())
}

#[tauri::command]
fn terminal_list(
    prefix: Option<String>,
    terminal_state: State<'_, TerminalState>,
) -> Result<Vec<String>, String> {
    let sessions = terminal_state
        .sessions
        .lock()
        .map_err(|_| "failed to lock terminal sessions".to_string())?;

    let mut ids: Vec<String> = match prefix {
        Some(ref p) if !p.is_empty() => sessions
            .keys()
            .filter(|id| id.starts_with(p.as_str()))
            .cloned()
            .collect(),
        _ => sessions.keys().cloned().collect(),
    };
    ids.sort();
    Ok(ids)
}

fn resolve_foreground_labels(
    shell_pid_by_terminal_id: &HashMap<String, i32>,
) -> Result<HashMap<String, String>, String> {
    if shell_pid_by_terminal_id.is_empty() {
        return Ok(HashMap::new());
    }

    let output = std::process::Command::new("ps")
        .args(["-axo", "pid=,ppid=,comm="])
        .output()
        .map_err(|error| format!("failed to inspect process list: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "failed to inspect process list: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let entries = parse_ps_process_entries(&String::from_utf8_lossy(&output.stdout));
    let mut process_by_pid = HashMap::<i32, PsProcessEntry>::new();
    let mut child_pids_by_parent = HashMap::<i32, Vec<i32>>::new();
    for entry in entries {
        child_pids_by_parent
            .entry(entry.ppid)
            .or_default()
            .push(entry.pid);
        process_by_pid.insert(entry.pid, entry);
    }

    let mut labels_by_terminal_id = HashMap::<String, String>::new();
    for (terminal_id, shell_pid) in shell_pid_by_terminal_id {
        let shell_label = process_by_pid
            .get(shell_pid)
            .map(|entry| normalize_process_name(&entry.command))
            .filter(|name| !name.is_empty())
            .unwrap_or_else(|| "shell".to_string());

        let descendants = collect_descendants_by_depth(*shell_pid, &child_pids_by_parent);
        // Score: (non_shell, is_wrapper, depth, pid, name)
        // Wrapper processes (claude, etc.) beat deeper descendants because
        // they spawn internal child processes (node, npm) as implementation details.
        let mut best: Option<(bool, bool, usize, i32, String)> = None;
        for (pid, depth) in descendants {
            let Some(entry) = process_by_pid.get(&pid) else {
                continue;
            };
            let name = normalize_process_name(&entry.command);
            if name.is_empty() {
                continue;
            }
            let non_shell = !is_shell_process_name(&name);
            let wrapper = is_wrapper_process_name(&name);
            let candidate = (non_shell, wrapper, depth, pid, name);
            match &best {
                None => best = Some(candidate),
                Some(current) => {
                    // Priority: non_shell > wrapper > depth > pid
                    let is_better = (candidate.0, candidate.1) > (current.0, current.1)
                        || (candidate.0 == current.0
                            && candidate.1 == current.1
                            && (candidate.2 > current.2
                                || (candidate.2 == current.2 && candidate.3 > current.3)));
                    if is_better {
                        best = Some(candidate);
                    }
                }
            }
        }

        let label = best.map(|value| value.4).unwrap_or(shell_label);
        labels_by_terminal_id.insert(terminal_id.clone(), label);
    }

    Ok(labels_by_terminal_id)
}

#[tauri::command]
fn terminal_active_processes(
    terminal_ids: Vec<String>,
    terminal_state: State<'_, TerminalState>,
) -> Result<HashMap<String, String>, String> {
    let shell_pid_by_terminal_id = collect_shell_pids(&terminal_ids, &terminal_state.sessions)?;
    resolve_foreground_labels(&shell_pid_by_terminal_id)
}

fn collect_shell_pids(
    terminal_ids: &[String],
    sessions: &Arc<Mutex<HashMap<String, Arc<TerminalSession>>>>,
) -> Result<HashMap<String, i32>, String> {
    let mut shell_pid_by_terminal_id = HashMap::<String, i32>::new();
    let sessions = sessions
        .lock()
        .map_err(|_| "failed to lock terminal sessions".to_string())?;

    for terminal_id in terminal_ids {
        if terminal_id.trim().is_empty() {
            continue;
        }
        let Some(session) = sessions.get(terminal_id) else {
            continue;
        };
        let Ok(child) = session.child.lock() else {
            continue;
        };
        let Some(pid) = child.process_id() else {
            continue;
        };
        shell_pid_by_terminal_id.insert(terminal_id.clone(), pid as i32);
    }
    Ok(shell_pid_by_terminal_id)
}

fn emit_session_changed<R: Runtime>(app: &AppHandle<R>, info: &TerminalSessionInfo) {
    let _ = app.emit("terminal-session-changed", info.clone());
}

fn emit_session_removed<R: Runtime>(app: &AppHandle<R>, terminal_id: &str) {
    #[derive(Serialize, Clone)]
    #[serde(rename_all = "camelCase")]
    struct RemovedPayload {
        terminal_id: String,
    }
    let _ = app.emit(
        "terminal-session-removed",
        RemovedPayload {
            terminal_id: terminal_id.to_string(),
        },
    );
}

#[tauri::command]
fn terminal_get_all_sessions(
    terminal_state: State<'_, TerminalState>,
) -> Result<Vec<TerminalSessionInfo>, String> {
    let session_info = terminal_state
        .session_info
        .lock()
        .map_err(|_| "failed to lock session info".to_string())?;
    let mut sessions: Vec<TerminalSessionInfo> = session_info.values().cloned().collect();
    sessions.sort_by_key(|s| s.created_at);
    Ok(sessions)
}

#[tauri::command]
fn terminal_set_custom_name<R: Runtime>(
    terminal_id: String,
    name: Option<String>,
    terminal_state: State<'_, TerminalState>,
    app: AppHandle<R>,
) -> Result<(), String> {
    let terminal_id = terminal_id.trim().to_string();
    if terminal_id.is_empty() {
        return Err("terminal id is required".to_string());
    }

    let mut session_info = terminal_state
        .session_info
        .lock()
        .map_err(|_| "failed to lock session info".to_string())?;

    let Some(info) = session_info.get_mut(&terminal_id) else {
        return Err("terminal session not found".to_string());
    };

    info.custom_name = name.map(|n| n.trim().to_string()).filter(|n| !n.is_empty());
    let updated = info.clone();
    drop(session_info);

    emit_session_changed(&app, &updated);
    Ok(())
}

#[tauri::command]
fn terminal_remove_session<R: Runtime>(
    terminal_id: String,
    terminal_state: State<'_, TerminalState>,
    app: AppHandle<R>,
) -> Result<(), String> {
    let terminal_id = terminal_id.trim().to_string();
    if terminal_id.is_empty() {
        return Err("terminal id is required".to_string());
    }

    // Kill PTY child if alive
    let detached_session = {
        let mut sessions = terminal_state
            .sessions
            .lock()
            .map_err(|_| "failed to lock terminal sessions".to_string())?;
        sessions.remove(&terminal_id)
    };

    if let Some(session) = detached_session {
        std::thread::spawn(move || {
            if let Ok(mut child) = session.child.lock() {
                let _ = child.kill();
            }
        });
    }

    // Remove from session_info
    {
        let mut session_info = terminal_state
            .session_info
            .lock()
            .map_err(|_| "failed to lock session info".to_string())?;
        session_info.remove(&terminal_id);
    }

    // Remove from opening_sessions
    if let Ok(mut opening) = terminal_state.opening_sessions.lock() {
        opening.remove(&terminal_id);
    }

    emit_session_removed(&app, &terminal_id);
    Ok(())
}

#[tauri::command]
fn runtime_debug_dump(
    terminal_state: State<'_, TerminalState>,
) -> Result<RuntimeDebugSnapshot, String> {
    let terminal_ids = {
        let sessions = terminal_state
            .sessions
            .lock()
            .map_err(|_| "failed to lock terminal sessions".to_string())?;
        let mut ids: Vec<String> = sessions.keys().cloned().collect();
        ids.sort_unstable();
        ids
    };

    Ok(RuntimeDebugSnapshot {
        generated_at_unix_ms: now_unix_ms(),
        terminal_ids,
    })
}

#[tauri::command]
fn ui_log_batch(entries: Vec<UiLogEntry>) -> Result<(), String> {
    if entries.is_empty() {
        return Ok(());
    }

    for entry in entries.into_iter().take(500) {
        append_log("frontend", &entry.level, &entry.message)?;
    }

    Ok(())
}

#[tauri::command]
fn logs_read_weekend(max_bytes: Option<usize>) -> Result<WeekendLogsSnapshot, String> {
    let tail = max_bytes
        .filter(|value| *value > 0)
        .unwrap_or(LOG_TAIL_DEFAULT_MAX_BYTES);
    let backend_path = surface_log_path("backend")?;
    let frontend_path = surface_log_path("frontend")?;

    Ok(WeekendLogsSnapshot {
        backend: read_log_tail_from_path(&backend_path, tail)?,
        frontend: read_log_tail_from_path(&frontend_path, tail)?,
    })
}

#[tauri::command]
fn logs_read_project(
    project: String,
    max_bytes: Option<usize>,
) -> Result<ProjectLogsSnapshot, String> {
    if project.trim().is_empty() {
        return Err("project is required".to_string());
    }
    if !is_safe_project_name(&project) {
        return Err("invalid project name".to_string());
    }

    let tail = max_bytes
        .filter(|value| *value > 0)
        .unwrap_or(LOG_TAIL_DEFAULT_MAX_BYTES);
    let path = project_log_path(&project)?;

    Ok(ProjectLogsSnapshot {
        project: project.clone(),
        content: read_log_tail_from_path(&path, tail)?,
    })
}

#[tauri::command]
fn browser_history_navigate<R: Runtime>(
    app: AppHandle<R>,
    label: String,
    direction: String,
) -> Result<(), String> {
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview not found: {label}"))?;
    let script = match direction.as_str() {
        "back" => "history.back()",
        "forward" => "history.forward()",
        _ => return Err(format!("invalid direction: {direction}")),
    };
    webview
        .eval(script)
        .map_err(|e| format!("webview.eval failed: {e}"))
}

#[tauri::command]
fn browser_push_event<R: Runtime>(
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
fn browser_start_element_grab<R: Runtime>(label: String, app: AppHandle<R>) -> Result<(), String> {
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview not found: {label}"))?;
    webview
        .eval(
            "if (window.__WEEKEND_BRIDGE__) { window.__WEEKEND_BRIDGE__.configure({ ...window.__WEEKEND_BRIDGE_STATE__.config, element_grab: true }); }",
        )
        .map_err(|e| format!("eval failed: {e}"))
}

#[tauri::command]
fn browser_stop_element_grab<R: Runtime>(label: String, app: AppHandle<R>) -> Result<(), String> {
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview not found: {label}"))?;
    webview
        .eval(
            "if (window.__WEEKEND_BRIDGE__) { window.__WEEKEND_BRIDGE__.configure({ ...window.__WEEKEND_BRIDGE_STATE__.config, element_grab: false }); }",
        )
        .map_err(|e| format!("eval failed: {e}"))
}

#[tauri::command]
fn browser_bridge_ready<R: Runtime>(
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
    Ok(())
}

#[tauri::command]
fn browser_eval_result<R: Runtime>(
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

    pending_eval
        .sender
        .send(payload)
        .map_err(|_| "eval receiver dropped".to_string())
}

fn spawn_terminal_process_watcher<R: Runtime + 'static>(
    app: AppHandle<R>,
    terminal_state: TerminalState,
) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(2));

        let terminal_ids: Vec<String> = {
            let Ok(sessions) = terminal_state.sessions.lock() else {
                continue;
            };
            sessions.keys().cloned().collect()
        };

        if terminal_ids.is_empty() {
            continue;
        }

        let shell_pids = match collect_shell_pids(&terminal_ids, &terminal_state.sessions) {
            Ok(pids) => pids,
            Err(_) => continue,
        };

        let labels = match resolve_foreground_labels(&shell_pids) {
            Ok(labels) => labels,
            Err(_) => continue,
        };

        let changed: Vec<TerminalSessionInfo> = {
            let Ok(mut session_info) = terminal_state.session_info.lock() else {
                continue;
            };
            let mut changed = Vec::new();
            for (terminal_id, info) in session_info.iter_mut() {
                let Some(raw_label) = labels.get(terminal_id) else {
                    continue;
                };
                let normalized_label = normalize_process_name(raw_label);
                let has_active_process = !is_shell_process_name(&normalized_label);
                let humanized = humanize_process_name(&normalized_label);
                let mut did_change = false;

                if info.custom_name.is_none() && info.display_name != humanized {
                    info.display_name = humanized;
                    did_change = true;
                }
                if info.has_active_process != has_active_process {
                    info.has_active_process = has_active_process;
                    did_change = true;
                }
                let next_foreground = Some(normalized_label);
                if info.foreground_process_name != next_foreground {
                    info.foreground_process_name = next_foreground;
                    did_change = true;
                }

                if did_change {
                    changed.push(info.clone());
                }
            }
            changed
        };

        for info in &changed {
            emit_session_changed(&app, info);
        }
    });
}

fn maybe_cleanup_rust_build_cache_on_startup() {
    if !cfg!(debug_assertions) {
        return;
    }

    let mut candidates = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("scripts").join("clean-rust.mjs"));
        candidates.push(cwd.join("..").join("scripts").join("clean-rust.mjs"));
    }
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("scripts")
            .join("clean-rust.mjs"),
    );

    let Some(script_path) = candidates.into_iter().find(|path| path.is_file()) else {
        return;
    };

    let output = std::process::Command::new("node")
        .arg(&script_path)
        .arg("--keep-profiles=1")
        .output();

    match output {
        Ok(output) if output.status.success() => {
            let message = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if message.is_empty() {
                log_backend(
                    "INFO",
                    format!(
                        "startup rust cache cleanup ran with script={}",
                        script_path.display()
                    ),
                );
            } else {
                log_backend("INFO", format!("startup rust cache cleanup: {message}"));
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let detail = if stderr.is_empty() { stdout } else { stderr };

            if detail.is_empty() {
                log_backend(
                    "WARN",
                    format!(
                        "startup rust cache cleanup failed with status={}",
                        output.status
                    ),
                );
            } else {
                log_backend(
                    "WARN",
                    format!(
                        "startup rust cache cleanup failed with status={}: {detail}",
                        output.status
                    ),
                );
            }
        }
        Err(error) => {
            log_backend(
                "WARN",
                format!(
                    "failed to run startup rust cache cleanup script={} error={error}",
                    script_path.display()
                ),
            );
        }
    }
}

fn main() {
    log_backend("INFO", "weekend backend starting");
    tauri::Builder::default()
        .manage(TerminalState::new())
        .manage(BridgeState::new())
        .manage(EventBufferState::new())
        .on_page_load(|webview, payload| {
            let label = webview.label().to_string();
            let phase = match payload.event() {
                tauri::webview::PageLoadEvent::Started => "started",
                tauri::webview::PageLoadEvent::Finished => "finished",
            };

            // Track browser-pane webviews so the bridge can enumerate them.
            // Child webviews don't appear in webview_windows(), so on_page_load
            // is the reliable place to discover them.
            if label.starts_with("browser-pane:") {
                let bridge_state: tauri::State<'_, BridgeState> = webview.state();
                let _ = bridge_state
                    .browser_webview_labels
                    .lock()
                    .map(|mut set| set.insert(label.clone()));

                // Mark as not-ready at navigation start and wait for explicit
                // browser bridge ready callbacks before handling tool actions.
                if matches!(payload.event(), tauri::webview::PageLoadEvent::Started) {
                    bridge_state.mark_bridge_loading(&label, Some(payload.url().to_string()));
                }

                // Earliest available injection point for child webviews.
                let _ = webview.eval(include_str!("bridge_inject.js"));

                // Inject Cmd/Ctrl+R reload shortcut into the embedded browser.
                // Keyboard events inside a child Webview never reach the main
                // window's JS, so we wire the shortcut directly in the overlay.
                if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                    let _ = webview.eval(
                        "window.addEventListener('keydown', function(e) {\
                            if ((e.metaKey || e.ctrlKey) && e.key === 'r' && !e.shiftKey && !e.altKey) {\
                                e.preventDefault();\
                                window.location.reload();\
                            }\
                        }, true);",
                    );

                    // Re-inject at finished as a fallback for pages that block
                    // early eval timing; bridge script is idempotent/versioned.
                    let _ = webview.eval(include_str!("bridge_inject.js"));

                    // Re-apply stored observer config if any
                    let ebs: tauri::State<'_, EventBufferState> = webview.state();
                    let config = ebs.get_observer_config(&label);
                    if let Ok(config_json) = serde_json::to_string(&config) {
                        let _ = webview.eval(&format!(
                            "if (window.__WEEKEND_BRIDGE__) {{ window.__WEEKEND_BRIDGE__.configure({config_json}); }}"
                        ));
                    }
                }
            }

            let _ = webview.emit(
                "browser-webview-page-load",
                BrowserWebviewPageLoadPayload {
                    webview_label: label,
                    window_label: webview.window().label().to_string(),
                    url: payload.url().to_string(),
                    phase: phase.to_string(),
                },
            );
        })
        .setup(|app| {
            maybe_cleanup_rust_build_cache_on_startup();

            if let Err(error) = backfill_existing_project_configs() {
                log_backend("WARN", format!("project config backfill skipped: {error}"));
            }
            if let Err(error) = backfill_project_bin_wrappers() {
                log_backend("WARN", format!("node wrapper repair skipped: {error}"));
            }
            if let Err(error) = backfill_mcp_configs() {
                log_backend("WARN", format!("mcp config backfill skipped: {error}"));
            }
            if let Err(error) = backfill_shared_assets_to_projects() {
                log_backend("WARN", format!("shared assets backfill skipped: {error}"));
            }
            spawn_project_tree_watcher(app.handle().clone());
            bridge_server::start(app.handle().clone());

            let terminal_state: tauri::State<'_, TerminalState> = app.state();
            spawn_terminal_process_watcher(app.handle().clone(), terminal_state.inner().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_new_project,
            shared_assets_list,
            shared_assets_upload_batch,
            list_projects,
            project_config_read,
            project_config_write,
            delete_project,
            archive_project,
            unarchive_project,
            rename_project,
            list_project_tree,
            read_project_file,
            write_project_file,
            read_project_file_binary,
            rename_project_path,
            delete_project_path,
            import_external_files_to_project,
            terminal_open,
            terminal_write,
            terminal_resize,
            terminal_close,
            terminal_list,
            terminal_active_processes,
            terminal_get_all_sessions,
            terminal_set_custom_name,
            terminal_remove_session,
            browser_history_navigate,
            browser_push_event,
            browser_bridge_ready,
            browser_start_element_grab,
            browser_stop_element_grab,
            browser_eval_result,
            runtime_debug_dump,
            ui_log_batch,
            logs_read_weekend,
            logs_read_project,
            shell_name
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
