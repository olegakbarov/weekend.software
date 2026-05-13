use super::*;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectTreeNode {
    name: String,
    path: String,
    is_dir: bool,
    children: Vec<ProjectTreeNode>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectTreeChangedPayload {
    project: String,
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

pub(crate) fn relative_path(root: &Path, path: &Path) -> String {
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

pub(crate) fn is_reserved_root_entry(name: &str) -> bool {
    matches!(
        name,
        "logs" | SHARED_ASSETS_ROOT_DIR_NAME | PROJECT_BRIDGE_PORT_DIR_NAME
    )
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
            PathBuf::from("/home/user/.weekend/README.md"),
            PathBuf::from("/home/user/.weekend/sandbox/src/main.ts"),
        ];

        let projects = extract_projects_from_event_paths(&watched_roots, &changed_paths);

        assert_eq!(projects, vec!["sandbox".to_string()]);
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

pub(crate) fn spawn_project_tree_watcher<R: Runtime + 'static>(app: AppHandle<R>) {
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

#[tauri::command]
pub(crate) fn list_project_tree(project: String) -> Result<Vec<ProjectTreeNode>, String> {
    let project_dir = resolve_project_dir(&project)?;
    build_project_tree(&project_dir, &project_dir, 0)
}
