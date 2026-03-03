mod bridge_client;
mod mcp_protocol;
mod tools;

fn main() {
    if let Err(error) = mcp_protocol::run_stdio_server() {
        eprintln!("weekend-browser-mcp: {error}");
        std::process::exit(1);
    }
}
