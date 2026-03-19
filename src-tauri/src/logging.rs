use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::{is_safe_project_name, weekend_root};

const LOG_ROTATE_MAX_BYTES: u64 = 2 * 1024 * 1024;
const LOG_ROTATE_ARCHIVE_COUNT: usize = 6;
const LOG_MESSAGE_MAX_CHARS: usize = 8000;
pub(crate) const LOG_TAIL_DEFAULT_MAX_BYTES: usize = 128 * 1024;

static LOG_FILE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

pub(crate) fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().try_into().unwrap_or(u64::MAX))
        .unwrap_or(0)
}

fn log_file_lock() -> &'static Mutex<()> {
    LOG_FILE_LOCK.get_or_init(|| Mutex::new(()))
}

fn logs_dir() -> Result<PathBuf, String> {
    let root = weekend_root()?;
    let dir = root.join("logs");
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("failed to create log directory {}: {error}", dir.display()))?;
    Ok(dir)
}

pub(crate) fn surface_log_path(surface: &str) -> Result<PathBuf, String> {
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

pub(crate) fn append_log(surface: &str, level: &str, message: &str) -> Result<(), String> {
    let _guard = log_file_lock()
        .lock()
        .map_err(|_| "failed to lock log writer".to_string())?;
    let path = surface_log_path(surface)?;
    append_log_to_path(&path, level, message)
}

pub(crate) fn log_backend(level: &str, message: impl AsRef<str>) {
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

pub(crate) fn project_log_path(project: &str) -> Result<PathBuf, String> {
    if !is_safe_project_name(project) {
        return Err("invalid project name".to_string());
    }
    Ok(project_logs_dir()?.join(format!("{project}.log")))
}

pub(crate) fn read_log_tail_from_path(path: &Path, max_bytes: usize) -> Result<String, String> {
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
