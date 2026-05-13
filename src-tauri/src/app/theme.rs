use super::*;

const VALID_THEMES: &[&str] = &["fluid", "fluid-dark", "weekend-dark", "weekend-paper"];
const DEFAULT_THEME: &str = "fluid";
const THEME_CONFIG_FILE_NAME: &str = "theme.json";
const VALID_SHAPES: &[&str] = &["pill", "rounded"];
const DEFAULT_SHAPE: &str = "pill";
const DESIGN_SYSTEM_CONFIG_FILE_NAME: &str = "design-system.json";

/// Per-project theme policy. Persisted in `weekend.config.json` under the
/// optional `theme` block. When the block is absent, projects track the shell
/// theme by default.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectThemeConfig {
    #[serde(default = "default_track_shell")]
    pub(crate) track_shell: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) design_system: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) deploy: Option<String>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub(crate) css_variables: HashMap<String, String>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub(crate) theme_variables: HashMap<String, HashMap<String, String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesignSystemConfig {
    #[serde(default = "default_design_system_version")]
    pub(crate) version: u32,
    #[serde(default = "default_shape_choice")]
    pub(crate) shape: String,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub(crate) css_variables: HashMap<String, String>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub(crate) theme_variables: HashMap<String, HashMap<String, String>>,
}

fn default_track_shell() -> bool {
    true
}

fn default_design_system_version() -> u32 {
    1
}

fn default_shape_choice() -> String {
    DEFAULT_SHAPE.to_string()
}

impl Default for ProjectThemeConfig {
    fn default() -> Self {
        Self {
            track_shell: true,
            design_system: None,
            deploy: None,
            css_variables: HashMap::new(),
            theme_variables: HashMap::new(),
        }
    }
}

impl Default for DesignSystemConfig {
    fn default() -> Self {
        Self {
            version: default_design_system_version(),
            shape: default_shape_choice(),
            css_variables: HashMap::new(),
            theme_variables: HashMap::new(),
        }
    }
}

fn theme_config_path() -> Result<PathBuf, String> {
    Ok(weekend_root()?.join(THEME_CONFIG_FILE_NAME))
}

fn design_system_config_path() -> Result<PathBuf, String> {
    Ok(weekend_root()?.join(DESIGN_SYSTEM_CONFIG_FILE_NAME))
}

/// Best-effort read of just the `theme` block from a project config. Returns
/// `None` if the file is missing or unparseable; the caller treats that as
/// "use defaults" (track shell), not as an error.
pub(crate) fn read_project_theme_field(config_path: &Path) -> Option<ProjectThemeConfig> {
    let raw = std::fs::read_to_string(config_path).ok()?;
    let parsed: ProjectConfig = serde_json::from_str(&raw).ok()?;
    parsed.theme
}

pub(crate) fn normalize_design_system_choice(value: Option<&str>) -> String {
    match value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase())
        .as_deref()
    {
        Some("none") => "none".to_string(),
        _ => "weekend".to_string(),
    }
}

fn normalize_css_variable_name(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if !(3..=96).contains(&trimmed.len()) || !trimmed.starts_with("--") {
        return None;
    }
    if !trimmed[2..]
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
    {
        return None;
    }
    Some(trimmed.to_string())
}

fn normalize_css_variable_map(map: HashMap<String, String>) -> HashMap<String, String> {
    map.into_iter()
        .filter_map(|(name, value)| {
            let name = normalize_css_variable_name(&name)?;
            let value = value.trim();
            if value.is_empty() || value.len() > 500 {
                return None;
            }
            Some((name, value.to_string()))
        })
        .collect()
}

fn normalize_theme_variable_map(
    map: HashMap<String, HashMap<String, String>>,
) -> HashMap<String, HashMap<String, String>> {
    map.into_iter()
        .filter_map(|(theme, variables)| {
            let theme = theme.trim().to_ascii_lowercase();
            if !VALID_THEMES.contains(&theme.as_str()) {
                return None;
            }
            let variables = normalize_css_variable_map(variables);
            if variables.is_empty() {
                return None;
            }
            Some((theme, variables))
        })
        .collect()
}

pub(crate) fn normalize_project_theme_config(mut theme: ProjectThemeConfig) -> ProjectThemeConfig {
    theme.design_system = Some(normalize_design_system_choice(
        theme.design_system.as_deref(),
    ));
    theme.deploy = theme
        .deploy
        .as_deref()
        .map(|value| normalize_deploy_choice(Some(value)));
    theme.css_variables = normalize_css_variable_map(theme.css_variables);
    theme.theme_variables = normalize_theme_variable_map(theme.theme_variables);
    theme
}

fn normalize_shape_choice(value: Option<&str>) -> String {
    match value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase())
        .as_deref()
    {
        Some(shape) if VALID_SHAPES.contains(&shape) => shape.to_string(),
        _ => DEFAULT_SHAPE.to_string(),
    }
}

pub(crate) fn normalize_design_system_config(mut config: DesignSystemConfig) -> DesignSystemConfig {
    config.version = default_design_system_version();
    config.shape = normalize_shape_choice(Some(&config.shape));
    config.css_variables = normalize_css_variable_map(config.css_variables);
    config.theme_variables = normalize_theme_variable_map(config.theme_variables);
    config
}

fn read_design_system_config() -> DesignSystemConfig {
    let Ok(path) = design_system_config_path() else {
        return DesignSystemConfig::default();
    };
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return DesignSystemConfig::default();
    };
    let Ok(parsed) = serde_json::from_str::<DesignSystemConfig>(&raw) else {
        return DesignSystemConfig::default();
    };
    normalize_design_system_config(parsed)
}

fn write_design_system_config(config: DesignSystemConfig) -> Result<DesignSystemConfig, String> {
    let normalized = normalize_design_system_config(config);
    let root = weekend_root()?;
    std::fs::create_dir_all(&root)
        .map_err(|error| format!("failed to create ~/.weekend: {error}"))?;
    let path = design_system_config_path()?;
    let serialized = serde_json::to_string_pretty(&normalized)
        .map_err(|error| format!("failed to serialize design system config: {error}"))?;
    std::fs::write(&path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", path.display()))?;
    Ok(normalized)
}

fn project_design_system_choice(project_dir: &Path) -> String {
    let value = read_project_theme_field(&project_config_path(project_dir))
        .and_then(|theme| theme.design_system);
    normalize_design_system_choice(value.as_deref())
}

pub(crate) fn project_uses_weekend_design(project_dir: &Path) -> bool {
    project_design_system_choice(project_dir) != "none"
}

pub(crate) fn normalize_deploy_choice(value: Option<&str>) -> String {
    match value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase())
        .as_deref()
    {
        Some("cloudflare") => "cloudflare".to_string(),
        Some("vercel") => "vercel".to_string(),
        _ => "none".to_string(),
    }
}

pub(crate) fn project_deploy_choice(project_dir: &Path) -> String {
    let value =
        read_project_theme_field(&project_config_path(project_dir)).and_then(|theme| theme.deploy);
    normalize_deploy_choice(value.as_deref())
}

pub(crate) fn write_project_design_system_choice(
    project_dir: &Path,
    design_choice: &str,
) -> Result<(), String> {
    let config_path = project_config_path(project_dir);
    let raw = std::fs::read_to_string(&config_path)
        .map_err(|error| format!("failed to read {}: {error}", config_path.display()))?;
    let mut config: ProjectConfig = serde_json::from_str(&raw)
        .map_err(|error| format!("failed to parse {}: {error}", config_path.display()))?;
    let mut theme = config.theme.unwrap_or_default();
    theme.design_system = Some(normalize_design_system_choice(Some(design_choice)));
    config.theme = Some(theme);
    let serialized = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("failed to serialize {PROJECT_CONFIG_FILE_NAME}: {error}"))?;
    ensure_user_writable(&config_path)?;
    std::fs::write(&config_path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", config_path.display()))
}

pub(crate) fn write_project_deploy_choice(
    project_dir: &Path,
    deploy_choice: &str,
) -> Result<(), String> {
    let config_path = project_config_path(project_dir);
    let raw = std::fs::read_to_string(&config_path)
        .map_err(|error| format!("failed to read {}: {error}", config_path.display()))?;
    let mut config: ProjectConfig = serde_json::from_str(&raw)
        .map_err(|error| format!("failed to parse {}: {error}", config_path.display()))?;
    let mut theme = config.theme.unwrap_or_default();
    theme.deploy = Some(normalize_deploy_choice(Some(deploy_choice)));
    config.theme = Some(theme);
    let serialized = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("failed to serialize {PROJECT_CONFIG_FILE_NAME}: {error}"))?;
    ensure_user_writable(&config_path)?;
    std::fs::write(&config_path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", config_path.display()))
}

fn resolve_project_theme_policy(project_name: &str) -> ProjectThemeConfig {
    let Ok(project_dir) = resolve_project_dir(project_name) else {
        return ProjectThemeConfig::default();
    };
    read_project_theme_field(&project_config_path(&project_dir)).unwrap_or_default()
}

fn is_dark_theme(theme: &str) -> bool {
    matches!(theme, "fluid-dark" | "weekend-dark")
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ThemeBridgeState {
    theme: String,
    is_dark: bool,
    design_system: Option<ThemeBridgeDesignSystem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ThemeBridgeDesignSystem {
    shape: String,
    global_base: HashMap<String, String>,
    global_themes: HashMap<String, HashMap<String, String>>,
    project_base: HashMap<String, String>,
    project_themes: HashMap<String, HashMap<String, String>>,
}

fn theme_bridge_design_system_state(
    defaults: &DesignSystemConfig,
    policy: &ProjectThemeConfig,
) -> Option<ThemeBridgeDesignSystem> {
    let defaults = normalize_design_system_config(defaults.clone());
    let policy = normalize_project_theme_config(policy.clone());
    if normalize_design_system_choice(policy.design_system.as_deref()) == "none" {
        return None;
    }

    Some(ThemeBridgeDesignSystem {
        shape: defaults.shape,
        global_base: defaults.css_variables,
        global_themes: defaults.theme_variables,
        project_base: policy.css_variables,
        project_themes: policy.theme_variables,
    })
}

fn theme_bridge_state(
    theme: &str,
    defaults: &DesignSystemConfig,
    policy: &ProjectThemeConfig,
) -> ThemeBridgeState {
    ThemeBridgeState {
        theme: theme.to_string(),
        is_dark: is_dark_theme(theme),
        design_system: theme_bridge_design_system_state(defaults, policy),
    }
}

fn theme_bridge_apply_script(state: &ThemeBridgeState) -> String {
    crate::js::theme_bridge_apply(state)
}

pub(crate) fn project_theme_bridge_script(
    theme: &str,
    defaults: &DesignSystemConfig,
    policy: &ProjectThemeConfig,
) -> String {
    theme_bridge_apply_script(&theme_bridge_state(theme, defaults, policy))
}

/// JS preamble that the bridge prepends to every `bridge_inject.js` eval for
/// a project webview. Returns `None` when the project has opted out of shell
/// theme tracking (`trackShell: false`).
pub(crate) fn theme_injection_preamble(project_name: &str) -> Option<String> {
    let policy = resolve_project_theme_policy(project_name);
    if !policy.track_shell {
        return None;
    }
    let design_system = read_design_system_config();
    Some(project_theme_bridge_script(
        &read_active_theme(),
        &design_system,
        &policy,
    ))
}

fn read_active_theme() -> String {
    let Ok(path) = theme_config_path() else {
        return DEFAULT_THEME.to_string();
    };
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return DEFAULT_THEME.to_string();
    };
    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return DEFAULT_THEME.to_string();
    };
    let theme = parsed
        .get("theme")
        .and_then(|value| value.as_str())
        .unwrap_or(DEFAULT_THEME);
    if VALID_THEMES.contains(&theme) {
        theme.to_string()
    } else {
        DEFAULT_THEME.to_string()
    }
}

#[tauri::command]
pub(crate) fn get_active_theme() -> Result<String, String> {
    Ok(read_active_theme())
}

#[tauri::command]
pub(crate) fn get_design_system_config() -> Result<DesignSystemConfig, String> {
    Ok(read_design_system_config())
}

#[tauri::command]
pub(crate) fn set_design_system_config<R: Runtime>(
    app_handle: AppHandle<R>,
    config: DesignSystemConfig,
) -> Result<DesignSystemConfig, String> {
    let config = write_design_system_config(config)?;
    app_handle
        .emit("design-system-changed", &config)
        .map_err(|error| format!("emit failed: {error}"))?;

    let active_theme = read_active_theme();
    for label in webview_ops::list_browser_webviews(&app_handle) {
        let Some(project_name) = project_name_from_browser_webview_label(&label) else {
            continue;
        };
        let policy = resolve_project_theme_policy(project_name);
        if !policy.track_shell {
            continue;
        }
        if let Some(webview) = app_handle.get_webview(&label) {
            let _ = webview.eval(project_theme_bridge_script(&active_theme, &config, &policy));
        }
    }

    log_backend("INFO", "design system config updated".to_string());
    Ok(config)
}

#[tauri::command]
pub(crate) fn set_active_theme<R: Runtime>(
    app_handle: AppHandle<R>,
    theme: String,
) -> Result<(), String> {
    if !VALID_THEMES.contains(&theme.as_str()) {
        return Err(format!("invalid theme: {theme}"));
    }
    let root = weekend_root()?;
    std::fs::create_dir_all(&root)
        .map_err(|error| format!("failed to create ~/.weekend: {error}"))?;
    let path = theme_config_path()?;
    let payload = serde_json::json!({ "theme": &theme });
    let serialized = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("failed to serialize theme config: {error}"))?;
    std::fs::write(&path, serialized)
        .map_err(|error| format!("failed to write {}: {error}", path.display()))?;
    app_handle
        .emit("theme-changed", serde_json::json!({ "theme": &theme }))
        .map_err(|error| format!("emit failed: {error}"))?;

    let design_system = read_design_system_config();
    for label in webview_ops::list_browser_webviews(&app_handle) {
        let Some(project_name) = project_name_from_browser_webview_label(&label) else {
            continue;
        };
        let policy = resolve_project_theme_policy(project_name);
        if !policy.track_shell {
            continue;
        }
        if let Some(webview) = app_handle.get_webview(&label) {
            let _ = webview.eval(project_theme_bridge_script(&theme, &design_system, &policy));
        }
    }

    log_backend("INFO", format!("active theme set to {theme}"));
    Ok(())
}
