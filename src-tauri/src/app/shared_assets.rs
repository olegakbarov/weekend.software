use super::project_files::ProjectFileBinaryPayload;
use super::*;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SharedAssetSnapshot {
    file_name: String,
    size_bytes: u64,
    modified_at_unix_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SharedAssetUploadInput {
    file_name: String,
    data_base64: String,
}

const SHARED_ENV_FILE_NAME: &str = "shared.env.json";

fn shared_env_path() -> Result<PathBuf, String> {
    Ok(weekend_root()?.join(SHARED_ENV_FILE_NAME))
}

pub(crate) fn read_shared_env() -> Result<HashMap<String, String>, String> {
    let path = shared_env_path()?;
    let raw = match std::fs::read_to_string(&path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(HashMap::new());
        }
        Err(error) => {
            return Err(format!("failed to read {}: {error}", path.display()));
        }
    };
    serde_json::from_str(&raw)
        .map_err(|error| format!("failed to parse {}: {error}", path.display()))
}

fn write_shared_env(env: &HashMap<String, String>) -> Result<(), String> {
    let path = shared_env_path()?;
    let serialized = serde_json::to_string_pretty(env)
        .map_err(|error| format!("failed to serialize shared env: {error}"))?;
    std::fs::write(&path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", path.display()))
}

pub(crate) fn shared_assets_root() -> Result<PathBuf, String> {
    Ok(weekend_root()?.join(SHARED_ASSETS_ROOT_DIR_NAME))
}

pub(crate) fn ensure_shared_assets_root() -> Result<PathBuf, String> {
    let path = shared_assets_root()?;
    std::fs::create_dir_all(&path).map_err(|error| {
        format!(
            "failed to create shared assets directory {}: {error}",
            path.display()
        )
    })?;
    Ok(path)
}

fn import_shared_asset_from_path(source_path: &Path, shared_root: &Path) -> Result<String, String> {
    if !source_path.exists() {
        return Err(format!(
            "cannot import shared asset '{}': source file does not exist",
            source_path.display()
        ));
    }
    if !source_path.is_file() {
        return Err(format!(
            "cannot import shared asset '{}': source path is not a file",
            source_path.display()
        ));
    }

    let file_name = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| {
            format!(
                "cannot import shared asset '{}': invalid file name",
                source_path.display()
            )
        })?;
    let file_name = sanitize_shared_asset_file_name(file_name)?;
    let target_path = shared_root.join(&file_name);
    std::fs::copy(source_path, &target_path).map_err(|error| {
        format!(
            "failed to copy shared asset {} -> {}: {error}",
            source_path.display(),
            target_path.display()
        )
    })?;
    Ok(file_name)
}

fn shared_asset_target_path(
    shared_root: &Path,
    file_name: &str,
) -> Result<(String, PathBuf), String> {
    let normalized = sanitize_shared_asset_file_name(file_name)?;
    Ok((normalized.clone(), shared_root.join(normalized)))
}

fn rename_shared_asset_in_root(
    shared_root: &Path,
    file_name: &str,
    new_file_name: &str,
) -> Result<(String, String), String> {
    let (current_name, current_path) = shared_asset_target_path(shared_root, file_name)?;
    let (next_name, next_path) = shared_asset_target_path(shared_root, new_file_name)?;

    if current_name == next_name {
        return Ok((current_name, next_name));
    }
    if !current_path.exists() {
        return Err(format!("shared asset '{}' was not found", current_name));
    }
    if !current_path.is_file() {
        return Err(format!("shared asset '{}' is not a file", current_name));
    }

    let is_case_only_rename =
        current_name != next_name && current_name.to_lowercase() == next_name.to_lowercase();
    if is_case_only_rename {
        let temporary_path =
            shared_root.join(format!(".shared-asset-rename-{}", uuid::Uuid::new_v4()));
        std::fs::rename(&current_path, &temporary_path).map_err(|error| {
            format!(
                "failed to rename shared asset {} -> {}: {error}",
                current_path.display(),
                temporary_path.display()
            )
        })?;
        if let Err(error) = std::fs::rename(&temporary_path, &next_path) {
            let _ = std::fs::rename(&temporary_path, &current_path);
            return Err(format!(
                "failed to rename shared asset {} -> {}: {error}",
                current_path.display(),
                next_path.display()
            ));
        }
        return Ok((current_name, next_name));
    }

    if next_path.exists() {
        return Err(format!("shared asset '{}' already exists", next_name));
    }

    std::fs::rename(&current_path, &next_path).map_err(|error| {
        format!(
            "failed to rename shared asset {} -> {}: {error}",
            current_path.display(),
            next_path.display()
        )
    })?;

    Ok((current_name, next_name))
}

pub(crate) fn project_shared_assets_dir(project_dir: &Path) -> PathBuf {
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

fn to_unix_ms(time: SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|duration| u64::try_from(duration.as_millis()).ok())
}

fn collect_shared_asset_source_paths(shared_root: &Path) -> Result<Vec<(String, PathBuf)>, String> {
    if !shared_root.exists() {
        return Ok(Vec::new());
    }

    let mut source_paths: Vec<(String, PathBuf)> = std::fs::read_dir(shared_root)
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

    source_paths.sort_by(|left, right| {
        left.0
            .to_ascii_lowercase()
            .cmp(&right.0.to_ascii_lowercase())
            .then_with(|| left.0.cmp(&right.0))
    });

    Ok(source_paths)
}

pub(crate) fn list_shared_asset_snapshots(
    shared_root: &Path,
) -> Result<Vec<SharedAssetSnapshot>, String> {
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

pub(crate) fn list_user_project_dirs(weekend_root: &Path) -> Result<Vec<PathBuf>, String> {
    if !weekend_root.exists() {
        return Ok(Vec::new());
    }

    let entries = std::fs::read_dir(weekend_root)
        .map_err(|error| format!("failed to read ~/.weekend: {error}"))?;

    let mut project_dirs = Vec::new();
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

        project_dirs.push(entry.path());
    }

    Ok(project_dirs)
}

pub(crate) fn sync_shared_assets_into_project(
    project_dir: &Path,
    shared_root: &Path,
) -> Result<u32, String> {
    let source_paths = collect_shared_asset_source_paths(shared_root)?;
    let source_names: HashSet<&str> = source_paths
        .iter()
        .map(|(file_name, _)| file_name.as_str())
        .collect();

    let project_shared_assets = project_shared_assets_dir(project_dir);
    if !source_paths.is_empty() {
        std::fs::create_dir_all(&project_shared_assets).map_err(|error| {
            format!(
                "failed to create project shared assets directory {}: {error}",
                project_shared_assets.display()
            )
        })?;
    }

    if project_shared_assets.exists() {
        let project_entries = std::fs::read_dir(&project_shared_assets).map_err(|error| {
            format!(
                "failed to read project shared assets directory {}: {error}",
                project_shared_assets.display()
            )
        })?;
        for entry in project_entries.flatten() {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if !file_type.is_file() {
                continue;
            }
            let Ok(file_name) = entry.file_name().into_string() else {
                continue;
            };
            if source_names.contains(file_name.as_str()) {
                continue;
            }
            std::fs::remove_file(entry.path()).map_err(|error| {
                format!(
                    "failed to remove stale shared asset {}: {error}",
                    entry.path().display()
                )
            })?;
        }
    }

    if source_paths.is_empty() {
        return Ok(0);
    }

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

pub(crate) fn sync_shared_assets_into_all_projects(
    weekend_root: &Path,
    shared_root: &Path,
) -> Result<u32, String> {
    let project_dirs = list_user_project_dirs(weekend_root)?;
    let mut synced_projects = 0u32;
    for project_dir in project_dirs {
        sync_shared_assets_into_project(&project_dir, shared_root)?;
        synced_projects += 1;
    }

    Ok(synced_projects)
}

#[tauri::command]
pub(crate) fn shared_env_read() -> Result<HashMap<String, String>, String> {
    read_shared_env()
}

#[tauri::command]
pub(crate) fn shared_env_write(
    env: HashMap<String, String>,
) -> Result<HashMap<String, String>, String> {
    write_shared_env(&env)?;
    Ok(env)
}

#[tauri::command]
pub(crate) fn shared_assets_list() -> Result<Vec<SharedAssetSnapshot>, String> {
    let shared_root = ensure_shared_assets_root()?;
    list_shared_asset_snapshots(&shared_root)
}

#[tauri::command]
pub(crate) fn shared_assets_read_text(file_name: String) -> Result<String, String> {
    let shared_root = ensure_shared_assets_root()?;
    let sanitized = sanitize_shared_asset_file_name(&file_name)?;
    let path = shared_root.join(&sanitized);
    if !path.is_file() {
        return Err(format!("shared asset {sanitized} is not a file"));
    }
    std::fs::read_to_string(&path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))
}

#[tauri::command]
pub(crate) fn shared_assets_read_binary(
    file_name: String,
) -> Result<ProjectFileBinaryPayload, String> {
    let shared_root = ensure_shared_assets_root()?;
    let sanitized = sanitize_shared_asset_file_name(&file_name)?;
    let path = shared_root.join(&sanitized);
    if !path.is_file() {
        return Err(format!("shared asset {sanitized} is not a file"));
    }
    let metadata = std::fs::metadata(&path)
        .map_err(|error| format!("failed to inspect {}: {error}", path.display()))?;
    if metadata.len() > MAX_PREVIEW_FILE_BYTES {
        return Err(format!(
            "file is too large to preview ({} bytes, limit {} bytes)",
            metadata.len(),
            MAX_PREVIEW_FILE_BYTES
        ));
    }
    let bytes = std::fs::read(&path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    Ok(ProjectFileBinaryPayload {
        data_base64: BASE64_STANDARD.encode(bytes.as_slice()),
        size_bytes: bytes.len() as u64,
    })
}

#[tauri::command]
pub(crate) fn shared_assets_upload_batch(
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
pub(crate) fn shared_assets_import_paths(
    paths: Vec<String>,
) -> Result<Vec<SharedAssetSnapshot>, String> {
    if paths.is_empty() {
        return shared_assets_list();
    }

    let root = weekend_root()?;
    std::fs::create_dir_all(&root)
        .map_err(|error| format!("failed to create ~/.weekend: {error}"))?;
    let shared_root = ensure_shared_assets_root()?;

    let mut imported_count = 0u32;
    for raw_path in paths {
        let trimmed = raw_path.trim();
        if trimmed.is_empty() {
            continue;
        }
        import_shared_asset_from_path(Path::new(trimmed), &shared_root)?;
        imported_count += 1;
    }

    let synced_projects = sync_shared_assets_into_all_projects(&root, &shared_root)?;
    log_backend(
        "INFO",
        format!(
            "imported {imported_count} shared asset(s) from paths and synced {synced_projects} project(s)"
        ),
    );

    list_shared_asset_snapshots(&shared_root)
}

#[tauri::command]
pub(crate) fn shared_assets_delete(file_name: String) -> Result<Vec<SharedAssetSnapshot>, String> {
    let root = weekend_root()?;
    std::fs::create_dir_all(&root)
        .map_err(|error| format!("failed to create ~/.weekend: {error}"))?;
    let shared_root = ensure_shared_assets_root()?;
    let (normalized_name, target_path) = shared_asset_target_path(&shared_root, &file_name)?;

    if target_path.exists() {
        if !target_path.is_file() {
            return Err(format!("shared asset '{}' is not a file", normalized_name));
        }
        std::fs::remove_file(&target_path).map_err(|error| {
            format!(
                "failed to remove shared asset {}: {error}",
                target_path.display()
            )
        })?;
    }

    let synced_projects = sync_shared_assets_into_all_projects(&root, &shared_root)?;
    log_backend(
        "INFO",
        format!("deleted shared asset '{normalized_name}' and synced {synced_projects} project(s)"),
    );

    list_shared_asset_snapshots(&shared_root)
}

#[tauri::command]
pub(crate) fn shared_assets_rename(
    file_name: String,
    new_file_name: String,
) -> Result<Vec<SharedAssetSnapshot>, String> {
    let root = weekend_root()?;
    std::fs::create_dir_all(&root)
        .map_err(|error| format!("failed to create ~/.weekend: {error}"))?;
    let shared_root = ensure_shared_assets_root()?;
    let (previous_name, next_name) =
        rename_shared_asset_in_root(&shared_root, &file_name, &new_file_name)?;

    let synced_projects = sync_shared_assets_into_all_projects(&root, &shared_root)?;
    log_backend(
        "INFO",
        format!(
            "renamed shared asset '{previous_name}' -> '{next_name}' and synced {synced_projects} project(s)"
        ),
    );

    list_shared_asset_snapshots(&shared_root)
}
