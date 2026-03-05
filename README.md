# Weekend

A desktop operating system for AI-assisted development. Weekend gives AI agents a real workspace — a browser, editor, terminal, and file system — so they can build, test, and iterate on web projects alongside you.

Built with Tauri, React, and Rust.

## How It Works

Weekend combines four core surfaces into a single desktop application:

```
┌──────────────────────────────────────────────────────┐
│  Weekend                                             │
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│ Projects │   Browser   │   Editor   │   Terminal     │
│          │             │            │                │
│ • app-1  │  Live       │  CodeMirror│  PTY sessions  │
│ • app-2  │  preview    │  + Vim     │  with process  │
│ • app-3  │  of your    │  mode      │  tracking      │
│          │  running    │            │                │
│          │  app        │            │  Agent terminal │
│          │             │            │  for AI tools   │
├──────────┴─────────────┴────────────┴────────────────┤
│  MCP Bridge ←→ AI Agent                              │
└──────────────────────────────────────────────────────┘
```

**Projects** live in `~/.weekend/projects/`. Each project has a `weekend.config.json` that defines startup commands, a local runtime address, and process roles.

**The Browser pane** renders your running app in an embedded iframe. Hit "Play" and Weekend runs your startup commands and loads the preview from `runtime.url` (generated as a local address).

**The Editor** is CodeMirror 6 with syntax highlighting for JS, TS, HTML, CSS, JSON, and Markdown. Optional Vim mode. Auto-saves with a 1-second debounce.

**The Terminal** uses real PTY sessions via `portable-pty`. Multiple sessions per project, with automatic process detection (it knows when you're running Node, Python, or an AI agent).

**The MCP Bridge** is what makes Weekend unique. A TCP bridge server connects AI agents (running in the terminal) to the browser pane. Agents can snapshot the DOM, click elements, type text, evaluate JavaScript, and navigate — all through the [Model Context Protocol](https://modelcontextprotocol.io/). The agent sees the app the same way a user would.

### Architecture

```
AI Agent (Claude, etc.)
    │
    │ MCP protocol (stdin/stdout)
    ▼
weekend-browser-mcp (Rust sidecar binary)
    │
    │ TCP connection
    ▼
Bridge Server (inside Tauri backend)
    │
    │ IPC / webview eval
    ▼
Browser Pane (your running app)
```

The MCP server is a separate Rust binary that ships as a Tauri sidecar. When an agent starts, it connects to the bridge via a port file at `~/.weekend/bridge.port`. Tool calls flow from agent → MCP server → bridge → browser webview, and results flow back.

## Getting Started

### Prerequisites

- **Node.js** (18+) and **pnpm** (8.15+)
- **Rust** toolchain ([rustup.rs](https://rustup.rs))
- **macOS** 10.15+ (Windows/Linux support planned)

### Development

```bash
# Clone the repository
git clone https://github.com/user/aios.git
cd aios

# Install frontend dependencies
pnpm install

# Start the app in dev mode (builds Rust backend + starts Vite)
pnpm tauri:dev
```

This builds the MCP sidecar, compiles the Tauri backend, and starts Vite with hot reload on port 1430.

### Build for Distribution

```bash
pnpm tauri:build
```

Outputs a `.dmg` / `.app` bundle on macOS.

### Release to GitHub

This repo has an automated release workflow at
`.github/workflows/release.yml`. It runs when you push a tag matching `v*`
and builds macOS artifacts for both `aarch64-apple-darwin` and
`x86_64-apple-darwin`.

Use this flow:

```bash
# 1) Ensure main is up to date
git checkout main
git pull --rebase

# 2) Commit your release changes (for example, version bumps)
git add -A
git commit -m "release: v0.2.0"
git push origin main

# 3) Create and push a release tag (must start with `v`)
git tag -a v0.2.0 -m "Weekend Software v0.2.0"
git push origin v0.2.0
```

After the tag push:

1. Open GitHub Actions and wait for `Release (macOS)` to complete.
2. Open the created draft release.
3. Review the generated assets and click Publish.

### Creating Your First Project

1. Open Weekend
2. Click "New Project" in the sidebar
3. The project folder is created at `~/.weekend/projects/<name>/`
4. Add your code, or initialize a framework (`npm create vite@latest .`)
5. Edit `weekend.config.json` to set your startup command (runtime URL is auto-generated from the project name):

```json
{
  "runtime": {
    "mode": "portless",
    "url": "http://my-app.localhost:1355"
  },
  "startup": {
    "commands": ["pnpm dev"]
  }
}
```

6. Hit Play — your dev server starts and the browser pane loads your app

Weekend uses `runtime.mode: "portless"` with `runtime.url` as the single runtime endpoint mode.
`runtime.url` must be a local address (`localhost`, `*.localhost`, or loopback IP). Missing/invalid values are repaired to a generated local URL during config backfill.
Weekend can run `dev-server` process commands through its bundled `portless` runtime during Play (no global `npm install -g portless` required).

## Project Configuration

Each project has a `weekend.config.json` at its root:

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
    "dev-server": {
      "command": "pnpm dev",
      "role": "dev-server"
    }
  },
  "archived": false
}
```

| Field | Description |
|-------|-------------|
| `runtime.mode` | Runtime endpoint mode. Weekend uses `portless`. |
| `runtime.url` | Local runtime URL used by the Browser pane (for example `http://my-app.localhost:1355`). |
| `startup.commands` | Commands to execute when you hit Play |
| `processes` | Named process definitions with roles (`dev-server`, `service`, `agent`) |
| `archived` | Hide the project from the sidebar |

## MCP Browser Tools

When an AI agent runs inside Weekend's terminal, it can interact with the browser pane through these MCP tools:

| Tool | What it does |
|------|-------------|
| `browser_snapshot` | Capture the DOM tree with stable element references |
| `browser_click_ref` | Click an element by its snapshot reference |
| `browser_type_ref` | Type text into an element by reference |
| `browser_eval_js` | Execute JavaScript in the page context |
| `browser_navigate` | Navigate to a URL |
| `browser_get_dom` | Get raw DOM content |
| `browser_get_text` | Extract text content from the page |
| `browser_scroll` | Scroll the page or a specific element |
| `browser_wait_for` | Poll until text or URL matches a condition |
| `browser_list_webviews` | List all open browser panes |

The recommended pattern: **snapshot first, act on refs, re-snapshot after changes.** This gives agents stable handles to DOM elements without relying on brittle CSS selectors.

## Use Cases

### AI-Powered App Development

The primary use case. Give an AI agent a project and let it build, test, and refine a web app in a real browser environment. The agent can:

- Write code in the editor or terminal
- Start the dev server
- See the live result in the browser pane
- Interact with the UI (click buttons, fill forms, check layouts)
- Fix issues and iterate

This closes the loop that's missing from pure-terminal AI coding — the agent can actually see and use what it builds.

### Rapid Prototyping

Spin up a new project, describe what you want to an agent, and watch it build a working prototype. Weekend handles runtime endpoint setup, dev servers, and file system wiring so the agent can focus on building.

### UI Testing and QA

Use agents to systematically test your web app. The MCP tools let agents navigate pages, fill out forms, click through flows, and verify that elements render correctly. Think of it as a scriptable QA assistant that can understand intent, not just selectors.

### Multi-Project Management

Weekend manages multiple projects in a single workspace. Each project gets isolated terminal sessions, its own runtime endpoint URL, and independent start/stop controls. Switch between projects instantly from the sidebar.

### AI Agent Playground

Experiment with different AI models and agent frameworks. Weekend provides the runtime environment — any agent that speaks MCP can plug in. Test how different agents handle the same task, compare approaches, or develop custom agent tooling.

### Design Iteration

Share assets (images, fonts, design tokens) across all projects through the shared assets system. Upload once to `~/.weekend/shared-assets/`, and every project gets access. Useful for maintaining consistent branding while prototyping variations.

### Learning and Education

Watch an AI agent build something step by step. Weekend makes the entire process visible — you see the code being written, the terminal output, and the live result simultaneously. Great for understanding how apps are constructed or learning new frameworks.

### Automated Workflows

Configure startup commands to orchestrate multi-step build processes. A project can start a dev server, run a linter, and launch an agent in sequence. The terminal tracks each process and its role independently.

## Key Features

- **Real browser environment** for AI agents — not simulated, not headless. Agents see actual rendered output.
- **MCP integration** via a Rust sidecar binary. Fast, type-safe bridge between agents and the browser.
- **Multi-project workspace** with per-project configuration, runtime endpoints, and terminal sessions.
- **Code editor** with CodeMirror 6, language support, Vim mode, and auto-save.
- **PTY terminal** with process detection and session management. Knows what's running and in what state.
- **Shared assets** synced across all projects from a central store.
- **Theming** — dark/light mode, preset color schemes, custom hues.
- **Log management** with rotation, project-level isolation, and a built-in log viewer.
- **Keyboard-driven** — `Cmd+J` (browser), `Cmd+K` (agent), `Cmd+L` (editor) for quick pane switching.
- **Lightweight** — Tauri + Rust backend instead of Electron. Small binary, low memory footprint.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri 2 |
| Frontend | React 19, TypeScript, Vite 7 |
| Styling | Tailwind CSS 4, Radix UI |
| Editor | CodeMirror 6 |
| Terminal | XTerm.js 6, portable-pty |
| Backend | Rust, Tokio |
| Agent protocol | Model Context Protocol (MCP) |
| Package manager | pnpm |

## File Structure

```
~/.weekend/
├── projects/           # Your project directories
│   └── my-app/
│       ├── weekend.config.json
│       ├── shared-assets/    # Auto-synced from global store
│       └── (your code)
├── shared-assets/      # Global asset store
├── logs/               # Backend, frontend, and per-project logs
└── bridge.port         # MCP bridge connection info
```

## License

MIT
