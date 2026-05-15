use super::*;

const PROJECT_AGENT_RUNTIME_GUIDANCE_BASE: &str = r#"# Runtime Configuration

Read `./weekend.config.json` before launching any runtime command.
Resolve the runtime endpoint from that file:
- Always use `runtime.url` from `runtime.mode: "portless"`.
- Treat `runtime.deployUrl` as the optional public deployment URL when present.
Weekend may provide a bundled `portless` runtime during Play for `dev-server` processes.
Do not assume every process is automatically wrapped.
Use backend commands (or browser controls) to update `weekend.config.json`.

# Shared Assets

Shared assets are available at `./shared-assets/`.
Before using any shared asset, ask the user which files from
`./shared-assets/` should be used for this project.
Do not assume every shared asset should be applied automatically.

# Browser Interaction (Weekend MCP)

You have access to a live browser pane via the `weekend` MCP server.
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

const PROJECT_AGENT_RUNTIME_DESIGN_GUIDANCE: &str = r#"
# Design System

The Weekend design system is available at `./shared-assets/weekend-design/`.
It is a self-contained npm-installable bundle: tokens, base styles, fonts,
and React components. For newly built UI, adopt it by default instead of
hand-rolling visual primitives, local token systems, or unrelated component
libraries. Only skip it when the user explicitly asks for no design system or
the project cannot reasonably use it.

## Static HTML

```html
<link rel="stylesheet" href="./shared-assets/weekend-design/tokens.css">
<link rel="stylesheet" href="./shared-assets/weekend-design/index.css">
<button class="btn btn-primary">Click</button>
```

## React / Vite

Add the local dependency with the project's package manager:

```json
"@weekend/design": "file:./shared-assets/weekend-design"
```

Then import the global CSS once, preferably from the app's main CSS file:

```css
@import "@weekend/design/tokens.css";
@import "@weekend/design/tailwind-theme.css";
@import "@weekend/design/index.css";
```

Use components from the package instead of recreating them:

```ts
import { Button } from "@weekend/design";
```

## Themes

The design system supports four themes selected via the `data-theme`
attribute on `<html>`: `fluid` (default), `fluid-dark`, `weekend-dark`,
and `weekend-paper`.

When the project is opened inside Weekend and `theme.trackShell` is not false,
the host injects the active theme and design defaults into the project webview.
Observe them instead of inventing a separate theme store:
- CSS reads `<html data-theme="...">`, `.dark` / `.light`, and optional
  `<html data-shape="pill|rounded">`.
- JS can read `window.__WEEKEND_SHELL_THEME__` and
  `window.__WEEKEND_SHELL_DESIGN_SYSTEM__`.
- React code from `@weekend/design` can use `ShellThemeBridge`,
  `useShellTheme`, and `ShapeProvider`.
- Theme updates dispatch `weekend:theme`; design/shape updates dispatch
  `weekend:design-system` and `weekend:design-system-overrides`.
"#;

const PROJECT_AGENT_RUNTIME_NO_DESIGN_GUIDANCE: &str = r#"
# Design System

This project was created with `designSystem=none`. Do not add
`@weekend/design` unless the user explicitly asks to adopt it.
"#;

const PROJECT_AGENT_RUNTIME_DEPLOY_CLOUDFLARE_GUIDANCE: &str = r#"
# Deploy

This project was created with `deploy=cloudflare`. When the user is ready
to deploy:
- Prefer `wrangler` for both Cloudflare Pages and Workers.
- Static React/Vite output typically deploys via `wrangler pages deploy ./dist`
  or a `wrangler.toml` with `pages_build_output_dir = "dist"`.
- Avoid platform-specific assumptions from other hosts (Vercel functions,
  Next.js Image, etc.) unless the user explicitly asks for them.
"#;

const PROJECT_AGENT_RUNTIME_DEPLOY_VERCEL_GUIDANCE: &str = r#"
# Deploy

This project was created with `deploy=vercel`. When the user is ready to
deploy:
- Many React/Vite/Next.js projects deploy with zero config; add a
  `vercel.json` only when the framework needs explicit hints.
- Prefer Vercel's Edge or Serverless Functions over hand-rolled adapters
  when adding server-side code.
- Avoid platform-specific assumptions from other hosts (Cloudflare KV,
  Wrangler, etc.) unless the user explicitly asks for them.
"#;

/// Slim pointer written to `CLAUDE.md` in new Weekend projects. The full
/// runtime/browser/design guidance now ships as a Claude Code skill (synced
/// from `~/.weekend/shared-assets/weekend-suite-skill/` and symlinked into
/// `.claude/skills/weekend-suite/`), so Claude Code does not need to load
/// the entire body of guidance into every conversation. `AGENTS.md` keeps
/// the full inline content because Codex has no skill system.
const PROJECT_CLAUDE_POINTER: &str = r#"# Weekend Project

You are working inside a Weekend project. Conventions for this environment
(runtime config, design system, Weekend MCP browser tools, shared assets) are loaded as a
Claude Code skill at `.claude/skills/weekend-suite/`.

If that skill isn't present, look for the same content at
`./shared-assets/weekend-suite-skill/` or ask the user to run Weekend's sync.

Project-specific notes can be added to this file below.
"#;

const WEEKEND_DESIGN_AUTOSTART_GUIDANCE: &str = r#"Weekend project context:
- Before implementation, read `.weekend/agent-runtime.md` for runtime, Weekend MCP browser tools, shared assets, and design system guidance.
- This project was created with `designSystem=weekend`; treat `@weekend/design` as the default UI foundation.
- Use `./shared-assets/weekend-design/` instead of hand-rolling visual primitives, local token systems, or unrelated component libraries.
- For React/Vite, add `"@weekend/design": "file:./shared-assets/weekend-design"` to dependencies, import `@weekend/design/tokens.css`, `@weekend/design/tailwind-theme.css`, and `@weekend/design/index.css` once, then import components such as `Button` from `@weekend/design`.
- If the user's request explicitly says not to use Weekend design or not to use any design system, follow the user's request.
- If `./shared-assets/weekend-design/` is missing or incompatible, report that blocker instead of silently building a separate design system.
"#;

fn deploy_runtime_guidance(deploy_choice: &str) -> &'static str {
    match deploy_choice {
        "cloudflare" => PROJECT_AGENT_RUNTIME_DEPLOY_CLOUDFLARE_GUIDANCE,
        "vercel" => PROJECT_AGENT_RUNTIME_DEPLOY_VERCEL_GUIDANCE,
        _ => "",
    }
}

fn project_agent_runtime_guidance(project_dir: &Path) -> String {
    let design_guidance = if project_uses_weekend_design(project_dir) {
        PROJECT_AGENT_RUNTIME_DESIGN_GUIDANCE
    } else {
        PROJECT_AGENT_RUNTIME_NO_DESIGN_GUIDANCE
    };
    let deploy_guidance = deploy_runtime_guidance(&project_deploy_choice(project_dir));
    format!(
        "{}{}{}",
        PROJECT_AGENT_RUNTIME_GUIDANCE_BASE.trim_end(),
        design_guidance,
        deploy_guidance
    )
}

/// Whether `seed_agent_runtime_guidance_files` is running for a freshly created
/// project (`Create`) or refreshing an existing one (`Refresh` — app startup
/// backfill, project rename, etc.).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SeedMode {
    /// First-time creation. If CLAUDE.md / AGENTS.md don't exist yet (greenfield),
    /// write the full guidance directly with no sentinels. If they do exist
    /// (cloned repo with its own files), append a Weekend-managed block.
    Create,
    /// Subsequent run. Only refresh CLAUDE.md / AGENTS.md if they already
    /// contain a managed block. Never inject the block into user-owned files
    /// that haven't opted in by having the sentinels written previously.
    Refresh,
}

fn file_has_managed_block(path: &Path) -> bool {
    match std::fs::read_to_string(path) {
        Ok(contents) => {
            contents.contains(WEEKEND_BLOCK_BEGIN) && contents.contains(WEEKEND_BLOCK_END)
        }
        Err(_) => false,
    }
}

/// Ensure that `path` contains a Weekend-managed block whose body matches `body`.
/// The caller is responsible for the "should this file be touched at all?"
/// policy (see `seed_agent_runtime_guidance_files`); this function just
/// performs the mutation.
///
/// Behavior to implement:
/// - If the file does not exist: create it containing just the managed block.
/// - If the file exists with `WEEKEND_BLOCK_BEGIN` … `WEEKEND_BLOCK_END`:
///   replace the content between those markers with `body`. Content outside
///   the markers is preserved exactly (whitespace, trailing newlines).
/// - If the file exists without markers: append the managed block at the end,
///   with a leading newline if the existing content doesn't end with one.
/// - The block on disk should look like:
///       <existing content>
///       <BEGIN sentinel>
///       <body>
///       <END sentinel>
///   Sentinels on their own lines; body separated by blank lines is fine.
///
/// Policy questions for the implementer:
/// - Malformed input — file contains BEGIN with no matching END (or vice
///   versa). Recommendation: treat as "no managed block present" and append a
///   fresh one. Don't try to recover the partial structure; just log if
///   helpful. Stomping the user's content between an orphaned BEGIN and EOF
///   risks data loss.
/// - Multiple BEGIN/END pairs. Recommendation: refresh the first pair and
///   leave subsequent ones untouched.
fn managed_block(body: &str) -> String {
    format!(
        "{WEEKEND_BLOCK_BEGIN}\n\n{}\n{WEEKEND_BLOCK_END}\n",
        body.trim_end()
    )
}

fn upsert_managed_block(path: &Path, body: &str) -> Result<(), String> {
    let block = managed_block(body);
    let contents = match std::fs::read_to_string(path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            std::fs::write(path, block).map_err(|write_error| {
                format!("failed to write {}: {write_error}", path.display())
            })?;
            return Ok(());
        }
        Err(error) => return Err(format!("failed to read {}: {error}", path.display())),
    };

    let next = if let Some(begin_start) = contents.find(WEEKEND_BLOCK_BEGIN) {
        let search_start = begin_start + WEEKEND_BLOCK_BEGIN.len();
        if let Some(relative_end_start) = contents[search_start..].find(WEEKEND_BLOCK_END) {
            let end_start = search_start + relative_end_start;
            let end_marker_end = end_start + WEEKEND_BLOCK_END.len();
            let replace_end = if contents[end_marker_end..].starts_with("\r\n") {
                end_marker_end + 2
            } else if contents[end_marker_end..].starts_with('\n') {
                end_marker_end + 1
            } else {
                end_marker_end
            };
            format!(
                "{}{}{}",
                &contents[..begin_start],
                block,
                &contents[replace_end..]
            )
        } else {
            append_managed_block(contents, &block)
        }
    } else {
        append_managed_block(contents, &block)
    };

    ensure_user_writable(path)?;
    std::fs::write(path, next)
        .map_err(|error| format!("failed to write {}: {error}", path.display()))
}

fn append_managed_block(mut contents: String, block: &str) -> String {
    if !contents.is_empty() {
        if !contents.ends_with('\n') {
            contents.push('\n');
        }
        if !contents.ends_with("\n\n") {
            contents.push('\n');
        }
    }
    contents.push_str(block);
    contents
}

/// Absolute path to the source of the weekend-suite Claude Code skill inside
/// the shared-assets root. The actual content is synced into this location by
/// a separate script; `seed_weekend_suite_skill_symlink` does not require the
/// path to exist at symlink-creation time (the link resolves once sync runs).
fn weekend_suite_skill_source() -> Result<PathBuf, String> {
    Ok(shared_assets_root()?.join(WEEKEND_SUITE_SKILL_DIR_NAME))
}

/// Ensure `<project_dir>/.claude/skills/weekend-suite` is a symlink pointing
/// at `~/.weekend/shared-assets/weekend-suite-skill`. Idempotent: if anything
/// (file, directory, or symlink) already exists at the destination it is left
/// alone so user customization is preserved. Errors are logged and swallowed
/// so a missing skill never blocks project creation — the slim `CLAUDE.md`
/// pointer already describes the fallback.
fn seed_weekend_suite_skill_symlink(project_dir: &Path) {
    let source = match weekend_suite_skill_source() {
        Ok(path) => path,
        Err(error) => {
            log_backend(
                "WARN",
                format!(
                    "skipping weekend-suite skill symlink for {}: {error}",
                    project_dir.display()
                ),
            );
            return;
        }
    };

    let skills_dir = project_dir.join(PROJECT_CLAUDE_SKILLS_DIR_REL);
    if let Err(error) = std::fs::create_dir_all(&skills_dir) {
        log_backend(
            "WARN",
            format!("failed to create {}: {error}", skills_dir.display()),
        );
        return;
    }

    let dest = skills_dir.join(PROJECT_WEEKEND_SUITE_SKILL_NAME);
    // `symlink_metadata` does NOT follow symlinks, so we treat a dangling
    // symlink (source not yet synced) as "already present" and leave it
    // alone. This keeps the operation idempotent across repeat seedings.
    if std::fs::symlink_metadata(&dest).is_ok() {
        return;
    }

    if !source.exists() {
        log_backend(
            "WARN",
            format!(
                "weekend-suite skill source {} is missing; creating symlink anyway — it will resolve once sync runs",
                source.display()
            ),
        );
    }

    #[cfg(unix)]
    {
        if let Err(error) = std::os::unix::fs::symlink(&source, &dest) {
            log_backend(
                "WARN",
                format!(
                    "failed to symlink weekend-suite skill at {}: {error}",
                    dest.display()
                ),
            );
        }
    }

    #[cfg(not(unix))]
    {
        log_backend(
            "WARN",
            format!(
                "skipping weekend-suite skill symlink at {}: unix symlinks not supported on this platform",
                dest.display()
            ),
        );
    }
}

pub(crate) fn seed_agent_runtime_guidance_files(
    project_dir: &Path,
    mode: SeedMode,
) -> Result<(), String> {
    let weekend_dir = project_dir.join(PROJECT_WEEKEND_DIR_NAME);
    if weekend_dir.exists() && !weekend_dir.is_dir() {
        return Err(format!("{} must be a directory", weekend_dir.display()));
    }
    std::fs::create_dir_all(&weekend_dir)
        .map_err(|error| format!("failed to create {}: {error}", weekend_dir.display()))?;

    // .weekend/agent-runtime.md is fully host-owned: always overwritten so
    // existing projects pick up evolving guidance on every app launch.
    let runtime_guidance = project_agent_runtime_guidance(project_dir);
    let runtime_guidance_path = weekend_dir.join(PROJECT_AGENT_RUNTIME_GUIDANCE_FILE_NAME);
    std::fs::write(&runtime_guidance_path, &runtime_guidance).map_err(|error| {
        format!(
            "failed to write {}: {error}",
            runtime_guidance_path.display()
        )
    })?;

    // CLAUDE.md is now a thin pointer to the `weekend-suite` Claude Code
    // skill — Claude Code loads the full guidance from the skill on demand
    // rather than absorbing it into every conversation context. AGENTS.md
    // continues to carry the full inline guidance because Codex has no
    // skill system.
    for (file_name, body) in [
        (PROJECT_CLAUDE_FILE_NAME, PROJECT_CLAUDE_POINTER),
        (PROJECT_AGENTS_FILE_NAME, runtime_guidance.as_str()),
    ] {
        let path = project_dir.join(file_name);
        match mode {
            SeedMode::Create => {
                if path.exists() {
                    // Cloned repo / user-supplied file: append the managed block
                    // so guidance is discoverable without stomping existing content.
                    upsert_managed_block(&path, body)?;
                } else {
                    // Greenfield: paste the full body verbatim. No sentinels —
                    // the file becomes user-owned from this point and won't be
                    // refreshed by future Refresh runs.
                    std::fs::write(&path, body)
                        .map_err(|error| format!("failed to write {}: {error}", path.display()))?;
                }
            }
            SeedMode::Refresh => {
                // Only refresh files that have explicitly opted in by carrying
                // a managed block. Greenfield CLAUDE.md (full content, no
                // sentinels) and pure user-owned files are left alone.
                if file_has_managed_block(&path) {
                    upsert_managed_block(&path, body)?;
                }
            }
        }
    }

    seed_mcp_json(project_dir)?;
    seed_codex_config(project_dir)?;

    // The skill content itself is materialized by a separate sync step into
    // ~/.weekend/shared-assets/weekend-suite-skill/. We just maintain the
    // per-project symlink that exposes it at .claude/skills/weekend-suite/.
    // Errors here never fail seeding — CLAUDE.md's pointer already describes
    // a fallback path.
    seed_weekend_suite_skill_symlink(project_dir);
    ensure_weekend_skill_in_gitignore(project_dir);

    Ok(())
}

/// Append `.claude/skills/weekend-suite` to the project's `.gitignore` if it
/// isn't already listed. Covers the GitHub-clone path, which inherits the
/// upstream `.gitignore` and so doesn't go through `init_git_repo`. No-op
/// when `.gitignore` is absent (the project may not be a git repo at all).
fn ensure_weekend_skill_in_gitignore(project_dir: &Path) {
    let gitignore_path = project_dir.join(PROJECT_GITIGNORE_FILE_NAME);
    let existing = match std::fs::read_to_string(&gitignore_path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
        Err(error) => {
            log_backend(
                "WARN",
                format!(
                    "failed to read {} for skill-ignore check: {error}",
                    gitignore_path.display()
                ),
            );
            return;
        }
    };

    let needle = ".claude/skills/weekend-suite";
    if existing.lines().any(|line| line.trim() == needle) {
        return;
    }

    let mut updated = existing;
    if !updated.is_empty() && !updated.ends_with('\n') {
        updated.push('\n');
    }
    if !updated.is_empty() {
        updated.push('\n');
    }
    updated.push_str("# weekend\n");
    updated.push_str(needle);
    updated.push('\n');

    if let Err(error) = std::fs::write(&gitignore_path, updated) {
        log_backend(
            "WARN",
            format!(
                "failed to append weekend-suite skill ignore to {}: {error}",
                gitignore_path.display()
            ),
        );
    }
}

fn shell_single_quote(input: &str) -> String {
    let mut out = String::with_capacity(input.len() + 2);
    out.push('\'');
    for ch in input.chars() {
        if ch == '\'' {
            out.push_str("'\\''");
        } else {
            out.push(ch);
        }
    }
    out.push('\'');
    out
}

pub(crate) fn write_agent_metadata_file(
    project_dir: &Path,
    terminal_id: &str,
    project: &str,
    agent_profile_id: Option<&str>,
    agent_instance_id: &str,
    agent_provider: Option<&str>,
    agent_session_id: Option<&str>,
    agent_command: Option<&str>,
) -> Result<PathBuf, String> {
    let metadata_dir = project_dir.join(PROJECT_WEEKEND_DIR_NAME).join("agents");
    std::fs::create_dir_all(&metadata_dir)
        .map_err(|error| format!("failed to create {}: {error}", metadata_dir.display()))?;

    let path = metadata_dir.join(format!("{agent_instance_id}.json"));
    let payload = serde_json::json!({
        "terminalId": terminal_id,
        "project": project,
        "profileId": agent_profile_id,
        "instanceId": agent_instance_id,
        "provider": agent_provider,
        "sessionId": agent_session_id,
        "command": agent_command,
        "status": "starting",
        "startedAt": now_unix_ms(),
    });
    let serialized = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("failed to serialize agent metadata: {error}"))?;
    std::fs::write(&path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", path.display()))?;
    Ok(path)
}

fn build_agent_autostart_prompt(project_dir: &Path, user_prompt: &str) -> String {
    if !project_uses_weekend_design(project_dir) {
        return user_prompt.to_string();
    }

    format!(
        "{}\nUser request:\n{}",
        WEEKEND_DESIGN_AUTOSTART_GUIDANCE.trim_end(),
        user_prompt.trim()
    )
}

pub(crate) fn maybe_run_agent_autostart(project_dir: &Path, session: Arc<TerminalSession>) {
    let marker_path = project_dir
        .join(PROJECT_WEEKEND_DIR_NAME)
        .join(AGENT_STARTUP_MARKER_FILE_NAME);
    if !marker_path.is_file() {
        return;
    }

    let prompt_path = project_dir.join(AGENT_STARTUP_PROMPT_FILE_NAME);
    let prompt = match std::fs::read_to_string(&prompt_path) {
        Ok(value) => value.trim().to_string(),
        Err(error) => {
            log_backend(
                "WARN",
                format!(
                    "agent autostart: failed to read {}: {error}",
                    prompt_path.display()
                ),
            );
            let _ = std::fs::remove_file(&marker_path);
            return;
        }
    };
    if prompt.is_empty() {
        let _ = std::fs::remove_file(&marker_path);
        return;
    }

    let agent_command = match read_project_config(project_dir) {
        ProjectConfigLookup::Valid(config) => config
            .processes
            .get("agent")
            .map(|entry| entry.command.clone())
            .unwrap_or_else(|| DEFAULT_AGENT_COMMAND.to_string()),
        _ => DEFAULT_AGENT_COMMAND.to_string(),
    };

    let _ = std::fs::remove_file(&marker_path);

    let prompt = build_agent_autostart_prompt(project_dir, &prompt);
    let line = format!("{} {}\r", agent_command, shell_single_quote(&prompt));
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(500));
        if let Ok(mut writer) = session.writer.lock() {
            if let Err(error) = writer.write_all(line.as_bytes()) {
                log_backend("WARN", format!("agent autostart: write failed: {error}"));
                return;
            }
            if let Err(error) = writer.flush() {
                log_backend("WARN", format!("agent autostart: flush failed: {error}"));
            }
        }
    });
}

fn project_name_for_dir(project_dir: &Path) -> Result<String, String> {
    project_dir
        .file_name()
        .and_then(|value| value.to_str())
        .map(ToOwned::to_owned)
        .ok_or_else(|| {
            format!(
                "failed to resolve project name for {}",
                project_dir.display()
            )
        })
}

fn seed_mcp_json(project_dir: &Path) -> Result<(), String> {
    let mcp_path = project_dir.join(".mcp.json");
    let project_name = project_name_for_dir(project_dir)?;
    let binary_path = resolve_mcp_binary_path();
    let weekend_mcp_config = serde_json::json!({
        "command": binary_path,
        "args": [],
        "env": {
            "WEEKEND_PROJECT": project_name
        }
    });

    let mut content = if mcp_path.exists() {
        serde_json::from_str::<serde_json::Value>(
            &std::fs::read_to_string(&mcp_path)
                .map_err(|error| format!("failed to read {}: {error}", mcp_path.display()))?,
        )
        .map_err(|error| format!("failed to parse {}: {error}", mcp_path.display()))?
    } else {
        serde_json::json!({})
    };

    let root = content
        .as_object_mut()
        .ok_or_else(|| format!("{} must contain a JSON object", mcp_path.display()))?;
    let mcp_servers = root
        .entry("mcpServers".to_string())
        .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()))
        .as_object_mut()
        .ok_or_else(|| format!("{}.mcpServers must be a JSON object", mcp_path.display()))?;
    mcp_servers.insert(WEEKEND_MCP_SERVER_NAME.to_string(), weekend_mcp_config);

    let serialized = serde_json::to_string_pretty(&content)
        .map_err(|error| format!("failed to serialize .mcp.json: {error}"))?;
    std::fs::write(&mcp_path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", mcp_path.display()))?;
    Ok(())
}

fn seed_codex_config(project_dir: &Path) -> Result<(), String> {
    let project_name = project_name_for_dir(project_dir)?;
    let codex_dir = project_dir.join(PROJECT_CODEX_DIR_NAME);
    if codex_dir.exists() && !codex_dir.is_dir() {
        return Err(format!("{} must be a directory", codex_dir.display()));
    }
    std::fs::create_dir_all(&codex_dir)
        .map_err(|error| format!("failed to create {}: {error}", codex_dir.display()))?;

    let config_path = codex_dir.join(PROJECT_CODEX_CONFIG_FILE_NAME);
    let binary_path = resolve_mcp_binary_path();
    let mut weekend_mcp_env = toml::map::Map::new();
    weekend_mcp_env.insert(
        "WEEKEND_PROJECT".to_string(),
        toml::Value::String(project_name),
    );

    let mut weekend_mcp_config = toml::map::Map::new();
    weekend_mcp_config.insert("command".to_string(), toml::Value::String(binary_path));
    weekend_mcp_config.insert("args".to_string(), toml::Value::Array(Vec::new()));
    weekend_mcp_config.insert("env".to_string(), toml::Value::Table(weekend_mcp_env));

    let mut content = if config_path.exists() {
        std::fs::read_to_string(&config_path)
            .map_err(|error| format!("failed to read {}: {error}", config_path.display()))?
            .parse::<toml::Value>()
            .map_err(|error| format!("failed to parse {}: {error}", config_path.display()))?
    } else {
        toml::Value::Table(toml::map::Map::new())
    };

    let root = content
        .as_table_mut()
        .ok_or_else(|| format!("{} must contain a TOML table", config_path.display()))?;
    let mcp_servers = root
        .entry("mcp_servers".to_string())
        .or_insert_with(|| toml::Value::Table(toml::map::Map::new()))
        .as_table_mut()
        .ok_or_else(|| format!("{}.mcp_servers must be a TOML table", config_path.display()))?;
    mcp_servers.insert(
        WEEKEND_MCP_SERVER_NAME.to_string(),
        toml::Value::Table(weekend_mcp_config),
    );

    let serialized = toml::to_string_pretty(&content)
        .map_err(|error| format!("failed to serialize .codex/config.toml: {error}"))?;
    std::fs::write(&config_path, format!("{serialized}\n"))
        .map_err(|error| format!("failed to write {}: {error}", config_path.display()))?;
    Ok(())
}

pub(crate) fn init_git_repo(project_dir: &Path) -> Result<(), String> {
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

# weekend
.claude/skills/weekend-suite
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
    const BINARY_NAME: &str = "weekend-mcp";

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

            // Tauri sidecar convention: binary-<target-triple> (e.g., weekend-mcp-aarch64-apple-darwin)
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

pub(crate) fn resolve_bundled_portless_cli_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    let mut candidates = Vec::<PathBuf>::new();

    // Explicit override for local debugging.
    if let Ok(explicit) = std::env::var("WEEKEND_PORTLESS_CLI") {
        let trimmed = explicit.trim();
        if !trimmed.is_empty() {
            candidates.push(PathBuf::from(trimmed));
        }
    }

    // Dev-mode candidates (repo checkout).
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("src-tauri/resources/portless/dist/cli.js"));
        candidates.push(cwd.join("resources/portless/dist/cli.js"));
        candidates.push(cwd.join("../src-tauri/resources/portless/dist/cli.js"));
    }

    // Bundle resources at runtime.
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("portless/dist/cli.js"));
        candidates.push(resource_dir.join("resources/portless/dist/cli.js"));
    }

    // Executable-adjacent fallbacks.
    if let Ok(exe) = std::env::current_exe() {
        let exe = exe.canonicalize().unwrap_or(exe);
        if let Some(exe_dir) = exe.parent() {
            candidates.push(exe_dir.join("portless/dist/cli.js"));
            // macOS bundle layout fallback.
            candidates.push(exe_dir.join("../Resources/portless/dist/cli.js"));
            candidates.push(exe_dir.join("../../Resources/portless/dist/cli.js"));
        }
    }

    candidates.into_iter().find(|candidate| candidate.is_file())
}

#[cfg(test)]
mod mcp_config_tests {
    use super::{
        build_agent_autostart_prompt, project_name_from_browser_webview_label,
        seed_agent_runtime_guidance_files, seed_codex_config, seed_mcp_json, SeedMode,
        PROJECT_AGENT_RUNTIME_GUIDANCE_FILE_NAME, PROJECT_CONFIG_FILE_NAME,
        PROJECT_WEEKEND_DIR_NAME, WEEKEND_BLOCK_BEGIN, WEEKEND_BLOCK_END, WEEKEND_MCP_SERVER_NAME,
    };
    use serde_json::Value;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};
    use toml::Value as TomlValue;

    fn make_temp_project_dir(prefix: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("{prefix}-{unique}"));
        std::fs::create_dir_all(&dir).expect("create project dir");
        dir
    }

    #[test]
    fn seed_mcp_json_preserves_other_servers_and_sets_weekend_project_env() {
        let root = make_temp_project_dir("weekend-mcp-config");
        let project_dir = root.join("rl-lab");
        std::fs::create_dir_all(&project_dir).expect("project dir");
        std::fs::write(
            project_dir.join(".mcp.json"),
            r#"{
  "mcpServers": {
    "other-server": {
      "command": "node",
      "args": ["other.js"]
    }
  }
}
"#,
        )
        .expect("write mcp json");

        seed_mcp_json(&project_dir).expect("seed mcp json");
        let parsed: Value = serde_json::from_str(
            &std::fs::read_to_string(project_dir.join(".mcp.json")).expect("read mcp json"),
        )
        .expect("parse mcp json");
        let _ = std::fs::remove_dir_all(&root);

        assert_eq!(
            parsed["mcpServers"]["other-server"]["command"].as_str(),
            Some("node")
        );
        assert_eq!(
            parsed["mcpServers"][WEEKEND_MCP_SERVER_NAME]["env"]["WEEKEND_PROJECT"].as_str(),
            Some("rl-lab")
        );
    }

    #[test]
    fn seed_codex_config_preserves_other_servers_and_sets_weekend_project_env() {
        let root = make_temp_project_dir("weekend-codex-config");
        let project_dir = root.join("rl-lab");
        let codex_dir = project_dir.join(".codex");
        std::fs::create_dir_all(&codex_dir).expect("codex dir");
        std::fs::write(
            codex_dir.join("config.toml"),
            r#"[mcp_servers.other-server]
command = "node"
args = ["other.js"]
"#,
        )
        .expect("write codex config");

        seed_codex_config(&project_dir).expect("seed codex config");
        let parsed: TomlValue = std::fs::read_to_string(codex_dir.join("config.toml"))
            .expect("read codex config")
            .parse()
            .expect("parse codex config");
        let _ = std::fs::remove_dir_all(&root);

        assert_eq!(
            parsed["mcp_servers"]["other-server"]["command"].as_str(),
            Some("node")
        );
        assert_eq!(
            parsed["mcp_servers"][WEEKEND_MCP_SERVER_NAME]["env"]["WEEKEND_PROJECT"].as_str(),
            Some("rl-lab")
        );
    }

    #[test]
    fn refresh_mode_leaves_user_owned_agent_files_untouched() {
        // Refresh on a project whose CLAUDE.md / AGENTS.md were never written by
        // Weekend (no sentinels) must not mutate them. The host-owned
        // .weekend/agent-runtime.md and .mcp.json still get refreshed.
        let root = make_temp_project_dir("weekend-guidance-refresh");
        let project_dir = root.join("rl-lab");
        std::fs::create_dir_all(&project_dir).expect("project dir");
        std::fs::write(project_dir.join("CLAUDE.md"), "# User Claude\n").expect("write claude");
        std::fs::write(project_dir.join("AGENTS.md"), "# User Agents\n").expect("write agents");

        seed_agent_runtime_guidance_files(&project_dir, SeedMode::Refresh).expect("seed guidance");
        let claude = std::fs::read_to_string(project_dir.join("CLAUDE.md")).expect("read claude");
        let agents = std::fs::read_to_string(project_dir.join("AGENTS.md")).expect("read agents");
        let guidance = std::fs::read_to_string(
            project_dir
                .join(PROJECT_WEEKEND_DIR_NAME)
                .join(PROJECT_AGENT_RUNTIME_GUIDANCE_FILE_NAME),
        )
        .expect("read host guidance");
        let mcp: Value = serde_json::from_str(
            &std::fs::read_to_string(project_dir.join(".mcp.json")).expect("read mcp json"),
        )
        .expect("parse mcp json");
        let _ = std::fs::remove_dir_all(&root);

        assert_eq!(claude, "# User Claude\n");
        assert_eq!(agents, "# User Agents\n");
        assert!(guidance.contains("# Runtime Configuration"));
        assert_eq!(
            mcp["mcpServers"][WEEKEND_MCP_SERVER_NAME]["env"]["WEEKEND_PROJECT"].as_str(),
            Some("rl-lab")
        );
    }

    #[test]
    fn create_mode_writes_full_guidance_into_greenfield_agent_files() {
        // Greenfield: CLAUDE.md / AGENTS.md don't exist. Create mode writes
        // a slim pointer to CLAUDE.md (the full guidance lives in the
        // weekend-suite Claude Code skill) and the full runtime guidance
        // verbatim to AGENTS.md (Codex has no skill system).
        let root = make_temp_project_dir("weekend-guidance-create-greenfield");
        let project_dir = root.join("rl-lab");
        std::fs::create_dir_all(&project_dir).expect("project dir");

        seed_agent_runtime_guidance_files(&project_dir, SeedMode::Create).expect("seed guidance");
        let claude = std::fs::read_to_string(project_dir.join("CLAUDE.md")).expect("read claude");
        let agents = std::fs::read_to_string(project_dir.join("AGENTS.md")).expect("read agents");
        let _ = std::fs::remove_dir_all(&root);

        // CLAUDE.md is now a pointer, NOT the full guidance.
        assert!(claude.contains(".claude/skills/weekend-suite"));
        assert!(claude.contains("shared-assets/weekend-suite-skill"));
        assert!(!claude.contains("# Browser Interaction"));
        assert!(!claude.contains("@weekend/design"));
        assert!(!claude.contains("BEGIN weekend-managed"));
        // AGENTS.md still gets the full inline guidance.
        assert!(agents.contains("# Design System"));
        assert!(!agents.contains("BEGIN weekend-managed"));
    }

    #[test]
    fn create_mode_respects_design_system_opt_out_in_guidance() {
        // CLAUDE.md is now a thin pointer regardless of design choice — the
        // design-system opt-out only affects AGENTS.md and the host-owned
        // runtime guidance file.
        let root = make_temp_project_dir("weekend-guidance-no-design");
        let project_dir = root.join("rl-lab");
        std::fs::create_dir_all(&project_dir).expect("project dir");
        std::fs::write(
            project_dir.join(PROJECT_CONFIG_FILE_NAME),
            r#"{
  "runtime": { "mode": "portless", "url": "http://rl-lab.localhost" },
  "startup": { "commands": [] },
  "theme": { "trackShell": true, "designSystem": "none" }
}
"#,
        )
        .expect("write config");

        seed_agent_runtime_guidance_files(&project_dir, SeedMode::Create).expect("seed guidance");
        let agents = std::fs::read_to_string(project_dir.join("AGENTS.md")).expect("read agents");
        let runtime_guidance = std::fs::read_to_string(
            project_dir
                .join(PROJECT_WEEKEND_DIR_NAME)
                .join(PROJECT_AGENT_RUNTIME_GUIDANCE_FILE_NAME),
        )
        .expect("read runtime guidance");
        let _ = std::fs::remove_dir_all(&root);

        assert!(agents.contains("designSystem=none"));
        assert!(!agents.contains("The Weekend design system is available"));
        assert!(runtime_guidance.contains("designSystem=none"));
        assert!(!runtime_guidance.contains("file:./shared-assets/weekend-design"));
    }

    #[test]
    fn create_mode_appends_managed_guidance_to_existing_agent_files() {
        let root = make_temp_project_dir("weekend-guidance-create-existing");
        let project_dir = root.join("rl-lab");
        std::fs::create_dir_all(&project_dir).expect("project dir");
        std::fs::write(project_dir.join("CLAUDE.md"), "# Repo Claude\n").expect("write claude");
        std::fs::write(project_dir.join("AGENTS.md"), "# Repo Agents\n").expect("write agents");

        seed_agent_runtime_guidance_files(&project_dir, SeedMode::Create).expect("seed guidance");
        let claude = std::fs::read_to_string(project_dir.join("CLAUDE.md")).expect("read claude");
        let agents = std::fs::read_to_string(project_dir.join("AGENTS.md")).expect("read agents");
        let _ = std::fs::remove_dir_all(&root);

        assert!(claude.starts_with("# Repo Claude\n"));
        assert!(claude.contains(WEEKEND_BLOCK_BEGIN));
        assert!(claude.contains(WEEKEND_BLOCK_END));
        // Managed block in CLAUDE.md carries the pointer, not the full body.
        assert!(claude.contains(".claude/skills/weekend-suite"));
        assert!(!claude.contains("# Browser Interaction"));
        assert!(agents.starts_with("# Repo Agents\n"));
        assert!(agents.contains(WEEKEND_BLOCK_BEGIN));
        assert!(agents.contains("@weekend/design"));
    }

    #[test]
    fn refresh_mode_replaces_existing_managed_guidance() {
        let root = make_temp_project_dir("weekend-guidance-refresh-managed");
        let project_dir = root.join("rl-lab");
        std::fs::create_dir_all(&project_dir).expect("project dir");
        let old_block = format!(
            "# User Claude\n\n{WEEKEND_BLOCK_BEGIN}\n\nold managed body\n{WEEKEND_BLOCK_END}\n# Tail\n"
        );
        std::fs::write(project_dir.join("CLAUDE.md"), &old_block).expect("write claude");
        std::fs::write(project_dir.join("AGENTS.md"), &old_block).expect("write agents");

        seed_agent_runtime_guidance_files(&project_dir, SeedMode::Refresh).expect("seed guidance");
        let claude = std::fs::read_to_string(project_dir.join("CLAUDE.md")).expect("read claude");
        let agents = std::fs::read_to_string(project_dir.join("AGENTS.md")).expect("read agents");
        let _ = std::fs::remove_dir_all(&root);

        assert!(claude.starts_with("# User Claude\n\n"));
        assert!(claude.ends_with("# Tail\n"));
        assert!(!claude.contains("old managed body"));
        // CLAUDE.md managed block is now the slim pointer.
        assert!(claude.contains(".claude/skills/weekend-suite"));
        // AGENTS.md continues to carry the full guidance.
        assert!(!agents.contains("old managed body"));
        assert!(agents.contains("@weekend/design/tailwind-theme.css"));
        assert!(agents.contains("# Browser Interaction"));
    }

    #[test]
    fn autostart_prompt_requires_weekend_design_by_default() {
        let root = make_temp_project_dir("weekend-autostart-design");
        let project_dir = root.join("rl-lab");
        std::fs::create_dir_all(&project_dir).expect("project dir");

        let prompt = build_agent_autostart_prompt(&project_dir, "build a dashboard");
        let _ = std::fs::remove_dir_all(&root);

        assert!(prompt.contains("designSystem=weekend"));
        assert!(prompt.contains("@weekend/design/tailwind-theme.css"));
        assert!(prompt.contains("User request:\nbuild a dashboard"));
    }

    #[test]
    fn autostart_prompt_skips_weekend_design_when_project_opted_out() {
        let root = make_temp_project_dir("weekend-autostart-no-design");
        let project_dir = root.join("rl-lab");
        std::fs::create_dir_all(&project_dir).expect("project dir");
        std::fs::write(
            project_dir.join(PROJECT_CONFIG_FILE_NAME),
            r#"{
  "runtime": { "mode": "portless", "url": "http://rl-lab.localhost" },
  "startup": { "commands": [] },
  "theme": { "trackShell": true, "designSystem": "none" }
}
"#,
        )
        .expect("write config");

        let prompt = build_agent_autostart_prompt(&project_dir, "build a dashboard");
        let _ = std::fs::remove_dir_all(&root);

        assert_eq!(prompt, "build a dashboard");
    }

    #[test]
    fn extracts_project_name_from_browser_label() {
        assert_eq!(
            project_name_from_browser_webview_label("browser-pane:rl-lab:3"),
            Some("rl-lab")
        );
        assert_eq!(
            project_name_from_browser_webview_label("browser-pane:workspace:foo:9"),
            Some("workspace:foo")
        );
        assert_eq!(
            project_name_from_browser_webview_label("browser-pane:"),
            None
        );
    }
}

pub(crate) fn backfill_mcp_configs() -> Result<(), String> {
    let root = weekend_root()?;
    if !root.exists() {
        return Ok(());
    }

    let entries =
        std::fs::read_dir(&root).map_err(|error| format!("failed to read ~/.weekend: {error}"))?;

    let mut config_count = 0u32;
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

        // Refresh host-owned guidance and MCP config without replacing user-owned
        // CLAUDE.md/AGENTS.md files.
        if let Err(error) = seed_agent_runtime_guidance_files(&project_dir, SeedMode::Refresh) {
            log_backend(
                "WARN",
                format!(
                    "failed to refresh guidance and MCP config for project={project_name}: {error}"
                ),
            );
        } else {
            config_count += 1;
        }
    }

    if config_count > 0 {
        log_backend(
            "INFO",
            format!(
                "refreshed host guidance, .mcp.json, and .codex/config.toml for {config_count} existing project(s)"
            ),
        );
    }
    Ok(())
}
