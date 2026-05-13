use super::*;

pub(crate) struct TerminalSession {
    pub(crate) terminal_id: Mutex<String>,
    pub(crate) master: Mutex<Box<dyn portable_pty::MasterPty + Send>>,
    pub(crate) writer: Mutex<Box<dyn Write + Send>>,
    pub(crate) child: Mutex<Box<dyn portable_pty::Child + Send>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TerminalSessionInfo {
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
    #[serde(default)]
    agent_profile_id: Option<String>,
    #[serde(default)]
    agent_instance_id: Option<String>,
    #[serde(default)]
    agent_provider: Option<String>,
    #[serde(default)]
    agent_session_id: Option<String>,
}

/// Lock ordering: when both `sessions` and `session_info` are needed,
/// acquire `sessions` first, drop it, then acquire `session_info`. Never hold both.
/// `output_rings` follows the same rule — acquire AFTER `sessions` if both are
/// needed; hold briefly, never nest with `session_info`.
#[derive(Clone)]
pub(crate) struct TerminalState {
    sessions: Arc<Mutex<HashMap<String, Arc<TerminalSession>>>>,
    opening_sessions: Arc<Mutex<HashSet<String>>>,
    session_info: Arc<Mutex<HashMap<String, TerminalSessionInfo>>>,
    output_rings: Arc<Mutex<HashMap<String, TerminalOutputRing>>>,
}

impl TerminalState {
    pub(crate) fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            opening_sessions: Arc::new(Mutex::new(HashSet::new())),
            session_info: Arc::new(Mutex::new(HashMap::new())),
            output_rings: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

/// Max complete lines retained per terminal in the ring buffer.
const TERMINAL_RING_MAX_LINES: usize = 2000;
/// Max bytes in a single unflushed line before force-flushing
/// (prevents `\r`-spammers from growing the partial buffer unbounded).
const TERMINAL_RING_MAX_PARTIAL_BYTES: usize = 4096;

/// Line-bounded ring buffer of decoded terminal output, used by the bridge's
/// `terminal_read` to pull lines after a given seq. Distinct from the byte-chunk
/// `seq` in `spawn_terminal_reader`: this seq counts retained lines, monotonic
/// per terminal, starting at 1.
#[derive(Debug)]
struct TerminalOutputRing {
    lines: std::collections::VecDeque<(u64, String)>,
    next_seq: u64,
    oldest_seq: u64,
    partial: String,
}

impl TerminalOutputRing {
    pub(crate) fn new() -> Self {
        Self {
            lines: std::collections::VecDeque::new(),
            next_seq: 1,
            oldest_seq: 1,
            partial: String::new(),
        }
    }

    fn push_line(&mut self, line: String) {
        let seq = self.next_seq;
        self.next_seq = self.next_seq.saturating_add(1);
        self.lines.push_back((seq, line));
        while self.lines.len() > TERMINAL_RING_MAX_LINES {
            if let Some((dropped_seq, _)) = self.lines.pop_front() {
                // After eviction the smallest retained seq is dropped_seq+1.
                self.oldest_seq = dropped_seq.saturating_add(1);
            } else {
                break;
            }
        }
    }

    fn ingest(&mut self, chunk: &str) {
        for ch in chunk.chars() {
            if ch == '\n' {
                // Strip trailing \r for \r\n line endings.
                if self.partial.ends_with('\r') {
                    self.partial.pop();
                }
                let line = std::mem::take(&mut self.partial);
                self.push_line(line);
            } else {
                self.partial.push(ch);
                if self.partial.len() >= TERMINAL_RING_MAX_PARTIAL_BYTES {
                    let line = std::mem::take(&mut self.partial);
                    self.push_line(line);
                }
            }
        }
    }
}

fn push_terminal_output_chunk(
    output_rings: &Arc<Mutex<HashMap<String, TerminalOutputRing>>>,
    terminal_id: &str,
    chunk: &str,
) {
    if let Ok(mut map) = output_rings.lock() {
        let ring = map
            .entry(terminal_id.to_string())
            .or_insert_with(TerminalOutputRing::new);
        ring.ingest(chunk);
    }
}

#[cfg(test)]
mod terminal_output_ring_tests {
    use super::*;

    #[test]
    fn ingests_lf_terminated_lines_with_monotonic_seq() {
        let mut ring = TerminalOutputRing::new();
        ring.ingest("hello\nworld\n");
        assert_eq!(ring.lines.len(), 2);
        assert_eq!(ring.lines[0], (1, "hello".to_string()));
        assert_eq!(ring.lines[1], (2, "world".to_string()));
        assert_eq!(ring.next_seq, 3);
        assert_eq!(ring.oldest_seq, 1);
        assert!(ring.partial.is_empty());
    }

    #[test]
    fn strips_trailing_cr_for_crlf_endings() {
        let mut ring = TerminalOutputRing::new();
        ring.ingest("hello\r\nworld\r\n");
        assert_eq!(ring.lines.len(), 2);
        assert_eq!(ring.lines[0].1, "hello");
        assert_eq!(ring.lines[1].1, "world");
    }

    #[test]
    fn buffers_partial_line_across_chunks() {
        let mut ring = TerminalOutputRing::new();
        ring.ingest("hel");
        assert_eq!(ring.lines.len(), 0);
        assert_eq!(ring.partial, "hel");
        ring.ingest("lo\n");
        assert_eq!(ring.lines.len(), 1);
        assert_eq!(ring.lines[0].1, "hello");
        assert!(ring.partial.is_empty());
    }

    #[test]
    fn bare_cr_progress_bar_does_not_emit_line() {
        let mut ring = TerminalOutputRing::new();
        ring.ingest("loading 10%\rloading 20%\r");
        // No \n means no flush; everything sits in partial.
        assert_eq!(ring.lines.len(), 0);
        assert!(ring.partial.ends_with('\r'));
    }

    #[test]
    fn force_flushes_oversized_partial_line() {
        let mut ring = TerminalOutputRing::new();
        // 4096 bytes of CRs (no \n) — should force-flush exactly at the cap.
        let crs = "\r".repeat(TERMINAL_RING_MAX_PARTIAL_BYTES);
        ring.ingest(&crs);
        assert_eq!(ring.lines.len(), 1);
        assert_eq!(ring.lines[0].1.len(), TERMINAL_RING_MAX_PARTIAL_BYTES);
        assert!(ring.partial.is_empty());
    }

    #[test]
    fn evicts_oldest_lines_above_cap_and_advances_oldest_seq() {
        let mut ring = TerminalOutputRing::new();
        let overflow = 5usize;
        for i in 0..(TERMINAL_RING_MAX_LINES + overflow) {
            ring.ingest(&format!("line {i}\n"));
        }
        assert_eq!(ring.lines.len(), TERMINAL_RING_MAX_LINES);
        // First `overflow` lines (seq 1..=5) should have been evicted.
        assert_eq!(ring.lines.front().unwrap().0, (overflow as u64) + 1);
        assert_eq!(ring.oldest_seq, (overflow as u64) + 1);
        assert_eq!(
            ring.next_seq,
            (TERMINAL_RING_MAX_LINES as u64) + (overflow as u64) + 1
        );
    }

    #[test]
    fn empty_lines_are_retained_with_their_own_seq() {
        let mut ring = TerminalOutputRing::new();
        ring.ingest("\n\n");
        assert_eq!(ring.lines.len(), 2);
        assert_eq!(ring.lines[0], (1, String::new()));
        assert_eq!(ring.lines[1], (2, String::new()));
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
pub(crate) struct RuntimeDebugSnapshot {
    generated_at_unix_ms: u64,
    terminal_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TerminalOpenSizeInput {
    cols: u16,
    rows: u16,
}

fn terminal_id_belongs_to_project(terminal_id: &str, project: &str) -> bool {
    let project_prefix = format!("{project}:");
    terminal_id.starts_with(project_prefix.as_str()) || terminal_id == format!("main-{project}")
}

fn rekey_project_terminal_id(terminal_id: &str, old_name: &str, new_name: &str) -> Option<String> {
    let old_prefix = format!("{old_name}:");
    if let Some(suffix) = terminal_id.strip_prefix(old_prefix.as_str()) {
        return Some(format!("{new_name}:{suffix}"));
    }
    if terminal_id == format!("main-{old_name}") {
        return Some(format!("main-{new_name}"));
    }
    None
}

pub(crate) struct DetachedProjectTerminalSessions {
    pub(crate) terminal_ids: Vec<String>,
    pub(crate) sessions: Vec<Arc<TerminalSession>>,
}

pub(crate) fn detach_project_terminal_sessions(
    terminal_state: &TerminalState,
    project: &str,
) -> Result<DetachedProjectTerminalSessions, String> {
    let mut terminal_ids = Vec::<String>::new();
    let mut detached_sessions = Vec::<Arc<TerminalSession>>::new();

    {
        let mut sessions = terminal_state
            .sessions
            .lock()
            .map_err(|_| "failed to lock terminal sessions".to_string())?;
        let session_ids: Vec<String> = sessions
            .keys()
            .filter(|terminal_id| terminal_id_belongs_to_project(terminal_id, project))
            .cloned()
            .collect();
        for terminal_id in session_ids {
            if let Some(session) = sessions.remove(&terminal_id) {
                terminal_ids.push(terminal_id);
                detached_sessions.push(session);
            }
        }
    }

    if let Ok(mut opening_sessions) = terminal_state.opening_sessions.lock() {
        let opening_ids: Vec<String> = opening_sessions
            .iter()
            .filter(|terminal_id| terminal_id_belongs_to_project(terminal_id, project))
            .cloned()
            .collect();
        opening_sessions
            .retain(|terminal_id| !terminal_id_belongs_to_project(terminal_id, project));
        terminal_ids.extend(opening_ids);
    }

    {
        let mut session_info = terminal_state
            .session_info
            .lock()
            .map_err(|_| "failed to lock session info".to_string())?;
        let info_ids: Vec<String> = session_info
            .keys()
            .filter(|terminal_id| terminal_id_belongs_to_project(terminal_id, project))
            .cloned()
            .collect();
        for terminal_id in info_ids {
            session_info.remove(&terminal_id);
            terminal_ids.push(terminal_id);
        }
    }

    terminal_ids.sort_unstable();
    terminal_ids.dedup();
    Ok(DetachedProjectTerminalSessions {
        terminal_ids,
        sessions: detached_sessions,
    })
}

pub(crate) fn kill_detached_terminal_sessions(sessions: Vec<Arc<TerminalSession>>) {
    for session in sessions {
        std::thread::spawn(move || {
            if let Ok(mut child) = session.child.lock() {
                let _ = child.kill();
            }
        });
    }
}

pub(crate) fn rekey_project_terminal_state(
    terminal_state: &TerminalState,
    old_name: &str,
    new_name: &str,
) -> Result<Vec<TerminalSessionInfo>, String> {
    {
        let mut sessions = terminal_state
            .sessions
            .lock()
            .map_err(|_| "failed to lock terminal sessions".to_string())?;
        let rekeys: Vec<(String, String)> = sessions
            .keys()
            .filter_map(|terminal_id| {
                rekey_project_terminal_id(terminal_id, old_name, new_name)
                    .map(|new_id| (terminal_id.clone(), new_id))
            })
            .collect();
        for (old_id, new_id) in rekeys {
            let Some(session) = sessions.remove(&old_id) else {
                continue;
            };
            if sessions.contains_key(&new_id) {
                log_backend(
                    "WARN",
                    format!(
                        "skipped terminal session rekey old_id={old_id} new_id={new_id}: target exists"
                    ),
                );
                sessions.insert(old_id, session);
            } else {
                if let Ok(mut current_terminal_id) = session.terminal_id.lock() {
                    *current_terminal_id = new_id.clone();
                }
                sessions.insert(new_id, session);
            }
        }
    }

    if let Ok(mut opening_sessions) = terminal_state.opening_sessions.lock() {
        let rekeys: Vec<(String, String)> = opening_sessions
            .iter()
            .filter_map(|terminal_id| {
                rekey_project_terminal_id(terminal_id, old_name, new_name)
                    .map(|new_id| (terminal_id.clone(), new_id))
            })
            .collect();
        for (old_id, new_id) in rekeys {
            opening_sessions.remove(&old_id);
            opening_sessions.insert(new_id);
        }
    }

    let mut updated_infos = Vec::<TerminalSessionInfo>::new();
    {
        let mut session_info = terminal_state
            .session_info
            .lock()
            .map_err(|_| "failed to lock session info".to_string())?;
        let rekeys: Vec<(String, String)> = session_info
            .keys()
            .filter_map(|terminal_id| {
                rekey_project_terminal_id(terminal_id, old_name, new_name)
                    .map(|new_id| (terminal_id.clone(), new_id))
            })
            .collect();
        for (old_id, new_id) in rekeys {
            let Some(mut info) = session_info.remove(&old_id) else {
                continue;
            };
            if session_info.contains_key(&new_id) {
                log_backend(
                    "WARN",
                    format!(
                        "skipped terminal session info rekey old_id={old_id} new_id={new_id}: target exists"
                    ),
                );
                session_info.insert(old_id, info);
            } else {
                info.terminal_id = new_id.clone();
                info.project = new_name.to_string();
                updated_infos.push(info.clone());
                session_info.insert(new_id, info);
            }
        }
    }

    Ok(updated_infos)
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
pub(crate) fn shell_name() -> String {
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
    pgid: i32,
    state: String,
    tty: String,
    command: String,
}

pub(crate) fn normalize_process_name(command: &str) -> String {
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
pub(crate) fn is_wrapper_process_name(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "claude" | "cursor" | "aider" | "copilot" | "codex" | "gemini" | "goose"
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
        "codex" => "Codex",
        "gemini" => "Gemini",
        "goose" => "Goose",
        _ => "",
    };
    if !known.is_empty() {
        return known.to_string();
    }
    // Title-case the name and append "Shell" if it looks like one
    let titled = normalized
        .replace(['_', '-'], " ")
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
        let Some(pgid_raw) = parts.next() else {
            continue;
        };
        let Some(state_raw) = parts.next() else {
            continue;
        };
        let Some(tty_raw) = parts.next() else {
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
        let pgid = match pgid_raw.parse::<i32>() {
            Ok(value) if value > 0 => value,
            _ => continue,
        };
        let state = state_raw.trim().to_string();
        if state.is_empty() {
            continue;
        }
        let tty = tty_raw.trim().to_string();
        if tty.is_empty() {
            continue;
        }
        let command = parts.collect::<Vec<_>>().join(" ");
        if command.is_empty() {
            continue;
        }
        entries.push(PsProcessEntry {
            pid,
            ppid,
            pgid,
            state,
            tty,
            command,
        });
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

fn has_terminal_tty(tty: &str) -> bool {
    let normalized = tty.trim();
    !normalized.is_empty() && normalized != "?" && normalized != "??"
}

fn is_foreground_process_state(state: &str) -> bool {
    state.contains('+')
}

#[derive(Debug, Clone)]
struct TerminalProcessCandidate {
    pid: i32,
    depth: usize,
    name: String,
    same_tty: bool,
    foreground: bool,
    non_shell: bool,
    representative: bool,
    wrapper: bool,
}

fn compare_terminal_process_candidates(
    left: &TerminalProcessCandidate,
    right: &TerminalProcessCandidate,
) -> std::cmp::Ordering {
    left.same_tty
        .cmp(&right.same_tty)
        .then(left.foreground.cmp(&right.foreground))
        .then(left.non_shell.cmp(&right.non_shell))
        .then(left.representative.cmp(&right.representative))
        .then(left.wrapper.cmp(&right.wrapper))
        // Prefer the top-level foreground command over deep helper children.
        .then_with(|| right.depth.cmp(&left.depth))
        .then_with(|| right.pid.cmp(&left.pid))
}

fn resolve_terminal_process_name(
    shell_pid: i32,
    process_by_pid: &HashMap<i32, PsProcessEntry>,
    child_pids_by_parent: &HashMap<i32, Vec<i32>>,
) -> String {
    let shell_entry = process_by_pid.get(&shell_pid);
    let shell_label = shell_entry
        .map(|entry| normalize_process_name(&entry.command))
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "shell".to_string());
    let shell_tty = shell_entry
        .map(|entry| entry.tty.trim())
        .filter(|tty| has_terminal_tty(tty));

    let descendants = collect_descendants_by_depth(shell_pid, child_pids_by_parent);
    let best = descendants
        .into_iter()
        .filter_map(|(pid, depth)| {
            let entry = process_by_pid.get(&pid)?;
            let name = normalize_process_name(&entry.command);
            if name.is_empty() {
                return None;
            }
            let same_tty = shell_tty
                .map(|tty| tty == entry.tty.trim())
                .unwrap_or(false);
            let wrapper = is_wrapper_process_name(&name);
            let non_shell = !is_shell_process_name(&name);
            Some(TerminalProcessCandidate {
                pid,
                depth,
                name,
                same_tty,
                foreground: is_foreground_process_state(&entry.state),
                non_shell,
                representative: wrapper || entry.pid == entry.pgid,
                wrapper,
            })
        })
        .max_by(compare_terminal_process_candidates);

    best.map(|candidate| candidate.name).unwrap_or(shell_label)
}

#[cfg(test)]
mod terminal_process_tests {
    use super::{parse_ps_process_entries, resolve_terminal_process_name, PsProcessEntry};
    use std::collections::HashMap;

    fn entry(
        pid: i32,
        ppid: i32,
        pgid: i32,
        state: &str,
        tty: &str,
        command: &str,
    ) -> PsProcessEntry {
        PsProcessEntry {
            pid,
            ppid,
            pgid,
            state: state.to_string(),
            tty: tty.to_string(),
            command: command.to_string(),
        }
    }

    fn process_maps(
        entries: Vec<PsProcessEntry>,
    ) -> (HashMap<i32, PsProcessEntry>, HashMap<i32, Vec<i32>>) {
        let mut process_by_pid = HashMap::<i32, PsProcessEntry>::new();
        let mut child_pids_by_parent = HashMap::<i32, Vec<i32>>::new();

        for entry in entries {
            child_pids_by_parent
                .entry(entry.ppid)
                .or_default()
                .push(entry.pid);
            process_by_pid.insert(entry.pid, entry);
        }

        (process_by_pid, child_pids_by_parent)
    }

    #[test]
    fn parse_ps_process_entries_reads_extended_process_fields() {
        let entries = parse_ps_process_entries(
            "100 1 100 Ss ttys002 zsh\n200 100 200 S+ ttys002 next-server (v15.5.10)\n",
        );

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[1].pgid, 200);
        assert_eq!(entries[1].state, "S+");
        assert_eq!(entries[1].tty, "ttys002");
        assert_eq!(entries[1].command, "next-server (v15.5.10)");
    }

    #[test]
    fn resolve_terminal_process_name_prefers_foreground_job_leader() {
        let (process_by_pid, child_pids_by_parent) = process_maps(vec![
            entry(100, 1, 100, "Ss", "ttys002", "zsh"),
            entry(200, 100, 200, "S+", "ttys002", "/usr/bin/python3"),
            entry(201, 200, 200, "S+", "ttys002", "sleep"),
        ]);

        let label = resolve_terminal_process_name(100, &process_by_pid, &child_pids_by_parent);

        assert_eq!(label, "python3");
    }

    #[test]
    fn resolve_terminal_process_name_prefers_attached_process_over_detached_helper() {
        let (process_by_pid, child_pids_by_parent) = process_maps(vec![
            entry(100, 1, 100, "Ss", "ttys002", "zsh"),
            entry(200, 100, 200, "S+", "ttys002", "pnpm"),
            entry(201, 200, 201, "S", "??", "node"),
        ]);

        let label = resolve_terminal_process_name(100, &process_by_pid, &child_pids_by_parent);

        assert_eq!(label, "pnpm");
    }

    #[test]
    fn resolve_terminal_process_name_keeps_wrapper_label_for_wrapper_children() {
        let (process_by_pid, child_pids_by_parent) = process_maps(vec![
            entry(100, 1, 100, "Ss", "ttys002", "zsh"),
            entry(200, 100, 200, "S+", "ttys002", "claude"),
            entry(201, 200, 200, "S+", "ttys002", "node"),
        ]);

        let label = resolve_terminal_process_name(100, &process_by_pid, &child_pids_by_parent);

        assert_eq!(label, "claude");
    }
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
    session: Arc<TerminalSession>,
    sessions: Arc<Mutex<HashMap<String, Arc<TerminalSession>>>>,
    session_info: Arc<Mutex<HashMap<String, TerminalSessionInfo>>>,
    output_rings: Arc<Mutex<HashMap<String, TerminalOutputRing>>>,
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
                    let current_terminal_id = session
                        .terminal_id
                        .lock()
                        .map(|value| value.clone())
                        .unwrap_or_else(|_| terminal_id.clone());
                    push_terminal_output_chunk(&output_rings, &current_terminal_id, &data);
                    let payload = TerminalOutputPayload {
                        terminal_id: current_terminal_id,
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
                let current_terminal_id = session
                    .terminal_id
                    .lock()
                    .map(|value| value.clone())
                    .unwrap_or_else(|_| terminal_id.clone());
                push_terminal_output_chunk(&output_rings, &current_terminal_id, &data);
                let payload = TerminalOutputPayload {
                    terminal_id: current_terminal_id,
                    seq,
                    data,
                };
                let _ = app.emit("terminal-output", payload);
            }
            pending_utf8.clear();
        }

        let current_terminal_id = session
            .terminal_id
            .lock()
            .map(|value| value.clone())
            .unwrap_or_else(|_| terminal_id.clone());
        if debug_enabled && replacement_total > 0 {
            log_backend(
                "WARN",
                format!(
                    "terminal reader utf8 replacements terminal_id={} replacements={replacement_total}",
                    current_terminal_id
                ),
            );
        }

        if let Ok(mut map) = sessions.lock() {
            map.remove(&current_terminal_id);
        }
        if let Ok(mut rings) = output_rings.lock() {
            rings.remove(&current_terminal_id);
        }

        // Mark session as exited and emit event (only if not already removed
        // by terminal_remove_session — avoids ghost re-add race condition)
        if let Ok(mut info_map) = session_info.lock() {
            if let Some(info) = info_map.get_mut(&current_terminal_id) {
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

#[tauri::command]
pub(crate) fn terminal_open<R: Runtime>(
    terminal_id: String,
    project: Option<String>,
    size: TerminalOpenSizeInput,
    play_spawned: Option<bool>,
    process_role: Option<String>,
    agent_profile_id: Option<String>,
    agent_instance_id: Option<String>,
    agent_provider: Option<String>,
    agent_session_id: Option<String>,
    agent_command: Option<String>,
    terminal_state: State<'_, TerminalState>,
    app: AppHandle<R>,
) -> Result<(), String> {
    do_terminal_open(
        terminal_id,
        project,
        size,
        play_spawned,
        process_role,
        agent_profile_id,
        agent_instance_id,
        agent_provider,
        agent_session_id,
        agent_command,
        terminal_state.inner(),
        app,
    )
}

fn do_terminal_open<R: Runtime>(
    terminal_id: String,
    project: Option<String>,
    size: TerminalOpenSizeInput,
    play_spawned: Option<bool>,
    process_role: Option<String>,
    agent_profile_id: Option<String>,
    agent_instance_id: Option<String>,
    agent_provider: Option<String>,
    agent_session_id: Option<String>,
    agent_command: Option<String>,
    terminal_state: &TerminalState,
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
        let pty_size = PtySize {
            rows: size.rows.max(2),
            cols: size.cols.max(2),
            pixel_width: 0,
            pixel_height: 0,
        };
        if debug_enabled {
            log_backend(
                "INFO",
                format!(
                    "terminal_open terminal_id={} cols={} rows={}",
                    terminal_id, pty_size.cols, pty_size.rows
                ),
            );
        }

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(pty_size)
            .map_err(|error| format!("failed to open PTY: {error}"))?;

        let shell = shell_path();
        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(working_dir);
        cmd.arg(login_interactive_flag(&shell));
        cmd.env("TERM", "xterm-256color");
        cmd.env("WEEKEND_PORTLESS_BIN", "portless");
        if let Some(portless_cli) = resolve_bundled_portless_cli_path(&app) {
            cmd.env("WEEKEND_PORTLESS_CLI", portless_cli.display().to_string());
            cmd.env("WEEKEND_PORTLESS_BUNDLED", "1");
        } else {
            cmd.env("WEEKEND_PORTLESS_BUNDLED", "0");
        }
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
        cmd.env("WEEKEND_TERMINAL_ID", &terminal_id);
        if let Some(project_name) = project
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            cmd.env("WEEKEND_PROJECT", project_name);
            {
                let bridge_state: tauri::State<'_, BridgeState> = app.state();
                if let Err(error) =
                    sync_project_bridge_port_file(project_name, bridge_state.inner())
                {
                    log_backend(
                        "WARN",
                        format!(
                            "terminal_open project={project_name}: failed to sync project bridge port file ({error})"
                        ),
                    );
                }
            }
            let project_dir = resolve_project_dir(project_name)?;
            if process_role.as_deref() == Some("agent") {
                if let Some(profile_id) = agent_profile_id.as_deref() {
                    cmd.env("WEEKEND_AGENT_PROFILE_ID", profile_id);
                    cmd.env("WEEKEND_AGENT_ID", profile_id);
                }
                if let Some(instance_id) = agent_instance_id.as_deref() {
                    cmd.env("WEEKEND_AGENT_INSTANCE_ID", instance_id);
                    match write_agent_metadata_file(
                        &project_dir,
                        &terminal_id,
                        project_name,
                        agent_profile_id.as_deref(),
                        instance_id,
                        agent_provider.as_deref(),
                        agent_session_id.as_deref(),
                        agent_command.as_deref(),
                    ) {
                        Ok(path) => {
                            cmd.env("WEEKEND_AGENT_METADATA_FILE", path.display().to_string());
                        }
                        Err(error) => {
                            log_backend(
                                "WARN",
                                format!(
                                    "terminal_open project={project_name}: failed to write agent metadata ({error})"
                                ),
                            );
                        }
                    }
                }
                if let Some(provider) = agent_provider.as_deref() {
                    cmd.env("WEEKEND_AGENT_PROVIDER", provider);
                }
                if let Some(session_id) = agent_session_id.as_deref() {
                    cmd.env("WEEKEND_AGENT_SESSION_ID", session_id);
                }
            }
            let shared_env = match read_shared_env() {
                Ok(env) => env,
                Err(error) => {
                    log_backend(
                        "WARN",
                        format!("terminal_open project={project_name}: failed to read shared env ({error}); shared env not injected"),
                    );
                    HashMap::new()
                }
            };
            for (key, value) in &shared_env {
                cmd.env(key, value);
            }
            match read_project_config(&project_dir) {
                ProjectConfigLookup::Valid(config) => {
                    if let Some(runtime_mode) = config.runtime.mode {
                        cmd.env("WEEKEND_RUNTIME_MODE", runtime_mode);
                    }
                    if let Some(runtime_url) = config.runtime.url {
                        cmd.env("WEEKEND_RUNTIME_URL", runtime_url);
                    }
                    if let Some(deploy_url) = config.runtime.deploy_url {
                        cmd.env("WEEKEND_DEPLOY_URL", deploy_url);
                    }
                    // Inject project-level env vars (overrides shared)
                    for (key, value) in &config.env {
                        cmd.env(key, value);
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
            terminal_id: Mutex::new(terminal_id.clone()),
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
            sessions.insert(terminal_id.clone(), Arc::clone(&session));
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
            agent_profile_id: agent_profile_id.clone(),
            agent_instance_id: agent_instance_id.clone(),
            agent_provider: agent_provider.clone(),
            agent_session_id: agent_session_id.clone(),
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
            Arc::clone(&session),
            Arc::clone(&terminal_state.sessions),
            Arc::clone(&terminal_state.session_info),
            Arc::clone(&terminal_state.output_rings),
        );

        if process_role.as_deref() == Some("agent") {
            if let Some(project_name) = project
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                if let Ok(project_dir) = resolve_project_dir(project_name) {
                    maybe_run_agent_autostart(&project_dir, Arc::clone(&session));
                }
            }
        }

        Ok(())
    })();

    if let Ok(mut opening) = terminal_state.opening_sessions.lock() {
        opening.remove(&terminal_id);
    }

    open_result
}

#[tauri::command]
pub(crate) fn terminal_write(
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
pub(crate) fn terminal_resize(
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
pub(crate) fn terminal_close(
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
pub(crate) fn terminal_list(
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
        .args(["-axo", "pid=,ppid=,pgid=,stat=,tty=,comm="])
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
        let label =
            resolve_terminal_process_name(*shell_pid, &process_by_pid, &child_pids_by_parent);
        labels_by_terminal_id.insert(terminal_id.clone(), label);
    }

    Ok(labels_by_terminal_id)
}

#[tauri::command]
pub(crate) fn terminal_active_processes(
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

pub(crate) fn emit_session_changed<R: Runtime>(app: &AppHandle<R>, info: &TerminalSessionInfo) {
    let _ = app.emit("terminal-session-changed", info.clone());
}

pub(crate) fn emit_session_removed<R: Runtime>(app: &AppHandle<R>, terminal_id: &str) {
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

// -------- bridge_server terminal helpers --------

pub(crate) fn bridge_terminal_spawn<R: Runtime>(
    app: &AppHandle<R>,
    project: Option<String>,
    command: Option<String>,
    display_name: Option<String>,
) -> bridge_types::BridgeResult {
    let terminal_state: &TerminalState = app.state::<TerminalState>().inner();
    let terminal_id = format!("agent-{}", uuid::Uuid::new_v4());
    let size = TerminalOpenSizeInput {
        cols: 120,
        rows: 32,
    };

    let session_arc = match do_terminal_open(
        terminal_id.clone(),
        project.clone(),
        size,
        Some(true),
        Some("agent-spawned".to_string()),
        None,
        None,
        None,
        None,
        None,
        terminal_state,
        app.clone(),
    ) {
        Ok(()) => match terminal_state.sessions.lock() {
            Ok(map) => map.get(&terminal_id).cloned(),
            Err(_) => None,
        },
        Err(error) => {
            return bridge_types::BridgeResult::Error { message: error };
        }
    };

    // Apply display_name override if provided.
    if let Some(name) = display_name
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        if let Ok(mut info_map) = terminal_state.session_info.lock() {
            if let Some(info) = info_map.get_mut(&terminal_id) {
                info.custom_name = Some(name.to_string());
                let updated = info.clone();
                drop(info_map);
                emit_session_changed(app, &updated);
            }
        }
    }

    // If a command was provided, write it to the PTY after a short delay
    // (matches the agent-autostart pattern in maybe_run_agent_autostart).
    if let (Some(session), Some(cmd)) = (session_arc, command) {
        let cmd = cmd.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(500));
            if let Ok(mut writer) = session.writer.lock() {
                let line = format!("{cmd}\r");
                if let Err(error) = writer.write_all(line.as_bytes()) {
                    log_backend(
                        "WARN",
                        format!("bridge terminal_spawn: write failed: {error}"),
                    );
                    return;
                }
                if let Err(error) = writer.flush() {
                    log_backend(
                        "WARN",
                        format!("bridge terminal_spawn: flush failed: {error}"),
                    );
                }
            }
        });
    }

    bridge_types::BridgeResult::Ok {
        data: serde_json::json!({ "terminal_id": terminal_id }),
    }
}

pub(crate) fn bridge_terminal_write<R: Runtime>(
    app: &AppHandle<R>,
    terminal_id: &str,
    input: &str,
) -> bridge_types::BridgeResult {
    let terminal_state: &TerminalState = app.state::<TerminalState>().inner();
    let session = {
        let sessions = match terminal_state.sessions.lock() {
            Ok(g) => g,
            Err(_) => {
                return bridge_types::BridgeResult::Error {
                    message: "failed to lock terminal sessions".to_string(),
                };
            }
        };
        match sessions.get(terminal_id).cloned() {
            Some(s) => s,
            None => {
                return bridge_types::BridgeResult::Error {
                    message: "terminal session not found".to_string(),
                };
            }
        }
    };

    let mut writer = match session.writer.lock() {
        Ok(w) => w,
        Err(_) => {
            return bridge_types::BridgeResult::Error {
                message: "failed to lock terminal writer".to_string(),
            };
        }
    };
    let bytes = input.as_bytes();
    if let Err(error) = writer.write_all(bytes) {
        return bridge_types::BridgeResult::Error {
            message: format!("failed to write to PTY: {error}"),
        };
    }
    if let Err(error) = writer.flush() {
        return bridge_types::BridgeResult::Error {
            message: format!("failed to flush PTY: {error}"),
        };
    }
    bridge_types::BridgeResult::Ok {
        data: serde_json::json!({ "bytes_written": bytes.len() }),
    }
}

pub(crate) fn bridge_terminal_read<R: Runtime>(
    app: &AppHandle<R>,
    terminal_id: &str,
    since_seq: Option<u64>,
) -> bridge_types::BridgeResult {
    let terminal_state: &TerminalState = app.state::<TerminalState>().inner();
    let since = since_seq.unwrap_or(0);
    // Snapshot the ring under its lock, then drop the guard before touching
    // any other terminal-state lock (see lock-ordering rule on TerminalState).
    let ring_snapshot: Option<(Vec<(u64, String)>, u64, u64, bool)> =
        match terminal_state.output_rings.lock() {
            Ok(map) => map.get(terminal_id).map(|ring| {
                let lines: Vec<(u64, String)> = ring
                    .lines
                    .iter()
                    .filter(|(seq, _)| *seq > since)
                    .map(|(seq, line)| (*seq, line.clone()))
                    .collect();
                let highest_emitted = ring.next_seq.saturating_sub(1);
                let next_seq = if highest_emitted > since {
                    highest_emitted
                } else {
                    since
                };
                let truncated = ring.oldest_seq > since.saturating_add(1) && !ring.lines.is_empty();
                (lines, next_seq, ring.oldest_seq, truncated)
            }),
            Err(_) => {
                return bridge_types::BridgeResult::Error {
                    message: "failed to lock output rings".to_string(),
                };
            }
        };

    let Some((lines, next_seq, _oldest_seq, truncated)) = ring_snapshot else {
        // Ring is created lazily on first PTY chunk. If session exists but has
        // produced no output yet, return an empty success so polling clients
        // don't have to special-case a brand-new terminal. (Rings lock has been
        // released above before we touch session_info — required by lock order.)
        let session_exists = terminal_state
            .session_info
            .lock()
            .map(|info| info.contains_key(terminal_id))
            .unwrap_or(false);
        if session_exists {
            return bridge_types::BridgeResult::Ok {
                data: serde_json::json!({
                    "lines": [],
                    "next_seq": since,
                    "truncated": false,
                }),
            };
        }
        return bridge_types::BridgeResult::Error {
            message: "terminal session not found".to_string(),
        };
    };

    let out_lines: Vec<serde_json::Value> = lines
        .into_iter()
        .map(|(seq, line)| serde_json::json!({ "seq": seq, "line": line }))
        .collect();

    bridge_types::BridgeResult::Ok {
        data: serde_json::json!({
            "lines": out_lines,
            "next_seq": next_seq,
            "truncated": truncated,
        }),
    }
}

pub(crate) fn bridge_terminal_list<R: Runtime>(
    app: &AppHandle<R>,
    project: Option<String>,
) -> bridge_types::BridgeResult {
    let terminal_state: &TerminalState = app.state::<TerminalState>().inner();
    let session_info = match terminal_state.session_info.lock() {
        Ok(g) => g,
        Err(_) => {
            return bridge_types::BridgeResult::Error {
                message: "failed to lock session info".to_string(),
            };
        }
    };
    let project_filter = project
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let mut entries: Vec<serde_json::Value> = Vec::new();
    for info in session_info.values() {
        if let Some(filter) = &project_filter {
            if info.project != *filter {
                continue;
            }
        }
        entries.push(serde_json::json!({
            "terminal_id": info.terminal_id,
            "project": info.project,
            "display_name": info.custom_name.clone().unwrap_or_else(|| info.display_name.clone()),
            "status": info.status,
            "has_active_process": info.has_active_process,
            "foreground_process_name": info.foreground_process_name,
            "process_role": info.process_role,
        }));
    }
    bridge_types::BridgeResult::Ok {
        data: serde_json::Value::Array(entries),
    }
}

pub(crate) fn bridge_terminal_kill<R: Runtime>(
    app: &AppHandle<R>,
    terminal_id: &str,
) -> bridge_types::BridgeResult {
    let terminal_state: &TerminalState = app.state::<TerminalState>().inner();

    // Detach + kill PTY child.
    let detached_session = match terminal_state.sessions.lock() {
        Ok(mut g) => g.remove(terminal_id),
        Err(_) => {
            return bridge_types::BridgeResult::Error {
                message: "failed to lock terminal sessions".to_string(),
            };
        }
    };
    if let Some(session) = detached_session.as_ref() {
        if let Ok(mut child) = session.child.lock() {
            if let Err(error) = child.kill() {
                log_backend(
                    "WARN",
                    format!(
                        "bridge terminal_kill terminal_id={terminal_id}: child.kill() failed: {error}"
                    ),
                );
            }
        }
    }

    // Drop the output ring.
    if let Ok(mut rings) = terminal_state.output_rings.lock() {
        rings.remove(terminal_id);
    }

    // Update session_info: mark exited (mirror the reader-thread cleanup behavior).
    {
        if let Ok(mut info_map) = terminal_state.session_info.lock() {
            if let Some(info) = info_map.get_mut(terminal_id) {
                if info.status != "exited" {
                    info.status = "exited".to_string();
                    info.has_active_process = false;
                    info.foreground_process_name = None;
                    let updated = info.clone();
                    drop(info_map);
                    emit_session_changed(app, &updated);
                }
            }
        }
    }

    // Idempotent: report success even if the session was already gone. Agents
    // retrying after a transient error shouldn't see a spurious "not found".
    bridge_types::BridgeResult::Ok {
        data: serde_json::json!({ "killed": true }),
    }
}

#[tauri::command]
pub(crate) fn terminal_get_all_sessions(
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
pub(crate) fn terminal_set_custom_name<R: Runtime>(
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
pub(crate) fn terminal_remove_session<R: Runtime>(
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
pub(crate) fn runtime_debug_dump(
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

pub(crate) fn spawn_terminal_process_watcher<R: Runtime + 'static>(
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
