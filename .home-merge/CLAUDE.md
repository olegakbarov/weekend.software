# Runtime Configuration

Read `./weekend.config.json` before launching any runtime command.
Resolve the runtime endpoint from that file:
- Always use `runtime.url` from `runtime.mode: "portless"`.
Weekend may provide a bundled `portless` runtime during Play for `dev-server` processes.
Do not assume every process is automatically wrapped.
Use backend commands (or browser controls) to update `weekend.config.json`.

# Shared Assets

Shared assets are available at `./shared-assets/`.
Before using any shared asset, ask the user which files from
`./shared-assets/` should be used for this project.
Do not assume every shared asset should be applied automatically.

# Browser Interaction (weekend-browser MCP)

You have access to a live browser pane via the `weekend-browser` MCP server.
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
