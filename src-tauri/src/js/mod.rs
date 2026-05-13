use crate::event_buffer::ObserverConfig;
use serde::Serialize;

pub(crate) fn browser_bridge() -> &'static str {
    include_str!("browser_bridge.js")
}

pub(crate) fn browser_bridge_with_preamble(preamble: &str) -> String {
    format!("{preamble}{}", browser_bridge())
}

pub(crate) fn shared_drop_init() -> &'static str {
    include_str!("shared_drop_init.js")
}

pub(crate) fn reload_shortcut() -> &'static str {
    include_str!("reload_shortcut.js")
}

pub(crate) fn history_back() -> &'static str {
    include_str!("history_back.js")
}

pub(crate) fn history_forward() -> &'static str {
    include_str!("history_forward.js")
}

pub(crate) fn configure_observers(config: &ObserverConfig) -> Result<String, String> {
    replace_json(
        include_str!("bridge_configure.js"),
        "__WEEKEND_CONFIG_JSON__",
        config,
        "observer config",
    )
}

pub(crate) fn configure_element_grab(enabled: bool) -> String {
    include_str!("element_grab_configure.js").replace(
        "__WEEKEND_ELEMENT_GRAB_ENABLED__",
        if enabled { "true" } else { "false" },
    )
}

pub(crate) fn navigate_webview(url: &str) -> Result<String, String> {
    replace_json(
        include_str!("navigate_webview.js"),
        "__WEEKEND_URL_JSON__",
        url,
        "URL",
    )
}

pub(crate) fn eval_with_result(
    user_script: &str,
    request_id: &str,
    callback_token: &str,
) -> Result<String, String> {
    let mut script = replace_json(
        include_str!("eval_with_result.js"),
        "__WEEKEND_REQUEST_ID_JSON__",
        request_id,
        "request id",
    )?;
    script = replace_json(
        &script,
        "__WEEKEND_CALLBACK_TOKEN_JSON__",
        callback_token,
        "callback token",
    )?;
    Ok(script.replace("__WEEKEND_USER_SCRIPT__", user_script))
}

pub(crate) fn theme_bridge_apply<T: Serialize>(state: &T) -> String {
    let apply = replace_json(
        include_str!("theme_bridge_apply.js"),
        "__WEEKEND_THEME_BRIDGE_STATE_JSON__",
        state,
        "theme bridge state",
    )
    .unwrap_or_else(|_| {
        include_str!("theme_bridge_apply.js").replace(
            "__WEEKEND_THEME_BRIDGE_STATE_JSON__",
            r#"{"theme":"fluid","isDark":false,"designSystem":null}"#,
        )
    });

    format!("{}\n{apply}", include_str!("theme_bridge.js"))
}

fn replace_json<T: Serialize>(
    template: &str,
    placeholder: &str,
    value: T,
    label: &str,
) -> Result<String, String> {
    let json = serde_json::to_string(&value)
        .map_err(|error| format!("failed to serialize {label}: {error}"))?;
    Ok(template.replace(placeholder, &json))
}
