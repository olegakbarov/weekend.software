use super::*;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UiLogEntry {
    level: String,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WeekendLogsSnapshot {
    backend: String,
    frontend: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectLogsSnapshot {
    project: String,
    content: String,
}

#[tauri::command]
pub(crate) fn ui_log_batch(entries: Vec<UiLogEntry>) -> Result<(), String> {
    if entries.is_empty() {
        return Ok(());
    }

    for entry in entries.into_iter().take(500) {
        append_log("frontend", &entry.level, &entry.message)?;
    }

    Ok(())
}

#[tauri::command]
pub(crate) fn logs_read_weekend(max_bytes: Option<usize>) -> Result<WeekendLogsSnapshot, String> {
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
pub(crate) fn logs_read_project(
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
