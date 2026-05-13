use super::*;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectFileBinaryPayload {
    pub(crate) data_base64: String,
    pub(crate) size_bytes: u64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChangedFile {
    path: String,
    status: String,
    staged: bool,
    #[serde(skip_serializing)]
    untracked: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChangedFileWithDiff {
    path: String,
    status: String,
    staged: bool,
    diff: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectFileImportInput {
    file_name: String,
    source_path: Option<String>,
    data_base64: Option<String>,
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

#[tauri::command]
pub(crate) fn read_project_file(project: String, path: String) -> Result<String, String> {
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
pub(crate) fn write_project_file(
    project: String,
    path: String,
    content: String,
) -> Result<(), String> {
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
    std::fs::write(&target, content)
        .map_err(|error| format!("failed to write {}: {error}", target.display()))
}

#[tauri::command]
pub(crate) fn read_project_file_binary(
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
pub(crate) fn rename_project_path(
    project: String,
    path: String,
    new_name: String,
) -> Result<String, String> {
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
pub(crate) fn delete_project_path(project: String, path: String) -> Result<(), String> {
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

fn project_has_git_repo(project_dir: &Path) -> bool {
    project_dir.join(".git").exists()
}

const GIT_CHANGED_FILES_STATUS_ARGS: &[&str] = &[
    "status",
    "--porcelain=v1",
    "-z",
    "--no-renames",
    "--untracked-files=all",
];

fn parse_porcelain_status(stdout: &str) -> Vec<ChangedFile> {
    // Format: XY <space> path  (X = index/staged, Y = worktree/unstaged).
    // Renames append " -> new". For our purposes the new path is the one we care about.
    let mut out: Vec<ChangedFile> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for raw in stdout.lines() {
        if raw.len() < 4 {
            continue;
        }
        let bytes = raw.as_bytes();
        let x = bytes[0] as char;
        let y = bytes[1] as char;
        let rest = &raw[3..];

        // Untracked: "??"
        if x == '?' && y == '?' {
            let path = rest.to_string();
            if seen.insert(path.clone()) {
                out.push(ChangedFile {
                    path,
                    status: "U".to_string(),
                    staged: false,
                    untracked: true,
                });
            }
            continue;
        }

        let path = if let Some(idx) = rest.find(" -> ") {
            rest[idx + 4..].to_string()
        } else {
            rest.to_string()
        };

        let staged_status = match x {
            ' ' | '?' => None,
            other => Some(other),
        };
        let unstaged_status = match y {
            ' ' | '?' => None,
            other => Some(other),
        };

        let (code, staged) = match (staged_status, unstaged_status) {
            (Some(s), _) => (s, true),
            (None, Some(u)) => (u, false),
            (None, None) => continue,
        };

        let status = match code {
            'A' => "A",
            'M' => "M",
            'D' => "D",
            'R' => "R",
            'C' => "R",
            'U' => "U",
            _ => "M",
        }
        .to_string();

        if seen.insert(path.clone()) {
            out.push(ChangedFile {
                path,
                status,
                staged,
                untracked: false,
            });
        }
    }

    out
}

fn split_git_diff_by_path(patch: &str, paths: &[String]) -> HashMap<String, String> {
    let expected_headers: HashMap<String, String> = paths
        .iter()
        .map(|path| (format!("diff --git a/{path} b/{path}"), path.clone()))
        .collect();
    if expected_headers.is_empty() || patch.is_empty() {
        return HashMap::new();
    }

    let marker = "diff --git ";
    let mut starts = Vec::new();
    let mut search_from = 0;
    while let Some(relative) = patch[search_from..].find(marker) {
        let start = search_from + relative;
        if start == 0 || patch.as_bytes().get(start - 1) == Some(&b'\n') {
            starts.push(start);
        }
        search_from = start + marker.len();
    }

    let mut diffs = HashMap::new();
    for (index, start) in starts.iter().enumerate() {
        let end = starts.get(index + 1).copied().unwrap_or(patch.len());
        let section = &patch[*start..end];
        let header = section.lines().next().unwrap_or_default();
        if let Some(path) = expected_headers.get(header) {
            diffs.insert(path.clone(), section.to_string());
        }
    }

    diffs
}

#[tauri::command]
pub(crate) fn git_changed_files(project: String) -> Result<Vec<ChangedFile>, String> {
    let project_dir = resolve_project_dir(&project)?;
    if !project_has_git_repo(&project_dir) {
        return Ok(Vec::new());
    }

    let output = std::process::Command::new("git")
        .arg("-C")
        .arg(&project_dir)
        .args(GIT_CHANGED_FILES_STATUS_ARGS)
        .output()
        .map_err(|error| format!("failed to run git status: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git status failed: {}", stderr.trim()));
    }

    // We requested -z which uses NUL separators and skips quoting. Re-stream
    // the records as newline-separated lines for the porcelain parser.
    let raw = String::from_utf8_lossy(&output.stdout);
    let normalized = raw.replace('\0', "\n");
    Ok(parse_porcelain_status(&normalized))
}

fn run_git_diff_for_tracked_files(
    project_dir: &Path,
    sanitized_paths: &[String],
) -> Result<HashMap<String, String>, String> {
    if sanitized_paths.is_empty() {
        return Ok(HashMap::new());
    }

    let output = std::process::Command::new("git")
        .arg("-C")
        .arg(project_dir)
        .arg("-c")
        .arg("core.quotePath=false")
        .arg("diff")
        .arg("HEAD")
        .arg("--no-color")
        .arg("--no-ext-diff")
        .arg("--no-renames")
        .output()
        .map_err(|error| format!("failed to run git diff: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git diff failed: {}", stderr.trim()));
    }

    let patch = String::from_utf8_lossy(&output.stdout);
    Ok(split_git_diff_by_path(&patch, sanitized_paths))
}

fn collect_diff_targets(
    files: Vec<ChangedFile>,
) -> (Vec<(ChangedFile, Option<String>)>, Vec<String>) {
    let mut entries = Vec::with_capacity(files.len());
    let mut tracked_paths = Vec::new();

    for file in files {
        let sanitized = sanitize_project_relative_path(&file.path).ok();
        if !file.untracked {
            if let Some(path) = sanitized.as_ref() {
                tracked_paths.push(path.clone());
            }
        }
        entries.push((file, sanitized));
    }

    (entries, tracked_paths)
}

fn diff_file_mode(path: &Path) -> &'static str {
    #[cfg(unix)]
    {
        if let Ok(metadata) = std::fs::metadata(path) {
            if metadata.permissions().mode() & 0o111 != 0 {
                return "100755";
            }
        }
    }

    "100644"
}

fn binary_untracked_diff(sanitized: &str, mode: &str) -> String {
    format!(
        "diff --git a/{0} b/{0}\nnew file mode {mode}\nindex 0000000..0000000\nBinary files /dev/null and b/{0} differ\n",
        sanitized
    )
}

fn build_untracked_text_diff(sanitized: &str, content: &str, mode: &str) -> String {
    let line_count = content.lines().count();
    let mut patch = format!(
        "diff --git a/{0} b/{0}\nnew file mode {mode}\nindex 0000000..0000000\n--- /dev/null\n+++ b/{0}\n",
        sanitized
    );

    if line_count == 0 {
        return patch;
    }

    patch.push_str(&format!("@@ -0,0 +1,{line_count} @@\n"));
    for line in content.split_inclusive('\n') {
        let line_without_newline = line.strip_suffix('\n').unwrap_or(line);
        patch.push('+');
        patch.push_str(line_without_newline);
        patch.push('\n');
    }
    if !content.ends_with('\n') {
        patch.push_str("\\ No newline at end of file\n");
    }

    patch
}

fn run_git_diff_for_untracked_file(project_dir: &Path, sanitized: &str) -> Result<String, String> {
    let absolute = project_dir.join(sanitized);
    if !absolute.exists() || absolute.is_dir() {
        return Ok(String::new());
    }

    let mode = diff_file_mode(&absolute);
    let bytes = std::fs::read(&absolute)
        .map_err(|error| format!("failed to read {}: {error}", absolute.display()))?;
    if bytes.iter().any(|byte| *byte == 0) {
        return Ok(binary_untracked_diff(sanitized, mode));
    }

    match String::from_utf8(bytes) {
        Ok(content) => Ok(build_untracked_text_diff(sanitized, &content, mode)),
        Err(_) => Ok(binary_untracked_diff(sanitized, mode)),
    }
}

fn run_git_diff_for_file(project_dir: &Path, sanitized: &str) -> Result<String, String> {
    // git diff HEAD covers staged + unstaged. For untracked files this prints
    // nothing, so synthesize an added-file patch without shelling out again.
    let primary = std::process::Command::new("git")
        .arg("-C")
        .arg(project_dir)
        .arg("-c")
        .arg("core.quotePath=false")
        .arg("diff")
        .arg("HEAD")
        .arg("--no-color")
        .arg("--no-ext-diff")
        .arg("--no-renames")
        .arg("--")
        .arg(sanitized)
        .output()
        .map_err(|error| format!("failed to run git diff: {error}"))?;

    if primary.status.success() {
        let patch = String::from_utf8_lossy(&primary.stdout).into_owned();
        if !patch.trim().is_empty() {
            return Ok(patch);
        }
    }

    let absolute = project_dir.join(sanitized);
    if !absolute.exists() {
        if !primary.status.success() {
            let stderr = String::from_utf8_lossy(&primary.stderr);
            return Err(format!("git diff failed: {}", stderr.trim()));
        }
        return Ok(String::new());
    }

    run_git_diff_for_untracked_file(project_dir, sanitized)
}

#[cfg(test)]
mod git_diff_tests {
    use super::{
        build_untracked_text_diff, collect_diff_targets, parse_porcelain_status,
        split_git_diff_by_path, GIT_CHANGED_FILES_STATUS_ARGS,
    };

    #[test]
    fn parse_porcelain_status_marks_only_question_question_entries_as_untracked() {
        let files =
            parse_porcelain_status("?? src/new.ts\n M src/changed.ts\nU  src/conflict.ts\n");

        assert_eq!(files.len(), 3);
        assert_eq!(files[0].path, "src/new.ts");
        assert_eq!(files[0].status, "U");
        assert!(!files[0].staged);
        assert!(files[0].untracked);

        assert_eq!(files[1].path, "src/changed.ts");
        assert_eq!(files[1].status, "M");
        assert!(!files[1].staged);
        assert!(!files[1].untracked);

        assert_eq!(files[2].path, "src/conflict.ts");
        assert_eq!(files[2].status, "U");
        assert!(files[2].staged);
        assert!(!files[2].untracked);
    }

    #[test]
    fn split_git_diff_by_path_maps_diff_sections_to_status_paths() {
        let patch = concat!(
            "diff --git a/src/a.ts b/src/a.ts\n",
            "index 1111111..2222222 100644\n",
            "--- a/src/a.ts\n",
            "+++ b/src/a.ts\n",
            "@@ -1 +1 @@\n",
            "-old\n",
            "+new\n",
            "diff --git a/dir/file with spaces.ts b/dir/file with spaces.ts\n",
            "index 3333333..4444444 100644\n",
            "--- a/dir/file with spaces.ts\n",
            "+++ b/dir/file with spaces.ts\n",
            "@@ -1 +1 @@\n",
            "-before\n",
            "+after\n",
        );
        let paths = vec![
            "src/a.ts".to_string(),
            "dir/file with spaces.ts".to_string(),
        ];

        let diffs = split_git_diff_by_path(patch, &paths);

        assert_eq!(diffs.len(), 2);
        assert!(diffs["src/a.ts"].contains("+new\n"));
        assert!(!diffs["src/a.ts"].contains("+after\n"));
        assert!(diffs["dir/file with spaces.ts"].contains("+after\n"));
    }

    #[test]
    fn build_untracked_text_diff_synthesizes_added_file_patch() {
        let patch = build_untracked_text_diff("src/new.ts", "one\ntwo", "100644");

        assert!(patch.starts_with("diff --git a/src/new.ts b/src/new.ts\n"));
        assert!(patch.contains("new file mode 100644\n"));
        assert!(patch.contains("--- /dev/null\n+++ b/src/new.ts\n"));
        assert!(patch.contains("@@ -0,0 +1,2 @@\n"));
        assert!(patch.contains("+one\n+two\n"));
        assert!(patch.contains("\\ No newline at end of file\n"));
    }

    #[test]
    fn git_changed_files_status_args_expand_untracked_directories() {
        assert!(GIT_CHANGED_FILES_STATUS_ARGS.contains(&"--untracked-files=all"));
    }

    #[test]
    fn collect_diff_targets_preserves_entries_without_diffable_paths() {
        let files = parse_porcelain_status("?? generated/\n M src/changed.ts\n");

        let (entries, tracked_paths) = collect_diff_targets(files);

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].0.path, "generated/");
        assert!(entries[0].1.is_none());
        assert_eq!(entries[1].0.path, "src/changed.ts");
        assert_eq!(entries[1].1.as_deref(), Some("src/changed.ts"));
        assert_eq!(tracked_paths, vec!["src/changed.ts"]);
    }
}

#[tauri::command]
pub(crate) fn git_diff_file(project: String, path: String) -> Result<String, String> {
    let project_dir = resolve_project_dir(&project)?;
    if !project_has_git_repo(&project_dir) {
        return Err("project is not a git repository".to_string());
    }
    let sanitized = sanitize_project_relative_path(&path)?;
    run_git_diff_for_file(&project_dir, &sanitized)
}

#[tauri::command]
pub(crate) fn git_changed_files_with_diffs(
    project: String,
) -> Result<Vec<ChangedFileWithDiff>, String> {
    let project_dir = resolve_project_dir(&project)?;
    if !project_has_git_repo(&project_dir) {
        return Ok(Vec::new());
    }

    let status_output = std::process::Command::new("git")
        .arg("-C")
        .arg(&project_dir)
        .args(GIT_CHANGED_FILES_STATUS_ARGS)
        .output()
        .map_err(|error| format!("failed to run git status: {error}"))?;

    if !status_output.status.success() {
        let stderr = String::from_utf8_lossy(&status_output.stderr);
        return Err(format!("git status failed: {}", stderr.trim()));
    }

    let raw = String::from_utf8_lossy(&status_output.stdout);
    let normalized = raw.replace('\0', "\n");
    let files = parse_porcelain_status(&normalized);

    let (sanitized_files, tracked_paths) = collect_diff_targets(files);
    let mut tracked_diffs = run_git_diff_for_tracked_files(&project_dir, &tracked_paths).ok();

    let mut out = Vec::with_capacity(sanitized_files.len());
    for (file, sanitized) in sanitized_files {
        let diff = match sanitized {
            None => String::new(),
            Some(sanitized) if file.untracked => {
                run_git_diff_for_untracked_file(&project_dir, &sanitized).unwrap_or_default()
            }
            Some(sanitized) => {
                if let Some(diffs) = tracked_diffs.as_mut() {
                    diffs.remove(&sanitized).unwrap_or_else(|| {
                        run_git_diff_for_file(&project_dir, &sanitized).unwrap_or_default()
                    })
                } else {
                    run_git_diff_for_file(&project_dir, &sanitized).unwrap_or_default()
                }
            }
        };
        out.push(ChangedFileWithDiff {
            path: file.path,
            status: file.status,
            staged: file.staged,
            diff,
        });
    }

    Ok(out)
}

#[tauri::command]
pub(crate) fn import_external_files_to_project(
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
