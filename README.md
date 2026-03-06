# Weekend

Weekend is a desktop workspace for AI-assisted web development. It combines a live browser pane, a project editor, PTY-backed terminals, and a bundled browser MCP bridge so agents can work against the same running app you see.

Built with Tauri 2, React 19, TypeScript, and Rust.

## What ships

- A desktop app with browser, editor, terminal, settings, and logs views.
- Per-project runtime config in `weekend.config.json`.
- A bundled `weekend-browser-mcp` sidecar for browser automation from agent terminals.
- Shared asset syncing across projects.
- Project archiving, runtime telemetry, theme switching, and editor Vim mode.

## Repository layout

- `src/` React UI, routes, and workspace controller code.
- `src-tauri/` Tauri backend for projects, files, terminals, logs, shared assets, and the browser bridge.
- `src-mcp/` Rust MCP sidecar that exposes browser tools such as `browser_snapshot`, `browser_click_ref`, and `browser_eval_js`.

## Development

Prerequisites:

- Node.js 18+
- `pnpm` 8.15+
- Rust stable via `rustup`
- macOS 10.15+ for the packaged desktop app

```bash
git clone https://github.com/olegakbarov/weekend.software.git
cd weekend.software
pnpm install
pnpm tauri:dev
```

`pnpm tauri:dev` starts Vite at `http://127.0.0.1:1430`, builds the `weekend-browser-mcp` sidecar, and copies the bundled `portless` runtime into the Tauri resources directory.

Useful commands:

- `pnpm tauri:build` builds the macOS app bundle.
- `pnpm build` builds the frontend only.
- `pnpm clean:rust` removes Rust build artifacts from the repo.

## Project model

Weekend stores projects directly under `~/.weekend/<project>/`.

New projects can be created empty or from a GitHub repo. Each project is seeded with:

- `weekend.config.json`
- `.mcp.json`
- `AGENTS.md`
- `CLAUDE.md`

If shared files exist, Weekend syncs them into each project at `./shared-assets/`.

Runtime data lives under `~/.weekend/`, for example:

```text
~/.weekend/
├── my-app/
├── shared-assets/
├── logs/
└── bridge-projects/
```

## `weekend.config.json`

Weekend normalizes project config into this shape:

```json
{
  "runtime": {
    "mode": "portless",
    "url": "http://my-app.localhost:1355"
  },
  "startup": {
    "commands": ["pnpm dev"]
  },
  "processes": {
    "dev": {
      "command": "pnpm dev",
      "role": "dev-server"
    },
    "agent": {
      "command": "claude",
      "role": "agent"
    }
  },
  "archived": false
}
```

Notes:

- `runtime.mode` is currently `portless`.
- `runtime.url` must point to a local address and is the URL loaded in the browser pane.
- `processes` is what Play uses to launch work. A project with no configured processes cannot start.
- Shared files are synced into each project at `./shared-assets/`.

## Browser MCP

The bundled `weekend-browser-mcp` sidecar lets agents interact with the live browser pane from inside project terminals. The core loop is:

1. `browser_snapshot`
2. `browser_click_ref` or `browser_type_ref`
3. `browser_wait_for`
4. snapshot again after navigation or major DOM changes

Other supported tools include `browser_eval_js`, `browser_get_text`, `browser_get_dom`, `browser_navigate`, `browser_get_url`, `browser_scroll`, and `browser_list_webviews`.

## Releases

Pushing a tag that matches `v*` triggers [`.github/workflows/release.yml`](./.github/workflows/release.yml), which builds draft macOS releases for both Apple Silicon and Intel.
