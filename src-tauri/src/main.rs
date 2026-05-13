#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod bridge_server;
mod bridge_types;
mod event_buffer;
mod js;
mod logging;
mod webview_ops;

pub(crate) use app::{
    bridge_terminal_kill, bridge_terminal_list, bridge_terminal_read, bridge_terminal_spawn,
    bridge_terminal_write, is_safe_project_name, weekend_root,
};
pub(crate) use logging::log_backend;

fn main() {
    app::run();
}
