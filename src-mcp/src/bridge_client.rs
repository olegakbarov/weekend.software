use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

pub struct BridgeClient {
    reader: BufReader<TcpStream>,
    writer: TcpStream,
}

struct BridgeConnectionInfo {
    port: u16,
    token: Option<String>,
}

impl BridgeClient {
    pub fn connect() -> Result<Self, String> {
        let connection = read_port_file()?;
        let addr = format!("127.0.0.1:{}", connection.port);
        let mut stream = TcpStream::connect(&addr)
            .map_err(|e| format!("failed to connect to bridge at {addr}: {e}"))?;
        if let Some(token) = connection.token.as_deref() {
            verify_bridge_identity(&mut stream, token)?;
        }
        let reader = BufReader::new(
            stream
                .try_clone()
                .map_err(|e| format!("failed to clone TCP stream: {e}"))?,
        );
        Ok(Self {
            reader,
            writer: stream,
        })
    }

    pub fn send_request(&mut self, request_json: &str) -> Result<String, String> {
        let mut line = request_json.to_string();
        if !line.ends_with('\n') {
            line.push('\n');
        }
        self.writer
            .write_all(line.as_bytes())
            .map_err(|e| format!("failed to write to bridge: {e}"))?;
        self.writer
            .flush()
            .map_err(|e| format!("failed to flush bridge: {e}"))?;

        let mut response = String::new();
        self.reader
            .read_line(&mut response)
            .map_err(|e| format!("failed to read from bridge: {e}"))?;

        Ok(response.trim_end().to_string())
    }
}

fn port_file_path() -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("WEEKEND_BRIDGE_PORT_FILE") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }

    if let Some(project_name) = project_name_from_context() {
        let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
        let path = project_bridge_port_file_path(Path::new(&home), &project_name)?;
        if path.is_file() {
            return Ok(path);
        }
        return Err(format!(
            "failed to find project bridge file {}. Open project '{project_name}' in Weekend so it can publish its bridge info, or launch the MCP server from a Weekend terminal.",
            path.display()
        ));
    }

    let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
    Ok(global_bridge_port_file_path(Path::new(&home)))
}

fn read_port_file() -> Result<BridgeConnectionInfo, String> {
    let path = port_file_path()?;
    let content = std::fs::read_to_string(&path).map_err(|e| {
        format!(
            "failed to read {}: {e}. Is weekend running?",
            path.display()
        )
    })?;
    let mut parsed = parse_port_file_contents(&content)?;
    if let Ok(token) = std::env::var("WEEKEND_BRIDGE_TOKEN") {
        let trimmed = token.trim();
        if !trimmed.is_empty() {
            parsed.token = Some(trimmed.to_string());
        }
    }
    Ok(parsed)
}

fn global_bridge_port_file_path(home: &Path) -> PathBuf {
    home.join(".weekend").join("bridge.port")
}

fn project_bridge_port_file_path(home: &Path, project_name: &str) -> Result<PathBuf, String> {
    let normalized = normalize_project_name(project_name)
        .ok_or_else(|| "invalid WEEKEND_PROJECT value".to_string())?;
    Ok(home
        .join(".weekend")
        .join("bridge-projects")
        .join(format!("{normalized}.port")))
}

fn normalize_project_name(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.contains('/') || trimmed.contains('\\') {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn project_name_from_context() -> Option<String> {
    if let Ok(value) = std::env::var("WEEKEND_PROJECT") {
        if let Some(project_name) = normalize_project_name(&value) {
            return Some(project_name);
        }
    }

    let cwd = std::env::current_dir().ok()?;
    project_name_from_path(&cwd)
}

fn project_name_from_path(path: &Path) -> Option<String> {
    for candidate in path.ancestors() {
        let has_project_marker = candidate.join(".mcp.json").is_file()
            || candidate.join("weekend.config.json").is_file()
            || candidate.join("aios.config.json").is_file();
        if !has_project_marker {
            continue;
        }
        let project_name = candidate.file_name()?.to_str()?;
        if let Some(normalized) = normalize_project_name(project_name) {
            return Some(normalized);
        }
    }
    None
}

fn parse_port_file_contents(content: &str) -> Result<BridgeConnectionInfo, String> {
    let mut lines = content.lines();
    let port: u16 = lines
        .next()
        .ok_or_else(|| "bridge.port file is empty".to_string())?
        .trim()
        .parse()
        .map_err(|e| format!("invalid TCP port in bridge.port: {e}"))?;
    let token = lines
        .next()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned);
    Ok(BridgeConnectionInfo { port, token })
}

fn verify_bridge_identity(stream: &mut TcpStream, token: &str) -> Result<(), String> {
    let handshake_request = json!({
        "id": "bridge-handshake",
        "request": {
            "type": "hello",
            "token": token
        }
    });
    let mut line = serde_json::to_string(&handshake_request)
        .map_err(|e| format!("failed to serialize bridge handshake: {e}"))?;
    line.push('\n');
    stream
        .write_all(line.as_bytes())
        .map_err(|e| format!("failed to write bridge handshake: {e}"))?;
    stream
        .flush()
        .map_err(|e| format!("failed to flush bridge handshake: {e}"))?;

    let cloned = stream
        .try_clone()
        .map_err(|e| format!("failed to clone stream for bridge handshake: {e}"))?;
    let mut reader = BufReader::new(cloned);
    let mut response = String::new();
    reader
        .read_line(&mut response)
        .map_err(|e| format!("failed to read bridge handshake response: {e}"))?;
    if response.trim().is_empty() {
        return Err("empty bridge handshake response".to_string());
    }

    let parsed: Value = serde_json::from_str(response.trim_end())
        .map_err(|e| format!("invalid bridge handshake response: {e}"))?;
    if parsed.get("status").and_then(|v| v.as_str()) == Some("ok") {
        return Ok(());
    }

    let message = parsed
        .get("message")
        .and_then(|v| v.as_str())
        .unwrap_or("bridge handshake failed");
    Err(message.to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        global_bridge_port_file_path, parse_port_file_contents, port_file_path,
        project_bridge_port_file_path, project_name_from_path,
    };
    use std::fs;
    use std::path::Path;
    use std::sync::{Mutex, OnceLock};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    struct EnvGuard {
        home: Option<String>,
        weekend_project: Option<String>,
        weekend_bridge_port_file: Option<String>,
        cwd: std::path::PathBuf,
    }

    impl EnvGuard {
        fn new() -> Self {
            Self {
                home: std::env::var("HOME").ok(),
                weekend_project: std::env::var("WEEKEND_PROJECT").ok(),
                weekend_bridge_port_file: std::env::var("WEEKEND_BRIDGE_PORT_FILE").ok(),
                cwd: std::env::current_dir().expect("current dir"),
            }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            match &self.home {
                Some(value) => std::env::set_var("HOME", value),
                None => std::env::remove_var("HOME"),
            }
            match &self.weekend_project {
                Some(value) => std::env::set_var("WEEKEND_PROJECT", value),
                None => std::env::remove_var("WEEKEND_PROJECT"),
            }
            match &self.weekend_bridge_port_file {
                Some(value) => std::env::set_var("WEEKEND_BRIDGE_PORT_FILE", value),
                None => std::env::remove_var("WEEKEND_BRIDGE_PORT_FILE"),
            }
            let _ = std::env::set_current_dir(&self.cwd);
        }
    }

    fn make_temp_dir(label: &str) -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("weekend-bridge-client-{label}-{unique}"));
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }

    #[test]
    fn parses_legacy_bridge_port_file() {
        let parsed = parse_port_file_contents("19430\n").expect("expected parsed bridge file");
        assert_eq!(parsed.port, 19430);
        assert!(parsed.token.is_none());
    }

    #[test]
    fn parses_bridge_port_file_with_token() {
        let parsed = parse_port_file_contents(
            "19430\na1b2c3-token\n/Users/example/.weekend/bridge.a1b2c3-token.port\n",
        )
        .expect("expected parsed bridge file");
        assert_eq!(parsed.port, 19430);
        assert_eq!(parsed.token.as_deref(), Some("a1b2c3-token"));
    }

    #[test]
    fn computes_project_bridge_port_file_path() {
        let home = Path::new("/Users/example");
        let path = project_bridge_port_file_path(home, "music").expect("project path");
        assert_eq!(
            path,
            Path::new("/Users/example/.weekend/bridge-projects/music.port")
        );
        assert_eq!(
            global_bridge_port_file_path(home),
            Path::new("/Users/example/.weekend/bridge.port")
        );
    }

    #[test]
    fn resolves_project_name_from_project_root_ancestors() {
        let root = make_temp_dir("project-root");
        let project_root = root.join("music");
        let nested = project_root.join("src/components");
        fs::create_dir_all(&nested).expect("nested dir");
        fs::write(project_root.join(".mcp.json"), "{}\n").expect("mcp json");

        let project_name = project_name_from_path(&nested).expect("project name");
        let _ = fs::remove_dir_all(&root);

        assert_eq!(project_name, "music");
    }

    #[test]
    fn prefers_project_bridge_file_when_weekend_project_is_set() {
        let _guard = env_lock().lock().expect("env lock");
        let snapshot = EnvGuard::new();
        let home = make_temp_dir("home");
        let bridge_dir = home.join(".weekend/bridge-projects");
        fs::create_dir_all(&bridge_dir).expect("bridge dir");
        let expected = bridge_dir.join("music.port");
        fs::write(&expected, "19430\nproject-token\n").expect("bridge file");

        std::env::set_var("HOME", &home);
        std::env::set_var("WEEKEND_PROJECT", "music");
        std::env::remove_var("WEEKEND_BRIDGE_PORT_FILE");

        let resolved = port_file_path().expect("resolved path");
        drop(snapshot);
        let _ = fs::remove_dir_all(&home);

        assert_eq!(resolved, expected);
    }
}
