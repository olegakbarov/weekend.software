use super::*;

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
pub(crate) fn create_new_project(
    app_handle: tauri::AppHandle,
    name: Option<String>,
    default_agent_command: Option<String>,
    default_agent_profile_id: Option<String>,
    github_repo_url: Option<String>,
    initial_prompt: Option<String>,
    design_system: Option<String>,
    deploy: Option<String>,
    file_writes: Option<HashMap<String, String>>,
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
        format!("untitled-{timestamp}")
    } else {
        sanitized_name
    };

    let mut candidate = weekend_root.join(&base_name);
    let mut suffix: u32 = 2;

    while candidate.exists() {
        candidate = weekend_root.join(format!("{base_name}-{suffix}"));
        suffix += 1;
    }

    let resolved_agent_command = normalize_process_command(
        default_agent_command
            .as_deref()
            .unwrap_or(DEFAULT_AGENT_COMMAND),
    )
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
    let created_runtime_mode = ProjectRuntimeMode::Portless;
    let created_runtime_url = default_runtime_url_for_project_name(project_name);
    let default_processes = default_processes_map(&resolved_agent_command);
    let default_agents =
        normalize_optional_string(default_agent_profile_id).map(|default| ProjectAgentsConfig {
            default: Some(default),
        });
    let design_choice = normalize_design_system_choice(design_system.as_deref());
    let deploy_choice = normalize_deploy_choice(deploy.as_deref());
    write_project_config(
        &candidate,
        &created_runtime_url,
        &default_startup_commands(),
        Some(&default_processes),
        default_agents.as_ref(),
        None,
        None,
        false,
        None,
    )?;
    write_project_design_system_choice(&candidate, &design_choice)?;
    write_project_deploy_choice(&candidate, &deploy_choice)?;
    let shared_root = ensure_shared_assets_root()?;
    sync_shared_assets_into_project(&candidate, &shared_root)?;

    let install_weekend_design = design_choice != "none";

    if install_weekend_design {
        match design_dist_path(&app_handle) {
            Ok(dist_dir) => {
                if let Err(error) = sync_design_system_into_project(&candidate, &dist_dir) {
                    log_backend(
                        "WARN",
                        format!(
                            "failed to sync design system into {}: {error}",
                            candidate.display()
                        ),
                    );
                }
            }
            Err(error) => {
                log_backend(
                    "WARN",
                    format!("design system unavailable for new project: {error}"),
                );
            }
        }
    } else {
        log_backend(
            "INFO",
            format!(
                "design system skipped for {} (design_system=none)",
                candidate.display()
            ),
        );
    }
    seed_agent_runtime_guidance_files(&candidate, SeedMode::Create)?;
    if let Some(prompt) = normalize_optional_string(initial_prompt) {
        let prompt_path = candidate.join("PROMPT.md");
        std::fs::write(&prompt_path, prompt)
            .map_err(|error| format!("failed to write {}: {error}", prompt_path.display()))?;
        let marker_path = candidate
            .join(PROJECT_WEEKEND_DIR_NAME)
            .join(AGENT_STARTUP_MARKER_FILE_NAME);
        std::fs::write(&marker_path, "")
            .map_err(|error| format!("failed to write {}: {error}", marker_path.display()))?;
    }
    if let Some(writes) = file_writes {
        apply_project_file_writes(&candidate, &writes)?;
    }
    if resolved_github_repo_url.is_none() {
        init_git_repo(&candidate)?;
    }

    log_backend(
        "INFO",
        format!(
            "created project {} with runtime mode={} runtime.url={}",
            candidate.display(),
            created_runtime_mode.as_str(),
            created_runtime_url
        ),
    );

    Ok(candidate.display().to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PresetDirEntry {
    id: String,
    path: String,
}

fn validate_preset_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.contains('/')
        || id.contains('\\')
        || id.starts_with('.')
        || id.contains("..")
    {
        return Err(format!("invalid preset id: {id}"));
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn presets_list_dirs() -> Result<Vec<PresetDirEntry>, String> {
    let weekend = weekend_root()?;
    let presets_dir = weekend.join("presets");
    if !presets_dir.exists() {
        return Ok(Vec::new());
    }
    let entries = std::fs::read_dir(&presets_dir)
        .map_err(|error| format!("failed to read {}: {error}", presets_dir.display()))?;
    let mut out = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let manifest_path = path.join(".weekend").join("preset.json");
        if !manifest_path.is_file() {
            continue;
        }
        let id = match path.file_name().and_then(|name| name.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };
        out.push(PresetDirEntry {
            id,
            path: path.display().to_string(),
        });
    }
    Ok(out)
}

#[tauri::command]
pub(crate) fn presets_read_manifest(id: String) -> Result<String, String> {
    validate_preset_id(&id)?;
    let weekend = weekend_root()?;
    let manifest_path = weekend
        .join("presets")
        .join(&id)
        .join(".weekend")
        .join("preset.json");
    std::fs::read_to_string(&manifest_path)
        .map_err(|error| format!("failed to read {}: {error}", manifest_path.display()))
}

fn apply_project_file_writes(
    project_dir: &Path,
    file_writes: &HashMap<String, String>,
) -> Result<(), String> {
    for (rel, content) in file_writes {
        let safe_rel = std::path::Path::new(rel);
        if safe_rel.is_absolute()
            || safe_rel
                .components()
                .any(|c| matches!(c, std::path::Component::ParentDir))
        {
            return Err(format!("invalid file write path: {rel}"));
        }
        let target = project_dir.join(safe_rel);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("failed to create dir {}: {error}", parent.display()))?;
        }
        std::fs::write(&target, content)
            .map_err(|error| format!("failed to write {}: {error}", target.display()))?;
    }
    Ok(())
}

fn patch_project_agent_config(
    project_dir: &Path,
    profile_id: Option<&str>,
    agent_command: Option<&str>,
) -> Result<(), String> {
    if profile_id.is_none() && agent_command.is_none() {
        return Ok(());
    }
    let cfg_path = project_dir.join("weekend.config.json");
    if !cfg_path.is_file() {
        return Ok(());
    }
    let text = std::fs::read_to_string(&cfg_path)
        .map_err(|error| format!("failed to read {}: {error}", cfg_path.display()))?;
    let mut value: serde_json::Value = serde_json::from_str(&text)
        .map_err(|error| format!("invalid weekend.config.json: {error}"))?;
    if let Some(obj) = value.as_object_mut() {
        if let Some(profile_id) = profile_id {
            let agents = obj.entry("agents").or_insert_with(|| serde_json::json!({}));
            if let Some(agents_obj) = agents.as_object_mut() {
                agents_obj.insert(
                    "default".to_string(),
                    serde_json::Value::String(profile_id.to_string()),
                );
            }
        }
        if let Some(agent_command) = agent_command {
            let processes = obj
                .entry("processes")
                .or_insert_with(|| serde_json::json!({}));
            if let Some(processes_obj) = processes.as_object_mut() {
                let agent = processes_obj
                    .entry("agent")
                    .or_insert_with(|| serde_json::json!({ "role": "agent" }));
                if let Some(agent_obj) = agent.as_object_mut() {
                    agent_obj.insert(
                        "command".to_string(),
                        serde_json::Value::String(agent_command.to_string()),
                    );
                    agent_obj
                        .entry("role")
                        .or_insert_with(|| serde_json::Value::String("agent".to_string()));
                }
            }
        }
    }
    let serialized = serde_json::to_string_pretty(&value)
        .map_err(|error| format!("failed to serialize weekend.config.json: {error}"))?;
    std::fs::write(&cfg_path, serialized)
        .map_err(|error| format!("failed to write {}: {error}", cfg_path.display()))
}

#[tauri::command]
pub(crate) fn create_from_preset(
    app_handle: tauri::AppHandle,
    preset_id: String,
    project_name: String,
    file_writes: HashMap<String, String>,
    default_agent_profile_id: Option<String>,
    default_agent_command: Option<String>,
    initial_prompt: Option<String>,
) -> Result<String, String> {
    validate_preset_id(&preset_id)?;

    let weekend_root = weekend_root()?;
    std::fs::create_dir_all(&weekend_root)
        .map_err(|error| format!("failed to create ~/.weekend: {error}"))?;

    let preset_dir = weekend_root.join("presets").join(&preset_id);
    if !preset_dir.is_dir() {
        return Err(format!("preset not found: {preset_id}"));
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| format!("failed to read system clock: {error}"))?
        .as_secs();
    let sanitized = sanitize_project_name(&project_name);
    let base_name = if sanitized.is_empty() {
        format!("untitled-{timestamp}")
    } else {
        sanitized
    };
    let mut candidate = weekend_root.join(&base_name);
    let mut suffix: u32 = 2;
    while candidate.exists() {
        candidate = weekend_root.join(format!("{base_name}-{suffix}"));
        suffix += 1;
    }

    if let Err(error) = copy_dir_recursive(&preset_dir, &candidate) {
        let _ = std::fs::remove_dir_all(&candidate);
        return Err(format!("failed to copy preset: {error}"));
    }

    let copied_manifest = candidate.join(".weekend").join("preset.json");
    if copied_manifest.exists() {
        let _ = std::fs::remove_file(&copied_manifest);
    }

    if let Err(error) = apply_project_file_writes(&candidate, &file_writes) {
        let _ = std::fs::remove_dir_all(&candidate);
        return Err(error);
    }

    let resolved_profile_id = normalize_optional_string(default_agent_profile_id);
    let resolved_agent_command = normalize_optional_string(default_agent_command)
        .and_then(|cmd| normalize_process_command(&cmd));
    patch_project_agent_config(
        &candidate,
        resolved_profile_id.as_deref(),
        resolved_agent_command.as_deref(),
    )?;

    let shared_root = ensure_shared_assets_root()?;
    sync_shared_assets_into_project(&candidate, &shared_root)?;

    let install_design = std::fs::read_to_string(candidate.join("package.json"))
        .map(|text| text.contains("@weekend/design"))
        .unwrap_or(false);
    if install_design {
        match design_dist_path(&app_handle) {
            Ok(dist_dir) => {
                if let Err(error) = sync_design_system_into_project(&candidate, &dist_dir) {
                    log_backend(
                        "WARN",
                        format!(
                            "failed to sync design system into {}: {error}",
                            candidate.display()
                        ),
                    );
                }
            }
            Err(error) => {
                log_backend(
                    "WARN",
                    format!("design system unavailable for preset: {error}"),
                );
            }
        }
    }

    seed_agent_runtime_guidance_files(&candidate, SeedMode::Create)?;

    if let Some(prompt) = normalize_optional_string(initial_prompt) {
        let prompt_path = candidate.join("PROMPT.md");
        std::fs::write(&prompt_path, prompt)
            .map_err(|error| format!("failed to write {}: {error}", prompt_path.display()))?;
        let marker_path = candidate
            .join(PROJECT_WEEKEND_DIR_NAME)
            .join(AGENT_STARTUP_MARKER_FILE_NAME);
        std::fs::write(&marker_path, "")
            .map_err(|error| format!("failed to write {}: {error}", marker_path.display()))?;
    }

    init_git_repo(&candidate)?;

    log_backend(
        "INFO",
        format!(
            "created project {} from preset {}",
            candidate.display(),
            preset_id
        ),
    );

    Ok(candidate.display().to_string())
}

#[tauri::command]
pub(crate) fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err("only http(s) URLs are allowed".to_string());
    }

    #[cfg(target_os = "macos")]
    let spawn = std::process::Command::new("open").arg(trimmed).spawn();

    #[cfg(target_os = "linux")]
    let spawn = std::process::Command::new("xdg-open").arg(trimmed).spawn();

    #[cfg(target_os = "windows")]
    let spawn = std::process::Command::new("cmd")
        .args(["/C", "start", "", trimmed])
        .spawn();

    spawn
        .map(|_| ())
        .map_err(|error| format!("failed to open url: {error}"))
}

#[tauri::command]
pub(crate) fn list_projects(archived: Option<bool>) -> Result<Vec<String>, String> {
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
pub(crate) fn project_config_read(project: String) -> Result<ProjectConfigReadSnapshot, String> {
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
            runtime_mode: config.runtime.mode,
            runtime_url: config.runtime.url,
            deploy_url: config.runtime.deploy_url,
            startup_commands: config.startup_commands,
            processes: config.processes,
            agents: config.agents,
            env: config.env,
            theme: config.theme,
            source: "project-config".to_string(),
            error: None,
            archived: config.archived,
        }),
        ProjectConfigLookup::Missing => Ok(ProjectConfigReadSnapshot {
            project,
            project_dir: project_dir_string,
            config_path: config_path_string,
            config_exists: false,
            config_valid: false,
            runtime_mode: None,
            runtime_url: None,
            deploy_url: None,
            startup_commands: Vec::new(),
            processes: HashMap::new(),
            agents: None,
            env: HashMap::new(),
            theme: ProjectThemeConfig::default(),
            source: "missing".to_string(),
            error: None,
            archived: false,
        }),
        ProjectConfigLookup::Invalid(error) => Ok(ProjectConfigReadSnapshot {
            project,
            project_dir: project_dir_string,
            config_path: config_path_string,
            config_exists: true,
            config_valid: false,
            runtime_mode: None,
            runtime_url: None,
            deploy_url: None,
            startup_commands: Vec::new(),
            processes: HashMap::new(),
            agents: None,
            env: HashMap::new(),
            theme: ProjectThemeConfig::default(),
            source: "invalid".to_string(),
            error: Some(error),
            archived: false,
        }),
    }
}

#[tauri::command]
pub(crate) fn project_config_write(
    project: String,
    startup_commands: Option<Vec<String>>,
    env: Option<HashMap<String, String>>,
    deploy_url: Option<String>,
    theme: Option<ProjectThemeConfig>,
) -> Result<ProjectConfigReadSnapshot, String> {
    let project_name = project.trim();
    if project_name.is_empty() {
        return Err("project is required".to_string());
    }

    let project_dir = resolve_project_dir(project_name)?;
    let existing = read_project_config(&project_dir);
    let runtime_url = match &existing {
        ProjectConfigLookup::Valid(config) => config
            .runtime
            .url
            .clone()
            .unwrap_or_else(|| default_runtime_url_for_project_name(project_name)),
        ProjectConfigLookup::Invalid(_) => {
            recover_runtime_url_from_raw_project_config(&project_dir)
                .unwrap_or_else(|| default_runtime_url_for_project_name(project_name))
        }
        ProjectConfigLookup::Missing => default_runtime_url_for_project_name(project_name),
    };
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
    let resolved_env = match env {
        Some(e) => Some(e),
        None => match &existing {
            ProjectConfigLookup::Valid(config) if !config.env.is_empty() => {
                Some(config.env.clone())
            }
            _ => None,
        },
    };
    let resolved_deploy_url = match deploy_url {
        Some(value) => normalize_deploy_url(Some(value.as_str()))?,
        None => match &existing {
            ProjectConfigLookup::Valid(config) => config.runtime.deploy_url.clone(),
            ProjectConfigLookup::Invalid(_) => {
                recover_deploy_url_from_raw_project_config(&project_dir)
            }
            ProjectConfigLookup::Missing => None,
        },
    };
    let resolved_archived = match &existing {
        ProjectConfigLookup::Valid(config) => config.archived,
        _ => false,
    };
    let resolved_agents = match &existing {
        ProjectConfigLookup::Valid(config) => config.agents.clone(),
        ProjectConfigLookup::Invalid(_) => {
            std::fs::read_to_string(project_config_path(&project_dir))
                .ok()
                .and_then(|raw| serde_json::from_str::<ProjectConfig>(&raw).ok())
                .and_then(|config| config.agents)
        }
        ProjectConfigLookup::Missing => None,
    };
    let resolved_theme = theme.map(normalize_project_theme_config);

    write_project_config(
        &project_dir,
        &runtime_url,
        &resolved_startup_commands,
        resolved_processes.as_ref(),
        resolved_agents.as_ref(),
        resolved_env.as_ref(),
        resolved_deploy_url.as_deref(),
        resolved_archived,
        resolved_theme,
    )?;

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
        let runtime_url = default_runtime_url_for_project_name(
            project_dir
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("app"),
        );
        // Create minimal config with default portless runtime + archived flag
        let config = serde_json::json!({
            "runtime": {
                "mode": "portless",
                "url": runtime_url
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
            } else if path.extension().is_some_and(|ext| ext == "pyc") {
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
        } else if path.extension().is_some_and(|ext| ext == "pyc") {
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

fn remove_project_bridge_port_file(project_name: &str) -> Result<(), String> {
    let path = project_bridge_port_file_path(project_name)?;
    match std::fs::remove_file(&path) {
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("failed to remove {}: {error}", path.display())),
    }
}

fn refresh_project_identity_files_after_rename(
    project_dir: &Path,
    old_name: &str,
    new_name: &str,
) -> Result<(), String> {
    match read_project_config(project_dir) {
        ProjectConfigLookup::Valid(config) => {
            let old_default = normalize_runtime_url(Some(
                default_runtime_url_for_project_name(old_name).as_str(),
            ))?
            .ok_or_else(|| "old default runtime url is required".to_string())?;
            let new_default = default_runtime_url_for_project_name(new_name);
            let current_runtime_url = config
                .runtime
                .url
                .clone()
                .unwrap_or_else(|| default_runtime_url_for_project_name(old_name));
            let runtime_url = if current_runtime_url == old_default {
                new_default
            } else {
                current_runtime_url
            };
            let processes = if config.processes.is_empty() {
                None
            } else {
                Some(config.processes)
            };
            let env = if config.env.is_empty() {
                None
            } else {
                Some(config.env)
            };
            write_project_config(
                project_dir,
                &runtime_url,
                &config.startup_commands,
                processes.as_ref(),
                config.agents.as_ref(),
                env.as_ref(),
                config.runtime.deploy_url.as_deref(),
                config.archived,
                None,
            )?;
        }
        ProjectConfigLookup::Missing => {
            let default_processes = default_processes_map(DEFAULT_AGENT_COMMAND);
            write_project_config(
                project_dir,
                &default_runtime_url_for_project_name(new_name),
                &default_startup_commands(),
                Some(&default_processes),
                None,
                None,
                None,
                false,
                None,
            )?;
        }
        ProjectConfigLookup::Invalid(error) => {
            log_backend(
                "WARN",
                format!(
                    "rename project '{old_name}' -> '{new_name}': skipped runtime config rewrite because {PROJECT_CONFIG_FILE_NAME} is invalid ({error})"
                ),
            );
        }
    }

    seed_agent_runtime_guidance_files(project_dir, SeedMode::Refresh)
}

#[tauri::command]
pub(crate) fn archive_project<R: Runtime>(
    project: String,
    terminal_state: State<'_, TerminalState>,
    app: AppHandle<R>,
) -> Result<u64, String> {
    log_backend(
        "INFO",
        format!("archive_project requested project={project}"),
    );
    let project_dir = resolve_project_dir(&project)?;

    let detached = detach_project_terminal_sessions(terminal_state.inner(), &project)?;
    for terminal_id in &detached.terminal_ids {
        emit_session_removed(&app, terminal_id);
    }
    kill_detached_terminal_sessions(detached.sessions);
    if let Err(error) = remove_project_bridge_port_file(&project) {
        log_backend(
            "WARN",
            format!(
                "archive_project project={project}: failed to remove bridge port file ({error})"
            ),
        );
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
pub(crate) fn unarchive_project(project: String) -> Result<(), String> {
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
pub(crate) fn delete_project<R: Runtime>(
    project: String,
    terminal_state: State<'_, TerminalState>,
    app: AppHandle<R>,
) -> Result<(), String> {
    log_backend(
        "INFO",
        format!("delete_project requested project={project}"),
    );
    let project_dir = resolve_project_dir(&project)?;

    let detached = detach_project_terminal_sessions(terminal_state.inner(), &project)?;
    for terminal_id in &detached.terminal_ids {
        emit_session_removed(&app, terminal_id);
    }
    kill_detached_terminal_sessions(detached.sessions);
    if let Err(error) = remove_project_bridge_port_file(&project) {
        log_backend(
            "WARN",
            format!(
                "delete_project project={project}: failed to remove bridge port file ({error})"
            ),
        );
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
pub(crate) fn rename_project<R: Runtime>(
    old_name: String,
    new_name: String,
    terminal_state: State<'_, TerminalState>,
    app: AppHandle<R>,
) -> Result<String, String> {
    let old_name = old_name.trim().to_string();
    let sanitized = sanitize_project_name(&new_name);
    if old_name.is_empty() || !is_safe_project_name(&old_name) {
        return Err("invalid existing project name".to_string());
    }
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

    std::fs::rename(&old_dir, &new_dir)
        .map_err(|error| format!("failed to rename project directory: {error}"))?;

    if let Err(error) = refresh_project_identity_files_after_rename(&new_dir, &old_name, &sanitized)
    {
        log_backend(
            "WARN",
            format!(
                "rename project '{old_name}' -> '{sanitized}': failed to refresh project identity files ({error})"
            ),
        );
    }

    match rekey_project_terminal_state(terminal_state.inner(), &old_name, &sanitized) {
        Ok(updated_infos) => {
            for info in &updated_infos {
                emit_session_changed(&app, info);
            }
        }
        Err(error) => {
            log_backend(
                "WARN",
                format!(
                    "rename project '{old_name}' -> '{sanitized}': failed to rekey terminal state ({error})"
                ),
            );
        }
    }

    if let Err(error) = remove_project_bridge_port_file(&old_name) {
        log_backend(
            "WARN",
            format!(
                "rename project '{old_name}' -> '{sanitized}': failed to remove old bridge port file ({error})"
            ),
        );
    }
    {
        let bridge_state: tauri::State<'_, BridgeState> = app.state();
        if let Err(error) = sync_project_bridge_port_file(&sanitized, bridge_state.inner()) {
            log_backend(
                "WARN",
                format!(
                    "rename project '{old_name}' -> '{sanitized}': failed to sync bridge port file ({error})"
                ),
            );
        }
    }

    log_backend(
        "INFO",
        format!("renamed project '{old_name}' -> '{sanitized}'"),
    );
    Ok(sanitized)
}
