use serde_json::{json, Value};

pub fn tool_definitions() -> Vec<Value> {
    vec![
        json!({
            "name": "browser_eval_js",
            "description": "Execute arbitrary JavaScript in the browser webview and return the result. The script runs in an async context so you can use await. Return a value from the script to get it back.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Webview label (from browser_list_webviews). If omitted, uses the first available browser webview."
                    },
                    "script": {
                        "type": "string",
                        "description": "JavaScript code to execute. The last expression value is returned."
                    }
                },
                "required": ["script"]
            }
        }),
        json!({
            "name": "browser_get_dom",
            "description": "Get the outerHTML of the page or a specific element by CSS selector.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Webview label. If omitted, uses the first available browser webview."
                    },
                    "selector": {
                        "type": "string",
                        "description": "CSS selector. If omitted, returns document.documentElement.outerHTML."
                    }
                }
            }
        }),
        json!({
            "name": "browser_get_text",
            "description": "Get the innerText of the page or a specific element by CSS selector.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Webview label. If omitted, uses the first available browser webview."
                    },
                    "selector": {
                        "type": "string",
                        "description": "CSS selector. If omitted, returns document.body.innerText."
                    }
                }
            }
        }),
        json!({
            "name": "browser_click",
            "description": "Click an element identified by CSS selector.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Webview label. If omitted, uses the first available browser webview."
                    },
                    "selector": {
                        "type": "string",
                        "description": "CSS selector of the element to click."
                    }
                },
                "required": ["selector"]
            }
        }),
        json!({
            "name": "browser_type",
            "description": "Type text into an input element identified by CSS selector. Focuses the element, clears it, then sets the value and dispatches input events.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Webview label. If omitted, uses the first available browser webview."
                    },
                    "selector": {
                        "type": "string",
                        "description": "CSS selector of the input element."
                    },
                    "text": {
                        "type": "string",
                        "description": "Text to type into the element."
                    }
                },
                "required": ["selector", "text"]
            }
        }),
        json!({
            "name": "browser_snapshot",
            "description": "Capture a structured snapshot of actionable page elements and assign stable refs for this generation.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Webview label. If omitted, uses the first available browser webview."
                    },
                    "selector": {
                        "type": "string",
                        "description": "Optional CSS selector to scope snapshot candidates. If omitted, a default actionable-element selector is used."
                    },
                    "includeHidden": {
                        "type": "boolean",
                        "description": "Include hidden elements in the snapshot.",
                        "default": false
                    },
                    "maxNodes": {
                        "type": "integer",
                        "description": "Maximum number of nodes to return. Clamped to 20..1000.",
                        "default": 200,
                        "minimum": 20,
                        "maximum": 1000
                    }
                }
            }
        }),
        json!({
            "name": "browser_click_ref",
            "description": "Click an element by `data-weekend-ref` from the latest browser_snapshot generation.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Webview label. If omitted, uses the first available browser webview."
                    },
                    "ref": {
                        "type": "string",
                        "description": "Element ref from browser_snapshot."
                    }
                },
                "required": ["ref"]
            }
        }),
        json!({
            "name": "browser_type_ref",
            "description": "Type text into an element by `data-weekend-ref` from browser_snapshot.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Webview label. If omitted, uses the first available browser webview."
                    },
                    "ref": {
                        "type": "string",
                        "description": "Element ref from browser_snapshot."
                    },
                    "text": {
                        "type": "string",
                        "description": "Text to type."
                    },
                    "clear": {
                        "type": "boolean",
                        "description": "Whether to clear existing content before typing.",
                        "default": true
                    }
                },
                "required": ["ref", "text"]
            }
        }),
        json!({
            "name": "browser_wait_for",
            "description": "Wait for ref/text/url conditions with polling and return structured status instead of throwing on timeout.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Webview label. If omitted, uses the first available browser webview."
                    },
                    "ref": {
                        "type": "string",
                        "description": "Optional element ref from browser_snapshot."
                    },
                    "text": {
                        "type": "string",
                        "description": "Optional text that must appear in the page."
                    },
                    "urlIncludes": {
                        "type": "string",
                        "description": "Optional substring that must appear in the current URL."
                    },
                    "visible": {
                        "type": "boolean",
                        "description": "Optional expected visibility state for `ref`."
                    },
                    "timeoutMs": {
                        "type": "integer",
                        "description": "Timeout in milliseconds. Clamped to 100..30000.",
                        "default": 10000,
                        "minimum": 100,
                        "maximum": 30000
                    },
                    "pollMs": {
                        "type": "integer",
                        "description": "Polling interval in milliseconds. Clamped to 50..1000.",
                        "default": 100,
                        "minimum": 50,
                        "maximum": 1000
                    }
                }
            }
        }),
        json!({
            "name": "browser_scroll",
            "description": "Scroll the page or a specific element.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Webview label. If omitted, uses the first available browser webview."
                    },
                    "selector": {
                        "type": "string",
                        "description": "CSS selector of the element to scroll. If omitted, scrolls the window."
                    },
                    "x": {
                        "type": "number",
                        "description": "Horizontal scroll amount in pixels."
                    },
                    "y": {
                        "type": "number",
                        "description": "Vertical scroll amount in pixels."
                    }
                }
            }
        }),
        json!({
            "name": "browser_navigate",
            "description": "Navigate the browser webview to a URL.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Webview label. If omitted, uses the first available browser webview."
                    },
                    "url": {
                        "type": "string",
                        "description": "The URL to navigate to."
                    }
                },
                "required": ["url"]
            }
        }),
        json!({
            "name": "browser_get_url",
            "description": "Get the current URL of the browser webview.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Webview label. If omitted, uses the first available browser webview."
                    }
                }
            }
        }),
        json!({
            "name": "browser_list_webviews",
            "description": "List all available browser webview labels. Use these labels to target specific webviews in other browser tools.",
            "inputSchema": {
                "type": "object",
                "properties": {}
            }
        }),
        json!({
            "name": "browser_observe",
            "description": "Configure which event observers are active in the browser webview. Observers push events to a backend buffer that you can drain with browser_drain_events. Available categories: console, errors, navigation, clicks, inputs, dom_mutations, network, custom. All are off by default.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Webview label. If omitted, uses the first available browser webview."
                    },
                    "console": { "type": "boolean", "description": "Observe console.log/warn/error/info/debug calls." },
                    "errors": { "type": "boolean", "description": "Observe uncaught errors and unhandled promise rejections." },
                    "navigation": { "type": "boolean", "description": "Observe URL changes (pushState, replaceState, popstate)." },
                    "clicks": { "type": "boolean", "description": "Observe click events on the page." },
                    "inputs": { "type": "boolean", "description": "Observe input/change events on form elements." },
                    "dom_mutations": { "type": "boolean", "description": "Observe DOM mutations (childList, attributes, characterData)." },
                    "network": { "type": "boolean", "description": "Observe XHR and fetch network requests." },
                    "custom": { "type": "boolean", "description": "Enable custom events via window.__WEEKEND_BRIDGE__.emit()." }
                }
            }
        }),
        json!({
            "name": "browser_drain_events",
            "description": "Drain buffered events from the browser webview. Returns all events since the given sequence number. Use sinceSeq=0 to get all buffered events. Each event has a seq number you can use for incremental polling.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Webview label. If omitted, uses the first available browser webview."
                    },
                    "sinceSeq": {
                        "type": "number",
                        "description": "Return events with seq > sinceSeq. Default 0 (all events)."
                    }
                }
            }
        }),
    ]
}

/// Convert an MCP tool call into a bridge request JSON string.
/// Returns the bridge request envelope JSON.
pub fn tool_call_to_bridge_request(
    call_id: &str,
    tool_name: &str,
    arguments: &Value,
) -> Result<String, String> {
    let label = arguments
        .get("label")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|label| !label.is_empty())
        .unwrap_or("");

    let request = match tool_name {
        "browser_list_webviews" => {
            json!({
                "id": call_id,
                "request": { "type": "list_webviews" }
            })
        }
        "browser_eval_js" => {
            let script = arguments
                .get("script")
                .and_then(|v| v.as_str())
                .ok_or("missing required parameter: script")?;
            json!({
                "id": call_id,
                "request": { "type": "eval_js", "label": label, "script": script }
            })
        }
        "browser_get_dom" => {
            let selector = arguments
                .get("selector")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let script = if selector.is_empty() {
                "return document.documentElement.outerHTML".to_string()
            } else {
                format!(
                    "const el = document.querySelector({sel}); if (!el) throw new Error('Element not found: ' + {sel}); return el.outerHTML",
                    sel = serde_json::to_string(selector).unwrap_or_else(|_| format!("\"{}\"", selector))
                )
            };
            json!({
                "id": call_id,
                "request": { "type": "eval_js", "label": label, "script": script }
            })
        }
        "browser_get_text" => {
            let selector = arguments
                .get("selector")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let script = if selector.is_empty() {
                "return document.body.innerText".to_string()
            } else {
                format!(
                    "const el = document.querySelector({sel}); if (!el) throw new Error('Element not found: ' + {sel}); return el.innerText",
                    sel = serde_json::to_string(selector).unwrap_or_else(|_| format!("\"{}\"", selector))
                )
            };
            json!({
                "id": call_id,
                "request": { "type": "eval_js", "label": label, "script": script }
            })
        }
        "browser_click" => {
            let selector = arguments
                .get("selector")
                .and_then(|v| v.as_str())
                .ok_or("missing required parameter: selector")?;
            let script = format!(
                "const el = document.querySelector({sel}); if (!el) throw new Error('Element not found: ' + {sel}); el.click(); return true",
                sel = serde_json::to_string(selector).unwrap_or_else(|_| format!("\"{}\"", selector))
            );
            json!({
                "id": call_id,
                "request": { "type": "eval_js", "label": label, "script": script }
            })
        }
        "browser_type" => {
            let selector = arguments
                .get("selector")
                .and_then(|v| v.as_str())
                .ok_or("missing required parameter: selector")?;
            let text = arguments
                .get("text")
                .and_then(|v| v.as_str())
                .ok_or("missing required parameter: text")?;
            let script = format!(
                "const el = document.querySelector({sel}); if (!el) throw new Error('Element not found: ' + {sel}); el.focus(); el.value = {val}; el.dispatchEvent(new Event('input', {{ bubbles: true }})); el.dispatchEvent(new Event('change', {{ bubbles: true }})); return true",
                sel = serde_json::to_string(selector).unwrap_or_else(|_| format!("\"{}\"", selector)),
                val = serde_json::to_string(text).unwrap_or_else(|_| format!("\"{}\"", text))
            );
            json!({
                "id": call_id,
                "request": { "type": "eval_js", "label": label, "script": script }
            })
        }
        "browser_snapshot" => {
            let selector = arguments
                .get("selector")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|selector| !selector.is_empty());
            let include_hidden = arguments
                .get("includeHidden")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let max_nodes = arguments
                .get("maxNodes")
                .and_then(|v| v.as_i64())
                .unwrap_or(200)
                .clamp(20, 1000);
            let selector_js = selector
                .map(|v| serde_json::to_string(v).unwrap_or_else(|_| format!("\"{}\"", v)))
                .unwrap_or_else(|| "null".to_string());
            let script = format!(
                r#"
const selector = {selector};
const includeHidden = {include_hidden};
const maxNodes = {max_nodes};
const normalize = (value) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
const truncate = (value, maxLen = 400) => {{
  if (typeof value !== 'string') return '';
  return value.length > maxLen ? value.slice(0, maxLen) : value;
}};
const isVisible = (el) => {{
  if (!(el instanceof Element)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}};
const isEnabled = (el) => {{
  if (!(el instanceof Element)) return false;
  if (el.matches(':disabled')) return false;
  const ariaDisabled = normalize(el.getAttribute('aria-disabled') || '').toLowerCase();
  if (ariaDisabled === 'true') return false;
  const style = window.getComputedStyle(el);
  if (style.pointerEvents === 'none') return false;
  return true;
}};
const inferRole = (el) => {{
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'a' && el.hasAttribute('href')) return 'link';
  if (tag === 'button') return 'button';
  if (tag === 'input') {{
    const type = normalize(el.getAttribute('type') || 'text').toLowerCase();
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (type === 'button' || type === 'submit' || type === 'reset') return 'button';
    return 'textbox';
  }}
  if (tag === 'textarea') return 'textbox';
  if (tag === 'select') return 'combobox';
  if (el instanceof HTMLElement && el.isContentEditable) return 'textbox';
  return '';
}};
const getName = (el) => {{
  const ariaLabel = normalize(el.getAttribute('aria-label') || '');
  if (ariaLabel) return ariaLabel;
  const labelledBy = normalize(el.getAttribute('aria-labelledby') || '');
  if (labelledBy) {{
    const labelText = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((node) => normalize(node.textContent || ''))
      .filter(Boolean)
      .join(' ');
    if (labelText) return labelText;
  }}
  const alt = normalize(el.getAttribute('alt') || '');
  if (alt) return alt;
  const title = normalize(el.getAttribute('title') || '');
  if (title) return title;
  const placeholder = normalize(el.getAttribute('placeholder') || '');
  if (placeholder) return placeholder;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {{
    const value = normalize(String(el.value || ''));
    if (value) return value;
  }}
  return normalize(el.innerText || el.textContent || '');
}};
let candidates = [];
if (selector) {{
  try {{
    candidates = Array.from(document.querySelectorAll(selector));
  }} catch (err) {{
    throw new Error('Invalid selector for browser_snapshot: ' + selector);
  }}
}} else {{
  const actionableSelector = 'a,button,input,textarea,select,summary,[role=\"button\"],[role=\"link\"],[role=\"textbox\"],[role=\"checkbox\"],[role=\"radio\"],[role=\"switch\"],[role=\"menuitem\"],[contenteditable=\"\"],[contenteditable=\"true\"],[tabindex]';
  candidates = Array.from(document.querySelectorAll(actionableSelector));
}}
const generatedAt = new Date().toISOString();
const generation = 'g-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
const previousState = window.__weekendSnapshotState || {{}};
window.__weekendSnapshotState = {{
  ...previousState,
  generation,
  generatedAt
}};
const nodes = [];
let index = 0;
for (const el of candidates) {{
  if (!(el instanceof Element)) continue;
  const visible = isVisible(el);
  if (!includeHidden && !visible) continue;
  if (index >= maxNodes) break;
  index += 1;
  const ref = generation + ':' + index;
  el.setAttribute('data-weekend-ref', ref);
  const tag = (el.tagName || '').toLowerCase();
  const role = normalize(el.getAttribute('role') || '') || inferRole(el);
  let value = '';
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {{
    value = normalize(String(el.value || ''));
  }} else if (el instanceof HTMLElement && el.isContentEditable) {{
    value = normalize(el.textContent || '');
  }}
  const placeholder = normalize(el.getAttribute('placeholder') || '');
  const href = el instanceof HTMLAnchorElement ? normalize(el.href || el.getAttribute('href') || '') : normalize(el.getAttribute('href') || '');
  nodes.push({{
    ref,
    tag,
    role,
    name: truncate(getName(el)),
    text: truncate(normalize(el.innerText || el.textContent || '')),
    value: truncate(value),
    placeholder: truncate(placeholder),
    href: truncate(href),
    visible,
    enabled: isEnabled(el)
  }});
}}
return {{
  url: window.location.href,
  title: document.title || '',
  count: nodes.length,
  generatedAt,
  nodes
}};
"#,
                selector = selector_js,
                include_hidden = include_hidden,
                max_nodes = max_nodes,
            );
            json!({
                "id": call_id,
                "request": { "type": "eval_js", "label": label, "script": script }
            })
        }
        "browser_click_ref" => {
            let reference = arguments
                .get("ref")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|reference| !reference.is_empty())
                .ok_or("missing required parameter: ref")?;
            let reference =
                serde_json::to_string(reference).unwrap_or_else(|_| format!("\"{}\"", reference));
            let script = format!(
                r#"
const ref = {reference};
const el = Array.from(document.querySelectorAll('[data-weekend-ref]'))
  .find((node) => node.getAttribute('data-weekend-ref') === ref);
if (!el) {{
  throw new Error('Element ref not found: ' + ref + '. Run browser_snapshot to refresh refs.');
}}
const ariaDisabled = ((el.getAttribute('aria-disabled') || '').trim().toLowerCase() === 'true');
const disabled = (el.matches(':disabled') || el.hasAttribute('disabled') || ariaDisabled);
if (disabled) {{
  throw new Error('Element is disabled for ref: ' + ref);
}}
const style = window.getComputedStyle(el);
if (style.pointerEvents === 'none') {{
  throw new Error('Element is not interactable for ref: ' + ref);
}}
el.scrollIntoView({{ block: 'center', inline: 'center' }});
if (typeof el.click !== 'function') {{
  throw new Error('Element is not clickable for ref: ' + ref);
}}
el.click();
return {{ ok: true, ref }};
"#,
                reference = reference
            );
            json!({
                "id": call_id,
                "request": { "type": "eval_js", "label": label, "script": script }
            })
        }
        "browser_type_ref" => {
            let reference = arguments
                .get("ref")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|reference| !reference.is_empty())
                .ok_or("missing required parameter: ref")?;
            let text = arguments
                .get("text")
                .and_then(|v| v.as_str())
                .ok_or("missing required parameter: text")?;
            let clear = arguments
                .get("clear")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);
            let reference =
                serde_json::to_string(reference).unwrap_or_else(|_| format!("\"{}\"", reference));
            let text = serde_json::to_string(text).unwrap_or_else(|_| format!("\"{}\"", text));
            let script = format!(
                r#"
const ref = {reference};
const text = {text};
const clear = {clear};
const el = Array.from(document.querySelectorAll('[data-weekend-ref]'))
  .find((node) => node.getAttribute('data-weekend-ref') === ref);
if (!el) {{
  throw new Error('Element ref not found: ' + ref + '. Run browser_snapshot to refresh refs.');
}}
const dispatchInputEvents = (target) => {{
  target.dispatchEvent(new Event('input', {{ bubbles: true }}));
  target.dispatchEvent(new Event('change', {{ bubbles: true }}));
}};
const ariaDisabled = ((el.getAttribute('aria-disabled') || '').trim().toLowerCase() === 'true');
if (el.matches(':disabled') || el.hasAttribute('disabled') || ariaDisabled) {{
  throw new Error('Element is disabled for ref: ' + ref);
}}
if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {{
  const unsupported = new Set(['checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'image', 'range', 'color', 'hidden']);
  const inputType = (el.type || '').toLowerCase();
  if (el instanceof HTMLInputElement && unsupported.has(inputType)) {{
    throw new Error('Unsupported input type for browser_type_ref: ' + inputType);
  }}
  el.focus();
  const startValue = clear ? '' : String(el.value || '');
  el.value = startValue + text;
  dispatchInputEvents(el);
  return {{ ok: true, ref, value: String(el.value || '') }};
}}
if (el instanceof HTMLSelectElement) {{
  const normalizedText = String(text).trim();
  const option = Array.from(el.options).find((opt) => opt.value === text)
    || Array.from(el.options).find((opt) => (opt.textContent || '').trim() === normalizedText);
  if (!option) {{
    throw new Error('No select option matches text/value for ref: ' + ref);
  }}
  el.value = option.value;
  dispatchInputEvents(el);
  return {{ ok: true, ref, value: String(el.value || '') }};
}}
if (el instanceof HTMLElement && el.isContentEditable) {{
  el.focus();
  const existing = clear ? '' : String(el.textContent || '');
  el.textContent = existing + text;
  dispatchInputEvents(el);
  return {{ ok: true, ref, value: String(el.textContent || '') }};
}}
throw new Error('Unsupported element for browser_type_ref. Supported: input, textarea, select, contenteditable.');
"#,
                reference = reference,
                text = text,
                clear = clear,
            );
            json!({
                "id": call_id,
                "request": { "type": "eval_js", "label": label, "script": script }
            })
        }
        "browser_wait_for" => {
            let reference = arguments
                .get("ref")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|reference| !reference.is_empty());
            let text = arguments
                .get("text")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|text| !text.is_empty());
            let url_includes = arguments
                .get("urlIncludes")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|url_includes| !url_includes.is_empty());
            let visible = arguments.get("visible").and_then(|v| v.as_bool());
            let timeout_ms = arguments
                .get("timeoutMs")
                .and_then(|v| v.as_i64())
                .unwrap_or(10000)
                .clamp(100, 30000);
            let poll_ms = arguments
                .get("pollMs")
                .and_then(|v| v.as_i64())
                .unwrap_or(100)
                .clamp(50, 1000);
            let reference = reference
                .map(|v| serde_json::to_string(v).unwrap_or_else(|_| format!("\"{}\"", v)))
                .unwrap_or_else(|| "null".to_string());
            let text = text
                .map(|v| serde_json::to_string(v).unwrap_or_else(|_| format!("\"{}\"", v)))
                .unwrap_or_else(|| "null".to_string());
            let url_includes = url_includes
                .map(|v| serde_json::to_string(v).unwrap_or_else(|_| format!("\"{}\"", v)))
                .unwrap_or_else(|| "null".to_string());
            let visible = visible
                .map(|v| v.to_string())
                .unwrap_or_else(|| "null".to_string());
            let script = format!(
                r#"
const targetRef = {reference};
const targetText = {text};
const targetUrlIncludes = {url_includes};
const expectedVisible = {visible};
const timeoutMs = {timeout_ms};
const pollMs = {poll_ms};
const normalize = (value) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
const isVisible = (el) => {{
  if (!(el instanceof Element)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}};
const findByRef = () => {{
  if (!targetRef) return null;
  return Array.from(document.querySelectorAll('[data-weekend-ref]'))
    .find((node) => node.getAttribute('data-weekend-ref') === targetRef) || null;
}};
const started = Date.now();
const deadline = started + timeoutMs;
let details = {{
  ref: targetRef,
  refFound: targetRef ? false : true,
  text: targetText,
  textFound: targetText ? false : true,
  urlIncludes: targetUrlIncludes,
  urlMatched: targetUrlIncludes ? false : true,
  visible: expectedVisible,
  currentVisible: null
}};
while (Date.now() <= deadline) {{
  const currentUrl = window.location.href;
  const refEl = findByRef();
  const refFound = targetRef ? Boolean(refEl) : true;
  const bodyText = normalize(document.body ? (document.body.innerText || '') : '');
  const textFound = targetText ? bodyText.toLowerCase().includes(String(targetText).toLowerCase()) : true;
  const urlMatched = targetUrlIncludes ? currentUrl.includes(targetUrlIncludes) : true;
  let currentVisible = null;
  let visibilityMatched = true;
  if (expectedVisible !== null && targetRef) {{
    currentVisible = refEl ? isVisible(refEl) : false;
    visibilityMatched = refFound && currentVisible === expectedVisible;
  }}
  details = {{
    ref: targetRef,
    refFound,
    text: targetText,
    textFound,
    urlIncludes: targetUrlIncludes,
    urlMatched,
    visible: expectedVisible,
    currentVisible
  }};
  if (refFound && textFound && urlMatched && visibilityMatched) {{
    return {{
      ok: true,
      elapsedMs: Date.now() - started,
      url: currentUrl,
      details
    }};
  }}
  await new Promise((resolve) => setTimeout(resolve, pollMs));
}}
return {{
  ok: false,
  elapsedMs: Date.now() - started,
  url: window.location.href,
  details
}};
"#,
                reference = reference,
                text = text,
                url_includes = url_includes,
                visible = visible,
                timeout_ms = timeout_ms,
                poll_ms = poll_ms,
            );
            json!({
                "id": call_id,
                "request": { "type": "eval_js", "label": label, "script": script }
            })
        }
        "browser_scroll" => {
            let selector = arguments
                .get("selector")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let x = arguments.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let y = arguments.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let script = if selector.is_empty() {
                format!("window.scrollBy({x}, {y}); return true")
            } else {
                format!(
                    "const el = document.querySelector({sel}); if (!el) throw new Error('Element not found: ' + {sel}); el.scrollBy({x}, {y}); return true",
                    sel = serde_json::to_string(selector).unwrap_or_else(|_| format!("\"{}\"", selector))
                )
            };
            json!({
                "id": call_id,
                "request": { "type": "eval_js", "label": label, "script": script }
            })
        }
        "browser_navigate" => {
            let url = arguments
                .get("url")
                .and_then(|v| v.as_str())
                .ok_or("missing required parameter: url")?;
            let url = url.trim();
            if url.is_empty() {
                return Err("parameter 'url' must be a non-empty string".to_string());
            }
            json!({
                "id": call_id,
                "request": { "type": "navigate", "label": label, "url": url }
            })
        }
        "browser_get_url" => {
            json!({
                "id": call_id,
                "request": { "type": "get_url", "label": label }
            })
        }
        "browser_observe" => {
            let config = json!({
                "console": arguments.get("console").and_then(|v| v.as_bool()).unwrap_or(false),
                "errors": arguments.get("errors").and_then(|v| v.as_bool()).unwrap_or(false),
                "navigation": arguments.get("navigation").and_then(|v| v.as_bool()).unwrap_or(false),
                "clicks": arguments.get("clicks").and_then(|v| v.as_bool()).unwrap_or(false),
                "inputs": arguments.get("inputs").and_then(|v| v.as_bool()).unwrap_or(false),
                "dom_mutations": arguments.get("dom_mutations").and_then(|v| v.as_bool()).unwrap_or(false),
                "network": arguments.get("network").and_then(|v| v.as_bool()).unwrap_or(false),
                "custom": arguments.get("custom").and_then(|v| v.as_bool()).unwrap_or(false),
            });
            json!({
                "id": call_id,
                "request": { "type": "configure_observers", "label": label, "config": config }
            })
        }
        "browser_drain_events" => {
            let since_seq = arguments
                .get("sinceSeq")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            json!({
                "id": call_id,
                "request": { "type": "drain_events", "label": label, "since_seq": since_seq }
            })
        }
        _ => return Err(format!("unknown tool: {tool_name}")),
    };

    serde_json::to_string(&request).map_err(|e| format!("failed to serialize request: {e}"))
}
