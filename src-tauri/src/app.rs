use crate::bridge_types::BridgeState;
use crate::event_buffer::EventBufferState;
use crate::{bridge_server, bridge_types, webview_ops};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine as _;
use notify::{
    Config as NotifyConfig, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};
use std::net::TcpListener;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::path::BaseDirectory;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, Runtime, State, Url, WebviewUrl, WebviewWindow,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[cfg(target_os = "macos")]
use objc2_app_kit::{NSView, NSWindow, NSWindowButton};

use crate::logging::{
    append_log, log_backend, now_unix_ms, project_log_path, read_log_tail_from_path,
    surface_log_path, LOG_TAIL_DEFAULT_MAX_BYTES,
};

mod terminal;

mod agent_runtime;
mod browser;
mod log_commands;
mod project_files;
mod project_tree;
mod projects;
mod runtime_probe;
mod shared_assets;
mod shared_drop;
mod theme;

use agent_runtime::{
    backfill_mcp_configs, init_git_repo, maybe_run_agent_autostart,
    resolve_bundled_portless_cli_path, seed_agent_runtime_guidance_files,
    write_agent_metadata_file, SeedMode,
};
#[cfg(test)]
use browser::browser_runtime_status_is_ready;
use browser::{project_name_from_browser_webview_label, BrowserWebviewPageLoadPayload};
use project_tree::{is_reserved_root_entry, relative_path, spawn_project_tree_watcher};
use shared_assets::{
    ensure_shared_assets_root, list_shared_asset_snapshots, list_user_project_dirs,
    project_shared_assets_dir, read_shared_env, shared_assets_root,
    sync_shared_assets_into_all_projects, sync_shared_assets_into_project,
};
use shared_drop::{install_shared_drop_tray, SHARED_DROP_WINDOW_LABEL};
pub(crate) use terminal::{
    bridge_terminal_kill, bridge_terminal_list, bridge_terminal_read, bridge_terminal_spawn,
    bridge_terminal_write,
};
use terminal::{
    detach_project_terminal_sessions, emit_session_changed, emit_session_removed,
    is_wrapper_process_name, kill_detached_terminal_sessions, normalize_process_name,
    rekey_project_terminal_state, spawn_terminal_process_watcher, TerminalSession, TerminalState,
};
use theme::{
    normalize_deploy_choice, normalize_design_system_choice, normalize_project_theme_config,
    project_deploy_choice, project_uses_weekend_design, read_project_theme_field,
    theme_injection_preamble, write_project_deploy_choice, write_project_design_system_choice,
    ProjectThemeConfig,
};
#[cfg(test)]
use theme::{normalize_design_system_config, project_theme_bridge_script, DesignSystemConfig};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProjectRuntimeConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    deploy_url: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ProjectRuntimeMode {
    Portless,
}

impl ProjectRuntimeMode {
    fn as_str(self) -> &'static str {
        match self {
            Self::Portless => "portless",
        }
    }
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

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct ProjectAgentsConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    default: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProjectConfig {
    runtime: ProjectRuntimeConfig,
    #[serde(default)]
    startup: ProjectStartupConfig,
    #[serde(default)]
    processes: Option<HashMap<String, ProcessEntry>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    agents: Option<ProjectAgentsConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    env: Option<HashMap<String, String>>,
    #[serde(default)]
    archived: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    theme: Option<ProjectThemeConfig>,
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
    runtime_mode: Option<String>,
    runtime_url: Option<String>,
    deploy_url: Option<String>,
    startup_commands: Vec<String>,
    processes: HashMap<String, ProcessEntrySnapshot>,
    agents: Option<ProjectAgentsConfig>,
    env: HashMap<String, String>,
    theme: ProjectThemeConfig,
    source: String,
    error: Option<String>,
    archived: bool,
}

#[derive(Debug, Clone)]
struct ProjectConfigResolved {
    runtime: ProjectRuntimeConfig,
    startup_commands: Vec<String>,
    processes: HashMap<String, ProcessEntrySnapshot>,
    agents: Option<ProjectAgentsConfig>,
    env: HashMap<String, String>,
    theme: ProjectThemeConfig,
    archived: bool,
}

enum ProjectConfigLookup {
    Missing,
    Valid(ProjectConfigResolved),
    Invalid(String),
}

pub(crate) fn weekend_root() -> Result<PathBuf, String> {
    let home =
        std::env::var("HOME").map_err(|_| "HOME environment variable is not set".to_string())?;
    Ok(PathBuf::from(home).join(".weekend"))
}

const DEFAULT_PORTLESS_RUNTIME_DOMAIN: &str = "localhost";
const DEFAULT_PORTLESS_PROXY_PORT: u16 = 1355;
const DEFAULT_STARTUP_COMMAND: &str = "pnpm dev";
const DEFAULT_AGENT_COMMAND: &str = "claude";
const PROJECT_CONFIG_FILE_NAME: &str = "weekend.config.json";
const PROJECT_CLAUDE_FILE_NAME: &str = "CLAUDE.md";
const PROJECT_AGENTS_FILE_NAME: &str = "AGENTS.md";
const PROJECT_WEEKEND_DIR_NAME: &str = ".weekend";
const AGENT_STARTUP_MARKER_FILE_NAME: &str = "agent-startup.pending";
const AGENT_STARTUP_PROMPT_FILE_NAME: &str = "PROMPT.md";
const PROJECT_AGENT_RUNTIME_GUIDANCE_FILE_NAME: &str = "agent-runtime.md";
const PROJECT_CODEX_DIR_NAME: &str = ".codex";
const PROJECT_CODEX_CONFIG_FILE_NAME: &str = "config.toml";
const PROJECT_GITIGNORE_FILE_NAME: &str = ".gitignore";
const SHARED_ASSETS_ROOT_DIR_NAME: &str = "shared-assets";
const PROJECT_BRIDGE_PORT_DIR_NAME: &str = "bridge-projects";
const PROJECT_SHARED_ASSETS_DIR_NAME: &str = "shared-assets";
const PROJECT_DESIGN_SYSTEM_DIR_NAME: &str = "weekend-design";
const WEEKEND_SUITE_SKILL_DIR_NAME: &str = "weekend-suite-skill";
const PROJECT_CLAUDE_SKILLS_DIR_REL: &str = ".claude/skills";
const PROJECT_WEEKEND_SUITE_SKILL_NAME: &str = "weekend-suite";
const MAX_PREVIEW_FILE_BYTES: u64 = 20 * 1024 * 1024;
const WEEKEND_MCP_SERVER_NAME: &str = "weekend";

// Sentinels for the Weekend-managed block inside user-owned CLAUDE.md / AGENTS.md
// files. When a project already has one of these files (cloned repo, user-edited,
// etc.) we append the runtime guidance between these markers; on subsequent
// startups the block is refreshed in place without disturbing user content
// outside the markers. Greenfield projects get the full guidance written
// directly with no sentinels — see seed_agent_runtime_guidance_files.
const WEEKEND_BLOCK_BEGIN: &str = "<!-- BEGIN weekend-managed -->";
const WEEKEND_BLOCK_END: &str = "<!-- END weekend-managed -->";

fn sanitize_project_name_for_runtime_url(project_name: &str) -> String {
    let mut out = String::new();
    let mut last_was_sep = false;

    for ch in project_name.trim().chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            last_was_sep = false;
            continue;
        }

        if !last_was_sep {
            out.push('-');
            last_was_sep = true;
        }
    }

    let trimmed = out.trim_matches('-');
    if trimmed.is_empty() {
        "app".to_string()
    } else {
        trimmed.to_string()
    }
}

fn default_runtime_url_for_project_name(project_name: &str) -> String {
    let slug = sanitize_project_name_for_runtime_url(project_name);
    format!("http://{slug}.{DEFAULT_PORTLESS_RUNTIME_DOMAIN}:{DEFAULT_PORTLESS_PROXY_PORT}")
}

fn project_bridge_port_dir() -> Result<PathBuf, String> {
    Ok(weekend_root()?.join(PROJECT_BRIDGE_PORT_DIR_NAME))
}

fn project_bridge_port_file_path(project_name: &str) -> Result<PathBuf, String> {
    if !is_safe_project_name(project_name) {
        return Err("invalid project name".to_string());
    }
    Ok(project_bridge_port_dir()?.join(format!("{project_name}.port")))
}

fn sync_project_bridge_port_file(
    project_name: &str,
    bridge_state: &BridgeState,
) -> Result<PathBuf, String> {
    let instance_path = bridge_state
        .port_file_path
        .lock()
        .map_err(|_| "failed to lock bridge port file state".to_string())?
        .clone()
        .ok_or_else(|| "bridge instance port file is not ready".to_string())?;
    let content = std::fs::read_to_string(&instance_path).map_err(|error| {
        format!(
            "failed to read bridge instance port file {}: {error}",
            instance_path.display()
        )
    })?;
    let port = content
        .lines()
        .next()
        .ok_or_else(|| "bridge instance port file is empty".to_string())?
        .trim()
        .parse::<u16>()
        .map_err(|error| format!("invalid TCP port in bridge instance port file: {error}"))?;

    let dir = project_bridge_port_dir()?;
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("failed to create {}: {error}", dir.display()))?;

    let path = project_bridge_port_file_path(project_name)?;
    let serialized = format!(
        "{port}\n{}\n{}\n",
        bridge_state.connection_token,
        instance_path.display()
    );
    std::fs::write(&path, serialized)
        .map_err(|error| format!("failed to write {}: {error}", path.display()))?;
    Ok(path)
}

fn project_design_system_dir(project_dir: &Path) -> PathBuf {
    project_shared_assets_dir(project_dir).join(PROJECT_DESIGN_SYSTEM_DIR_NAME)
}

/// Resolve the directory holding the built `@weekend/design` dist.
///
/// In a development build this is `<workspace>/packages/design/dist/`,
/// resolved via `CARGO_MANIFEST_DIR` (which is the absolute path to
/// `src-tauri/`). In a release build the dist is bundled as a Tauri
/// resource via `tauri.conf.json` and resolved through
/// `BaseDirectory::Resource`.
fn design_dist_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    // Dev: src-tauri/../packages/design/dist
    let dev_candidate = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("packages")
        .join("design")
        .join("dist");
    if dev_candidate.exists() {
        return dev_candidate
            .canonicalize()
            .map_err(|error| format!("failed to canonicalize design dist path: {error}"))
            .or(Ok(dev_candidate));
    }

    // Production: bundled resource.
    if let Ok(resource_candidate) = app_handle
        .path()
        .resolve("packages/design/dist", BaseDirectory::Resource)
    {
        if resource_candidate.exists() {
            return Ok(resource_candidate);
        }
    }

    Err(
        "design dist not found - run `pnpm --filter @weekend/design build` and try again"
            .to_string(),
    )
}

/// Recursively copy `src` into `dst`. Creates `dst` if it does not exist.
/// Does not preserve modification times. Does not follow symlinks – any
/// symlink encountered is copied as a regular file via `std::fs::copy`.
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|error| {
        format!(
            "failed to create design system directory {}: {error}",
            dst.display()
        )
    })?;

    let entries = std::fs::read_dir(src)
        .map_err(|error| format!("failed to read {}: {error}", src.display()))?;

    for entry in entries {
        let entry =
            entry.map_err(|error| format!("failed to read entry in {}: {error}", src.display()))?;
        let from = entry.path();
        let to = dst.join(entry.file_name());

        let file_type = entry
            .file_type()
            .map_err(|error| format!("failed to read file type for {}: {error}", from.display()))?;

        if file_type.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else {
            std::fs::copy(&from, &to).map_err(|error| {
                format!(
                    "failed to copy design asset {} -> {}: {error}",
                    from.display(),
                    to.display()
                )
            })?;
        }
    }

    Ok(())
}

/// Sync the design system dist into a project's
/// `shared-assets/weekend-design/` directory. Removes top-level entries
/// in the destination that no longer exist in the source, except package
/// manager install artifacts such as `node_modules`. Does NOT deep-clean
/// nested directories - if you remove a single file from a nested directory
/// in `dist/`, that file will linger in projects until the parent directory
/// itself goes away. Acceptable for v1; the dist is rebuilt as a unit.
fn sync_design_system_into_project(
    project_dir: &Path,
    design_dist_dir: &Path,
) -> Result<u32, String> {
    if !design_dist_dir.exists() {
        return Err(format!(
            "design dist {} does not exist",
            design_dist_dir.display()
        ));
    }

    let target_root = project_design_system_dir(project_dir);
    std::fs::create_dir_all(&target_root).map_err(|error| {
        format!(
            "failed to create project design system directory {}: {error}",
            target_root.display()
        )
    })?;

    // Collect top-level source names for stale removal.
    let mut source_names: HashSet<String> = HashSet::new();
    let entries = std::fs::read_dir(design_dist_dir)
        .map_err(|error| format!("failed to read {}: {error}", design_dist_dir.display()))?;
    let mut sources: Vec<(std::ffi::OsString, PathBuf, bool)> = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| {
            format!(
                "failed to read entry in {}: {error}",
                design_dist_dir.display()
            )
        })?;
        let file_type = entry.file_type().map_err(|error| {
            format!(
                "failed to read file type for {}: {error}",
                entry.path().display()
            )
        })?;
        if let Some(name) = entry.file_name().to_str() {
            source_names.insert(name.to_string());
        }
        sources.push((entry.file_name(), entry.path(), file_type.is_dir()));
    }

    // Remove top-level stale entries in the target.
    let target_entries = std::fs::read_dir(&target_root).map_err(|error| {
        format!(
            "failed to read project design system directory {}: {error}",
            target_root.display()
        )
    })?;
    for entry in target_entries {
        let Ok(entry) = entry else { continue };
        let Ok(file_name) = entry.file_name().into_string() else {
            continue;
        };
        if file_name == "node_modules" {
            continue;
        }
        if source_names.contains(&file_name) {
            continue;
        }
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        let removal = if file_type.is_dir() {
            std::fs::remove_dir_all(&path)
        } else {
            std::fs::remove_file(&path)
        };
        removal.map_err(|error| {
            format!(
                "failed to remove stale design asset {}: {error}",
                path.display()
            )
        })?;
    }

    // Copy each top-level entry.
    let mut copied = 0u32;
    for (file_name, source_path, is_dir) in sources {
        let target_path = target_root.join(&file_name);
        if is_dir {
            // Wipe the destination subdir so removed files inside it don't linger.
            if target_path.exists() {
                std::fs::remove_dir_all(&target_path).map_err(|error| {
                    format!(
                        "failed to refresh design asset directory {}: {error}",
                        target_path.display()
                    )
                })?;
            }
            copy_dir_recursive(&source_path, &target_path)?;
        } else {
            std::fs::copy(&source_path, &target_path).map_err(|error| {
                format!(
                    "failed to copy design asset {} -> {}: {error}",
                    source_path.display(),
                    target_path.display()
                )
            })?;
        }
        copied += 1;
    }

    Ok(copied)
}

fn sync_design_system_into_all_projects_inner(
    weekend_root: &Path,
    design_dist_dir: &Path,
) -> Result<u32, String> {
    let project_dirs = list_user_project_dirs(weekend_root)?;
    let mut synced_projects = 0u32;
    for project_dir in project_dirs {
        sync_design_system_into_project(&project_dir, design_dist_dir)?;
        synced_projects += 1;
    }
    Ok(synced_projects)
}

fn project_config_path(project_dir: &Path) -> PathBuf {
    project_dir.join(PROJECT_CONFIG_FILE_NAME)
}

fn ensure_user_writable(path: &Path) -> Result<(), String> {
    let metadata = std::fs::metadata(path)
        .map_err(|error| format!("failed to read {} metadata: {error}", path.display()))?;
    let permissions = metadata.permissions();

    #[cfg(unix)]
    {
        let current_mode = permissions.mode();
        if current_mode & 0o200 != 0 {
            return Ok(());
        }

        let mut updated = permissions;
        updated.set_mode(current_mode | 0o200);
        std::fs::set_permissions(path, updated).map_err(|error| {
            format!(
                "failed to add owner write permission for {}: {error}",
                path.display()
            )
        })?;
    }

    #[cfg(not(unix))]
    {
        if permissions.readonly() {
            let mut updated = permissions;
            updated.set_readonly(false);
            std::fs::set_permissions(path, updated).map_err(|error| {
                format!(
                    "failed to make {} writable before update: {error}",
                    path.display()
                )
            })?;
        }
    }

    Ok(())
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

    let runtime_mode = match parse_runtime_mode(parsed.runtime.mode.as_deref()) {
        Ok(mode) => mode,
        Err(error) => return ProjectConfigLookup::Invalid(error),
    };
    let runtime_url = match normalize_runtime_url(parsed.runtime.url.as_deref()) {
        Ok(Some(value)) => value,
        Ok(None) => {
            return ProjectConfigLookup::Invalid(
                "runtime.url is required for portless mode".to_string(),
            );
        }
        Err(error) => return ProjectConfigLookup::Invalid(error),
    };

    let deploy_url = match normalize_deploy_url(parsed.runtime.deploy_url.as_deref()) {
        Ok(value) => value,
        Err(error) => return ProjectConfigLookup::Invalid(error),
    };
    let startup_commands = normalize_startup_commands(&parsed.startup.commands);
    let processes = resolve_processes(parsed.processes.as_ref(), &startup_commands);

    ProjectConfigLookup::Valid(ProjectConfigResolved {
        runtime: ProjectRuntimeConfig {
            mode: Some(runtime_mode.as_str().to_string()),
            url: Some(runtime_url),
            deploy_url,
        },
        startup_commands,
        processes,
        agents: parsed.agents,
        env: parsed.env.unwrap_or_default(),
        theme: normalize_project_theme_config(parsed.theme.unwrap_or_default()),
        archived: parsed.archived,
    })
}

fn parse_runtime_mode(value: Option<&str>) -> Result<ProjectRuntimeMode, String> {
    let Some(raw) = value else {
        return Ok(ProjectRuntimeMode::Portless);
    };

    let trimmed = raw.trim().to_ascii_lowercase();
    match trimmed.as_str() {
        "portless" => Ok(ProjectRuntimeMode::Portless),
        "direct" => Err("runtime.mode 'direct' is no longer supported; use 'portless'".to_string()),
        _ => Err(format!(
            "runtime.mode must be 'portless' (received '{}')",
            raw.trim()
        )),
    }
}

fn normalize_runtime_url(value: Option<&str>) -> Result<Option<String>, String> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let candidate = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("http://{trimmed}")
    };
    let mut parsed = Url::parse(&candidate)
        .map_err(|error| format!("runtime.url must be a valid URL: {error}"))?;
    match parsed.scheme() {
        "http" | "https" => {}
        scheme => {
            return Err(format!(
                "runtime.url must use http or https (received '{scheme}')"
            ));
        }
    }
    if parsed.host_str().is_none() {
        return Err("runtime.url must include a host".to_string());
    }
    let host = parsed.host_str().unwrap_or_default().to_ascii_lowercase();
    let is_local_address = host == "localhost"
        || host.ends_with(".localhost")
        || host == "127.0.0.1"
        || host == "::1"
        || host == "0.0.0.0";
    if !is_local_address {
        return Err(
            "runtime.url must target a local address (localhost, *.localhost, or loopback IP)"
                .to_string(),
        );
    }

    let is_portless_local_host = host == "localhost" || host.ends_with(".localhost");
    if is_portless_local_host && parsed.port().is_none() {
        parsed
            .set_port(Some(DEFAULT_PORTLESS_PROXY_PORT))
            .map_err(|_| "runtime.url has an invalid port".to_string())?;
    }

    Ok(Some(parsed.to_string()))
}

fn normalize_deploy_url(value: Option<&str>) -> Result<Option<String>, String> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let candidate = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };
    let parsed = Url::parse(&candidate)
        .map_err(|error| format!("runtime.deployUrl must be a valid URL: {error}"))?;
    match parsed.scheme() {
        "http" | "https" => {}
        scheme => {
            return Err(format!(
                "runtime.deployUrl must use http or https (received '{scheme}')"
            ));
        }
    }
    if parsed.host_str().is_none() {
        return Err("runtime.deployUrl must include a host".to_string());
    }

    Ok(Some(parsed.to_string()))
}

fn recover_runtime_url_from_raw_project_config(project_dir: &Path) -> Option<String> {
    let config_path = project_config_path(project_dir);
    let raw = std::fs::read_to_string(&config_path).ok()?;
    let parsed = serde_json::from_str::<ProjectConfig>(&raw).ok()?;
    normalize_runtime_url(parsed.runtime.url.as_deref())
        .ok()
        .flatten()
}

fn recover_deploy_url_from_raw_project_config(project_dir: &Path) -> Option<String> {
    let config_path = project_config_path(project_dir);
    let raw = std::fs::read_to_string(&config_path).ok()?;
    let parsed = serde_json::from_str::<ProjectConfig>(&raw).ok()?;
    normalize_deploy_url(parsed.runtime.deploy_url.as_deref())
        .ok()
        .flatten()
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

fn read_project_config(project_dir: &Path) -> ProjectConfigLookup {
    let config_path = project_config_path(project_dir);
    read_project_config_from_path(&config_path)
}

fn write_project_config(
    project_dir: &Path,
    runtime_url: &str,
    startup_commands: &[String],
    processes: Option<&HashMap<String, ProcessEntrySnapshot>>,
    agents: Option<&ProjectAgentsConfig>,
    env: Option<&HashMap<String, String>>,
    deploy_url: Option<&str>,
    archived: bool,
    theme: Option<ProjectThemeConfig>,
) -> Result<PathBuf, String> {
    let normalized_runtime_url = normalize_runtime_url(Some(runtime_url))?
        .ok_or_else(|| "runtime.url is required".to_string())?;
    let normalized_deploy_url = normalize_deploy_url(deploy_url)?;
    let config_path = project_config_path(project_dir);
    let preserved_theme = theme.or_else(|| read_project_theme_field(&config_path));
    let config = ProjectConfig {
        runtime: ProjectRuntimeConfig {
            mode: Some(ProjectRuntimeMode::Portless.as_str().to_string()),
            url: Some(normalized_runtime_url),
            deploy_url: normalized_deploy_url,
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
        agents: agents.cloned(),
        env: env.filter(|e| !e.is_empty()).cloned(),
        archived,
        theme: preserved_theme.map(normalize_project_theme_config),
    };
    let serialized = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("failed to serialize {PROJECT_CONFIG_FILE_NAME}: {error}"))?;
    if config_path.exists() {
        ensure_user_writable(&config_path)?;
    }
    std::fs::write(&config_path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", config_path.display()))?;
    Ok(config_path)
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

pub(crate) fn is_safe_project_name(name: &str) -> bool {
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

#[cfg(test)]
mod config_tests {
    use super::{
        normalize_design_system_config, project_theme_bridge_script, read_project_config,
        write_project_config, DesignSystemConfig, ProcessEntrySnapshot, ProjectConfigLookup,
        ProjectThemeConfig, PROJECT_CONFIG_FILE_NAME,
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
  "runtime": { "mode": "portless", "url": "http://music.localhost" },
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
  "runtime": { "mode": "portless", "url": "http://music.localhost" },
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
    fn defaults_runtime_mode_to_portless_when_missing() {
        let project_dir = make_temp_project_dir("weekend-config-default-runtime-mode");
        write_config(
            &project_dir,
            r#"{
  "runtime": { "url": "http://fallback.localhost" }
}"#,
        );

        let lookup = read_project_config(&project_dir);
        let _ = std::fs::remove_dir_all(&project_dir);

        let ProjectConfigLookup::Valid(config) = lookup else {
            panic!("expected valid config");
        };
        assert_eq!(config.runtime.mode.as_deref(), Some("portless"));
        assert_eq!(
            config.runtime.url.as_deref(),
            Some("http://fallback.localhost:1355/")
        );
    }

    #[test]
    fn rejects_invalid_runtime_mode() {
        let project_dir = make_temp_project_dir("weekend-config-invalid-runtime-mode");
        write_config(
            &project_dir,
            r#"{
  "runtime": { "mode": "edge", "url": "http://mode.localhost" }
}"#,
        );

        let lookup = read_project_config(&project_dir);
        let _ = std::fs::remove_dir_all(&project_dir);

        let ProjectConfigLookup::Invalid(error) = lookup else {
            panic!("expected invalid config");
        };
        assert!(error.contains("runtime.mode must be 'portless'"));
    }

    #[test]
    fn rejects_direct_runtime_mode() {
        let project_dir = make_temp_project_dir("weekend-config-reject-direct-mode");
        write_config(
            &project_dir,
            r#"{
  "runtime": { "mode": "direct", "url": "http://direct.localhost" }
}"#,
        );

        let lookup = read_project_config(&project_dir);
        let _ = std::fs::remove_dir_all(&project_dir);

        let ProjectConfigLookup::Invalid(error) = lookup else {
            panic!("expected invalid config");
        };
        assert!(error.contains("no longer supported"));
    }

    #[test]
    fn normalizes_runtime_url_without_scheme() {
        let project_dir = make_temp_project_dir("weekend-config-runtime-url-normalize");
        write_config(
            &project_dir,
            r#"{
  "runtime": {
    "mode": "portless",
    "url": "music.localhost/dashboard"
  }
}"#,
        );

        let lookup = read_project_config(&project_dir);
        let _ = std::fs::remove_dir_all(&project_dir);

        let ProjectConfigLookup::Valid(config) = lookup else {
            panic!("expected valid config");
        };
        assert_eq!(
            config.runtime.url.as_deref(),
            Some("http://music.localhost:1355/dashboard")
        );
    }

    #[test]
    fn normalizes_localhost_runtime_url_without_port_to_default_proxy_port() {
        let project_dir =
            make_temp_project_dir("weekend-config-runtime-url-localhost-default-port");
        write_config(
            &project_dir,
            r#"{
  "runtime": {
    "mode": "portless",
    "url": "http://music.localhost"
  }
}"#,
        );

        let lookup = read_project_config(&project_dir);
        let _ = std::fs::remove_dir_all(&project_dir);

        let ProjectConfigLookup::Valid(config) = lookup else {
            panic!("expected valid config");
        };
        assert_eq!(
            config.runtime.url.as_deref(),
            Some("http://music.localhost:1355/")
        );
    }

    #[test]
    fn keeps_explicit_localhost_port_in_runtime_url() {
        let project_dir =
            make_temp_project_dir("weekend-config-runtime-url-localhost-explicit-port");
        write_config(
            &project_dir,
            r#"{
  "runtime": {
    "mode": "portless",
    "url": "http://music.localhost:4567/dashboard"
  }
}"#,
        );

        let lookup = read_project_config(&project_dir);
        let _ = std::fs::remove_dir_all(&project_dir);

        let ProjectConfigLookup::Valid(config) = lookup else {
            panic!("expected valid config");
        };
        assert_eq!(
            config.runtime.url.as_deref(),
            Some("http://music.localhost:4567/dashboard")
        );
    }

    #[test]
    fn rejects_runtime_url_with_non_http_scheme() {
        let project_dir = make_temp_project_dir("weekend-config-runtime-url-reject-scheme");
        write_config(
            &project_dir,
            r#"{
  "runtime": {
    "mode": "portless",
    "url": "ws://example.com/socket"
  }
}"#,
        );

        let lookup = read_project_config(&project_dir);
        let _ = std::fs::remove_dir_all(&project_dir);

        let ProjectConfigLookup::Invalid(error) = lookup else {
            panic!("expected invalid config");
        };
        assert!(error.contains("runtime.url must use http or https"));
    }

    #[test]
    fn rejects_runtime_url_with_non_local_host() {
        let project_dir = make_temp_project_dir("weekend-config-runtime-url-reject-remote");
        write_config(
            &project_dir,
            r#"{
  "runtime": {
    "mode": "portless",
    "url": "https://music.portless.dev"
  }
}"#,
        );

        let lookup = read_project_config(&project_dir);
        let _ = std::fs::remove_dir_all(&project_dir);

        let ProjectConfigLookup::Invalid(error) = lookup else {
            panic!("expected invalid config");
        };
        assert!(error.contains("runtime.url must target a local address"));
    }

    #[test]
    fn write_project_config_preserves_normalized_deploy_url() {
        let project_dir = make_temp_project_dir("weekend-config-deploy-url");
        let startup_commands = vec!["pnpm dev".to_string()];

        write_project_config(
            &project_dir,
            "http://music.localhost",
            &startup_commands,
            None,
            None,
            None,
            Some("example.com/app"),
            false,
            None,
        )
        .expect("write project config");

        let lookup = read_project_config(&project_dir);
        let _ = std::fs::remove_dir_all(&project_dir);

        let ProjectConfigLookup::Valid(config) = lookup else {
            panic!("expected valid config");
        };
        assert_eq!(
            config.runtime.deploy_url.as_deref(),
            Some("https://example.com/app")
        );
    }

    #[test]
    fn normalizes_global_design_system_config() {
        let mut css_variables = HashMap::new();
        css_variables.insert("--focus-ring".to_string(), " #6B97FF ".to_string());
        css_variables.insert("focus-ring".to_string(), "#bad".to_string());
        css_variables.insert("--empty".to_string(), " ".to_string());

        let mut theme_variables = HashMap::new();
        theme_variables.insert(
            "WEEKEND-DARK".to_string(),
            HashMap::from([("--background".to_string(), "#000".to_string())]),
        );
        theme_variables.insert(
            "invalid-theme".to_string(),
            HashMap::from([("--background".to_string(), "#fff".to_string())]),
        );

        let normalized = normalize_design_system_config(DesignSystemConfig {
            version: 99,
            shape: "ROUNDed".to_string(),
            css_variables,
            theme_variables,
        });

        assert_eq!(normalized.version, 1);
        assert_eq!(normalized.shape, "rounded");
        assert_eq!(
            normalized
                .css_variables
                .get("--focus-ring")
                .map(String::as_str),
            Some("#6B97FF")
        );
        assert!(!normalized.css_variables.contains_key("focus-ring"));
        assert!(!normalized.css_variables.contains_key("--empty"));
        assert!(normalized.theme_variables.contains_key("weekend-dark"));
        assert!(!normalized.theme_variables.contains_key("invalid-theme"));
    }

    #[test]
    fn theme_bridge_serializes_global_defaults_before_project_overrides() {
        let defaults = DesignSystemConfig {
            version: 1,
            shape: "rounded".to_string(),
            css_variables: HashMap::from([("--focus-ring".to_string(), "#111111".to_string())]),
            theme_variables: HashMap::from([(
                "weekend-dark".to_string(),
                HashMap::from([("--background".to_string(), "#000000".to_string())]),
            )]),
        };
        let policy = ProjectThemeConfig {
            track_shell: true,
            design_system: Some("weekend".to_string()),
            deploy: None,
            css_variables: HashMap::from([("--focus-ring".to_string(), "#222222".to_string())]),
            theme_variables: HashMap::from([(
                "weekend-dark".to_string(),
                HashMap::from([("--background".to_string(), "#101010".to_string())]),
            )]),
        };

        let script = project_theme_bridge_script("weekend-dark", &defaults, &policy);

        assert!(script.contains("__WEEKEND_THEME_BRIDGE__"));
        assert!(script.contains("\"globalBase\""));
        assert!(script.contains("\"projectBase\""));
        assert!(script.contains("\"theme\":\"weekend-dark\""));
        assert!(script.contains("\"isDark\":true"));
        assert!(script.contains("#111111"));
        assert!(script.contains("#222222"));
        assert!(script.contains("#000000"));
        assert!(script.contains("#101010"));
        assert!(script.contains("\"shape\":\"rounded\""));
        assert!(script.contains("weekend:design-system"));
    }

    #[test]
    fn theme_bridge_serializes_design_system_none_as_null() {
        let defaults = DesignSystemConfig {
            version: 1,
            shape: "rounded".to_string(),
            css_variables: HashMap::from([("--focus-ring".to_string(), "#111111".to_string())]),
            theme_variables: HashMap::new(),
        };
        let policy = ProjectThemeConfig {
            track_shell: true,
            design_system: Some("none".to_string()),
            deploy: None,
            css_variables: HashMap::new(),
            theme_variables: HashMap::new(),
        };

        let script = project_theme_bridge_script("fluid", &defaults, &policy);

        assert!(script.contains("weekend-project-ds-vars"));
        assert!(script.contains("\"designSystem\":null"));
        assert!(!script.contains("#111111"));
    }
}

#[cfg(test)]
mod permission_tests {
    const APP_COMMANDS: &[&str] = &[
        "get_active_theme",
        "set_active_theme",
        "get_design_system_config",
        "set_design_system_config",
        "sync_design_system_into_all_projects",
    ];

    fn command_list<'a>(manifest: &'a toml::Value, identifier: &str, list: &str) -> Vec<&'a str> {
        manifest
            .get("permission")
            .and_then(toml::Value::as_array)
            .and_then(|permissions| {
                permissions.iter().find(|permission| {
                    permission.get("identifier").and_then(toml::Value::as_str) == Some(identifier)
                })
            })
            .and_then(|permission| permission.get("commands"))
            .and_then(|commands| commands.get(list))
            .and_then(toml::Value::as_array)
            .expect("command list exists")
            .iter()
            .map(|value| value.as_str().expect("command is string"))
            .collect()
    }

    #[test]
    fn app_permissions_include_theme_and_design_commands() {
        let manifest: toml::Value =
            toml::from_str(include_str!("../permissions/app-commands.toml"))
                .expect("parse app command permissions");
        let allowed = command_list(&manifest, "allow-app-commands", "allow");
        let denied = command_list(&manifest, "deny-app-commands", "deny");

        for command in APP_COMMANDS {
            assert!(
                allowed.contains(command),
                "{command} missing from allow list"
            );
            assert!(denied.contains(command), "{command} missing from deny list");
        }
    }
}

#[cfg(test)]
mod design_sync_tests {
    use super::{
        sync_design_system_into_project, PROJECT_DESIGN_SYSTEM_DIR_NAME,
        PROJECT_SHARED_ASSETS_DIR_NAME,
    };
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
    fn design_sync_preserves_installed_package_links() {
        let root = make_temp_dir("weekend-design-sync");
        let project_dir = root.join("sandbox");
        let dist_dir = root.join("dist");
        let design_dir = project_dir
            .join(PROJECT_SHARED_ASSETS_DIR_NAME)
            .join(PROJECT_DESIGN_SYSTEM_DIR_NAME);
        let installed_package = design_dir
            .join("node_modules")
            .join("@pierre")
            .join("trees")
            .join("package.json");

        std::fs::create_dir_all(dist_dir.join("registry")).expect("create dist registry");
        std::fs::write(
            dist_dir.join("package.json"),
            r#"{"name":"@weekend/design"}"#,
        )
        .expect("write dist package");
        std::fs::write(dist_dir.join("registry.js"), "export {};").expect("write dist registry");
        std::fs::write(dist_dir.join("registry").join("badge.js"), "export {};")
            .expect("write dist nested file");

        std::fs::create_dir_all(
            installed_package
                .parent()
                .expect("installed package parent"),
        )
        .expect("create installed package");
        std::fs::write(&installed_package, r#"{"name":"@pierre/trees"}"#)
            .expect("write installed package");
        std::fs::write(design_dir.join("stale.txt"), "old").expect("write stale file");

        sync_design_system_into_project(&project_dir, &dist_dir).expect("sync design");

        assert!(installed_package.exists());
        assert!(!design_dir.join("stale.txt").exists());
        assert!(design_dir.join("registry.js").exists());

        let _ = std::fs::remove_dir_all(&root);
    }
}

#[cfg(test)]
mod browser_runtime_probe_tests {
    use super::browser_runtime_status_is_ready;

    #[test]
    fn accepts_success_redirect_and_auth_statuses() {
        assert!(browser_runtime_status_is_ready(200));
        assert!(browser_runtime_status_is_ready(302));
        assert!(browser_runtime_status_is_ready(401));
        assert!(browser_runtime_status_is_ready(403));
    }

    #[test]
    fn rejects_proxy_boot_and_server_error_statuses() {
        assert!(!browser_runtime_status_is_ready(0));
        assert!(!browser_runtime_status_is_ready(404));
        assert!(!browser_runtime_status_is_ready(500));
        assert!(!browser_runtime_status_is_ready(503));
    }
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

fn backfill_design_system_to_projects(app_handle: &AppHandle) -> Result<(), String> {
    let root = weekend_root()?;
    std::fs::create_dir_all(&root)
        .map_err(|error| format!("failed to create ~/.weekend: {error}"))?;

    let dist_dir = design_dist_path(app_handle)?;
    let synced_projects = sync_design_system_into_all_projects_inner(&root, &dist_dir)?;
    if synced_projects > 0 {
        log_backend(
            "INFO",
            format!("synced design system to {synced_projects} project(s) during startup backfill"),
        );
    }

    Ok(())
}

#[tauri::command]
fn sync_design_system_into_all_projects(app_handle: tauri::AppHandle) -> Result<u32, String> {
    let root = weekend_root()?;
    let dist_dir = design_dist_path(&app_handle)?;
    sync_design_system_into_all_projects_inner(&root, &dist_dir)
}

fn backfill_existing_project_configs() -> Result<(), String> {
    let root = weekend_root()?;
    if !root.exists() {
        return Ok(());
    }

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

    for (project_name, project_dir) in entries {
        match read_project_config(&project_dir) {
            ProjectConfigLookup::Valid(config) => {
                let runtime_url = config
                    .runtime
                    .url
                    .unwrap_or_else(|| default_runtime_url_for_project_name(&project_name));
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
                let env_ref = if config.env.is_empty() {
                    None
                } else {
                    Some(&config.env)
                };
                write_project_config(
                    &project_dir,
                    &runtime_url,
                    &startup_commands,
                    procs.as_ref(),
                    config.agents.as_ref(),
                    env_ref,
                    config.runtime.deploy_url.as_deref(),
                    config.archived,
                    None,
                )?;
            }
            ProjectConfigLookup::Missing => {
                let default_procs = default_processes_map(DEFAULT_AGENT_COMMAND);
                let runtime_url = default_runtime_url_for_project_name(&project_name);
                write_project_config(
                    &project_dir,
                    &runtime_url,
                    &default_startup_commands(),
                    Some(&default_procs),
                    None,
                    None,
                    None,
                    false,
                    None,
                )?;
            }
            ProjectConfigLookup::Invalid(error) => {
                let config_path = project_config_path(&project_dir);
                let recovered = std::fs::read_to_string(&config_path)
                    .ok()
                    .and_then(|raw| serde_json::from_str::<ProjectConfig>(&raw).ok());

                if let Some(parsed) = recovered {
                    let startup_commands = if parsed.startup.commands.is_empty() {
                        default_startup_commands()
                    } else {
                        normalize_startup_commands(&parsed.startup.commands)
                    };
                    let resolved_processes =
                        resolve_processes(parsed.processes.as_ref(), &startup_commands);
                    let procs = if resolved_processes.is_empty() {
                        None
                    } else {
                        Some(resolved_processes)
                    };
                    let runtime_url = normalize_runtime_url(parsed.runtime.url.as_deref())
                        .ok()
                        .flatten()
                        .unwrap_or_else(|| default_runtime_url_for_project_name(&project_name));
                    let deploy_url = normalize_deploy_url(parsed.runtime.deploy_url.as_deref())
                        .ok()
                        .flatten();
                    log_backend(
                        "WARN",
                        format!(
                            "project={project_name} had invalid runtime config ({error}); preserving/recovering runtime.url={runtime_url}"
                        ),
                    );
                    write_project_config(
                        &project_dir,
                        &runtime_url,
                        &startup_commands,
                        procs.as_ref(),
                        parsed.agents.as_ref(),
                        parsed.env.as_ref(),
                        deploy_url.as_deref(),
                        parsed.archived,
                        None,
                    )?;
                } else {
                    log_backend(
                        "WARN",
                        format!("skipping config backfill for project={project_name}: {error}"),
                    );
                }
            }
        }
    }

    Ok(())
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

pub(crate) fn run() {
    log_backend("INFO", "weekend backend starting");
    tauri::Builder::default()
        .manage(TerminalState::new())
        .manage(BridgeState::new())
        .manage(EventBufferState::new())
        .on_window_event(|window, event| {
            if window.label() != SHARED_DROP_WINDOW_LABEL {
                return;
            }

            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
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
                if let Some(project_name) = project_name_from_browser_webview_label(&label) {
                    if let Err(error) =
                        sync_project_bridge_port_file(project_name, bridge_state.inner())
                    {
                        log_backend(
                            "WARN",
                            format!(
                                "failed to sync project bridge port file for project={project_name}: {error}"
                            ),
                        );
                    }
                }

                // Mark as not-ready at navigation start and wait for explicit
                // browser bridge ready callbacks before handling tool actions.
                if matches!(payload.event(), tauri::webview::PageLoadEvent::Started) {
                    bridge_state.mark_bridge_loading(&label, Some(payload.url().to_string()));
                }

                // Earliest available injection point for child webviews.
                let theme_preamble = project_name_from_browser_webview_label(&label)
                    .and_then(theme_injection_preamble)
                    .unwrap_or_default();
                let _ = webview.eval(crate::js::browser_bridge_with_preamble(&theme_preamble));

                // Inject Cmd/Ctrl+R reload shortcut into the embedded browser.
                // Keyboard events inside a child Webview never reach the main
                // window's JS, so we wire the shortcut directly in the overlay.
                if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                    let _ = webview.eval(crate::js::reload_shortcut());

                    // Re-inject at finished as a fallback for pages that block
                    // early eval timing; bridge script is idempotent/versioned.
                    let theme_preamble = project_name_from_browser_webview_label(&label)
                        .and_then(theme_injection_preamble)
                        .unwrap_or_default();
                    let _ = webview.eval(crate::js::browser_bridge_with_preamble(&theme_preamble));

                    // Re-apply stored observer config if any
                    let ebs: tauri::State<'_, EventBufferState> = webview.state();
                    let config = ebs.get_observer_config(&label);
                    if let Ok(script) = crate::js::configure_observers(&config) {
                        let _ = webview.eval(script);
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
            if let Err(error) = backfill_mcp_configs() {
                log_backend("WARN", format!("mcp config backfill skipped: {error}"));
            }
            if let Err(error) = backfill_shared_assets_to_projects() {
                log_backend("WARN", format!("shared assets backfill skipped: {error}"));
            }
            if let Err(error) = backfill_design_system_to_projects(app.handle()) {
                log_backend("WARN", format!("design system backfill skipped: {error}"));
            }
            spawn_project_tree_watcher(app.handle().clone());
            bridge_server::start(app.handle().clone());

            let terminal_state: tauri::State<'_, TerminalState> = app.state();
            spawn_terminal_process_watcher(app.handle().clone(), terminal_state.inner().clone());

            #[cfg(target_os = "macos")]
            if let Err(error) = install_shared_drop_tray(app.handle()) {
                log_backend("WARN", format!("shared-drop tray setup skipped: {error}"));
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            projects::create_new_project,
            projects::presets_list_dirs,
            projects::presets_read_manifest,
            projects::create_from_preset,
            projects::open_external_url,
            shared_assets::shared_env_read,
            shared_assets::shared_env_write,
            shared_assets::shared_assets_list,
            shared_assets::shared_assets_read_binary,
            shared_assets::shared_assets_read_text,
            shared_assets::shared_assets_upload_batch,
            shared_assets::shared_assets_import_paths,
            shared_assets::shared_assets_rename,
            shared_assets::shared_assets_delete,
            projects::list_projects,
            projects::project_config_read,
            projects::project_config_write,
            projects::delete_project,
            projects::archive_project,
            projects::unarchive_project,
            projects::rename_project,
            project_tree::list_project_tree,
            project_files::read_project_file,
            project_files::write_project_file,
            project_files::read_project_file_binary,
            project_files::rename_project_path,
            project_files::delete_project_path,
            project_files::git_changed_files,
            project_files::git_changed_files_with_diffs,
            project_files::git_diff_file,
            project_files::import_external_files_to_project,
            terminal::terminal_open,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_close,
            terminal::terminal_list,
            terminal::terminal_active_processes,
            terminal::terminal_get_all_sessions,
            terminal::terminal_set_custom_name,
            terminal::terminal_remove_session,
            browser::browser_history_navigate,
            browser::browser_navigate,
            browser::browser_close_stale_webviews,
            browser::browser_probe_runtime_url,
            browser::browser_push_event,
            browser::browser_bridge_ready,
            browser::browser_start_element_grab,
            browser::browser_stop_element_grab,
            browser::browser_eval_result,
            browser::browser_capture_screenshot,
            browser::project_save_preview,
            browser::project_load_preview,
            terminal::runtime_debug_dump,
            log_commands::ui_log_batch,
            log_commands::logs_read_weekend,
            log_commands::logs_read_project,
            terminal::shell_name,
            shared_drop::set_traffic_lights_visible,
            runtime_probe::find_available_port,
            runtime_probe::probe_runtime_url,
            theme::get_active_theme,
            theme::set_active_theme,
            theme::get_design_system_config,
            theme::set_design_system_config,
            sync_design_system_into_all_projects
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
