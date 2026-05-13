# Weekend MCP

Load when: testing the running app, verifying UI changes, debugging
rendered output, filling forms, or anything you would otherwise do with
a headless browser, curl, or wget against the project's dev server.

You have a live browser pane attached to this project via the
`weekend` MCP server. It is the same pane the user sees. The
project is auto-selected via `WEEKEND_PROJECT` — you do not need to
pass a `label` to any tool.

Always prefer these tools over spawning Puppeteer/Playwright or shelling
out to `curl`/`wget`. The pane is already loaded, already authenticated
into whatever local state exists, and already pointed at the right
portless URL.

## Browser Tools

| Tool                  | Purpose                                                    |
| --------------------- | ---------------------------------------------------------- |
| `browser_snapshot`    | Accessibility snapshot with stable `ref` ids for elements. |
| `browser_click_ref`   | Click an element by snapshot `ref`.                        |
| `browser_type_ref`    | Type into an input by snapshot `ref`.                      |
| `browser_wait_for`    | Wait for text, URL, or a duration between actions.         |
| `browser_eval_js`     | Run JS in the page (async); `return <expr>` for a value.   |
| `browser_get_text`    | `innerText` of the page or a CSS selector.                 |
| `browser_get_dom`     | `outerHTML` of the page or a CSS selector.                 |
| `browser_click`       | Click by CSS selector (fallback when no snapshot).         |
| `browser_type`        | Type by CSS selector.                                      |
| `browser_scroll`      | Scroll the page or an element.                             |
| `browser_navigate`    | Navigate to a URL.                                         |
| `browser_get_url`     | Current URL.                                               |
| `browser_list_webviews` | List all open browser panes (rarely needed).             |

## Terminal Tools

The same `weekend` MCP server also exposes `weekend_terminal_*` tools for
spawning, reading, writing to, listing, and killing Weekend terminal sessions.
Use them when you need to drive a project terminal through Weekend instead of
starting a detached shell outside the workspace.

## The snapshot → ref workflow

Refs from `browser_snapshot` are the most reliable way to act on
elements. CSS selectors break when class names change; refs survive
re-renders within the same snapshot.

1. `browser_snapshot` — read the structure, locate the target.
2. `browser_click_ref` / `browser_type_ref` using the ref.
3. After navigation or significant DOM change, re-snapshot before the
   next ref-based action. Stale refs do not auto-update.
4. Use `browser_wait_for` between steps in flows that depend on async
   render (e.g., wait for "Saved" text before continuing).

## When each tool fits

- **Verifying a code change**: `browser_get_text` for a quick textual
  check, or `browser_snapshot` if the layout matters.
- **Reading errors**: `browser_eval_js` with
  `return [...document.querySelectorAll('[role=alert]')].map(n => n.innerText)`
  or check the console via `browser_eval_js`.
- **Filling a form**: snapshot → `browser_type_ref` for each field →
  `browser_click_ref` on submit → `browser_wait_for` on success state.
- **Inspecting data**: prefer `browser_get_text` over `browser_get_dom`;
  full DOM dumps are expensive.

## `browser_eval_js` notes

- Runs in an async function context. `return <expr>` to surface values.
  Bare expressions are not returned.
- Use it to read structured state quickly: `return window.__appState`,
  `return performance.getEntriesByType('navigation')[0].toJSON()`, etc.
- Do not use it to mutate app state you would normally drive through
  the UI — defeats the test value.

## What NOT to do

- Don't run `curl http://localhost:1430` or `npx playwright …`. The
  portless proxy URL differs from raw localhost, and the pane is already
  open.
- Don't chain blind `browser_click` calls without snapshotting first.
- Don't omit `browser_wait_for` in flows that depend on a network round
  trip — race conditions in flows are silent until they aren't.
