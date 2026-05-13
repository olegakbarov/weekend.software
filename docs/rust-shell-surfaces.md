# Rust Shell Surfaces

This is the map of how the Rust/Tauri app sees the React shell, project
directories, running project processes, native browser webviews, and the MCP
sidecar.

## Mental Model

The desktop app has two Rust binaries:

- `src-tauri`: the main Tauri backend. It owns project files, PTYs, native
  browser webviews, event emission, screenshots, logs, theme injection, the
  project watcher, and the local TCP bridge.
- `src-mcp`: the `weekend-mcp` sidecar. It is an MCP stdio server for
  agents. It does not touch webviews directly; it translates MCP tool calls
  into line-delimited JSON requests over the main app's loopback TCP bridge.

```mermaid
flowchart LR
  User[User]
  Shell["React shell<br/>src/*"]
  Tauri["Rust Tauri backend<br/>src-tauri"]
  Project["Project directory<br/>~/.weekend/{project}"]
  Runtime["Project runtime process<br/>PTY shell + command"]
  Webview["Native browser webview<br/>browser-pane:{project}:{frame}"]
  MCP["MCP sidecar<br/>weekend-mcp"]
  Agent[Agent / MCP client]

  User --> Shell
  Shell <-->|Tauri invoke/listen| Tauri
  Tauri <-->|read/write/watch| Project
  Tauri <-->|spawn/read/write/resize| Runtime
  Runtime -->|serves app through portless| Webview
  Shell -->|create/attach/show/hide| Webview
  Tauri -->|on_page_load eval injection| Webview
  Webview -->|browser_push_event / browser_bridge_ready / browser_eval_result| Tauri
  Agent <-->|MCP stdio JSON-RPC| MCP
  MCP <-->|127.0.0.1 TCP JSON lines| Tauri
  MCP -->|tool effects through bridge| Webview
```

## Surface Inventory

| Surface | Owner | Direction | Main payloads |
| --- | --- | --- | --- |
| Tauri command IPC | React shell -> Rust | request/response | project CRUD, file I/O, terminal ops, browser ops, logs, themes |
| Tauri events | Rust -> React shell | broadcast/listen | `project-tree-changed`, `terminal-output`, `terminal-session-*`, `browser-webview-page-load`, theme/design events |
| Project filesystem | Rust -> disk | read/write/watch | `weekend.config.json`, `.mcp.json`, `.codex/config.toml`, `.weekend/*`, source files |
| PTY/process | React shell -> Rust -> shell | bidirectional stream | xterm input/output, project commands, agent commands |
| Portless runtime | React shell + Rust env -> process | command wrapper | `portless --name <project> --app-port <port> -- <dev command>` |
| Native browser webview | React shell + Rust | UI plus eval/navigation | runtime URL, injected bridge script, page load, screenshot, element grab |
| Browser event bridge | Browser webview -> Rust -> MCP/shell | command callbacks/events | console/errors/navigation/click/input/network/custom events |
| TCP bridge | MCP sidecar -> Rust | JSON line protocol | `hello`, `list_webviews`, `eval_js`, `navigate`, `get_url`, `drain_events`, `configure_observers` |
| MCP stdio server | Agent -> sidecar | MCP JSON-RPC | Weekend tools exposed to agents |
| Theme/design system | Shell/Rust -> project webviews/files | config plus injected JS/files | shell theme, design variable overrides, `shared-assets/weekend-design` |
| Shared assets/env | Shell/Rust -> all projects | files/env injection | `~/.weekend/shared-assets`, project `shared-assets`, shared env into PTYs |
| Logs/debug/preview | Shell/Rust -> disk/UI | read/write | backend logs, frontend logs, project logs, preview PNG |

## Command And Event Boundary

React sees Rust as a command server plus an event bus. Rust sees React as the
trusted local app window that can call the commands allowed in Tauri
capabilities.

```mermaid
flowchart TB
  subgraph React["React shell"]
    Controller["Workspace controller<br/>src/lib/controller"]
    TerminalRegistry["Terminal registry<br/>src/lib/terminal-registry.ts"]
    BrowserHook["Browser hook<br/>src/components/browser/browser-webview.tsx"]
    ThemeProvider[Theme/design providers]
    Editors[Project editor/shared/logs UI]
  end

  subgraph Rust["Rust backend"]
    Commands[tauri::command handlers]
    TerminalState["TerminalState<br/>PTY sessions + metadata"]
    BridgeState["BridgeState<br/>TCP token + eval waiters + webview labels"]
    EventBuffer["EventBufferState<br/>per-webview observer events"]
    Watcher["notify watcher<br/>~/.weekend recursive"]
  end

  Controller -->|invoke list_projects/project_config_read/list_project_tree| Commands
  Controller -->|listen project-tree-changed/terminal-session-*| Commands
  TerminalRegistry -->|invoke terminal_open/write/resize/remove| Commands
  Commands -->|emit terminal-output| TerminalRegistry
  BrowserHook -->|invoke browser_navigate/history/probe/grab/screenshot| Commands
  ThemeProvider -->|invoke get/set theme/design config| Commands
  Editors -->|invoke read/write/rename/delete/import/git diff| Commands

  Commands --> TerminalState
  Commands --> BridgeState
  Commands --> EventBuffer
  Watcher -->|emit project-tree-changed| Controller
```

Core command groups:

- Projects: create from scratch or preset, list, archive, unarchive, delete,
  rename.
- Project config: read/write normalized `weekend.config.json`.
- Files: tree, read text/binary, write, rename, delete, import external files.
- Git: changed files and diffs.
- Terminal: open/write/resize/list/active process/session metadata/remove.
- Browser: navigate/history/probe/close stale webviews/element grab/screenshot.
- Browser callbacks: ready, push event, eval result.
- Shared: shared env and shared assets.
- Theme/design: active theme, design system config, sync design bundle.
- Logs/debug: frontend log batch, backend/project logs, runtime debug dump,
  project preview capture/load.

## Project Filesystem View

Rust's project model is directory-based. A project is a safe directory under
`~/.weekend/<project>`, except reserved root entries such as shared assets,
logs, and bridge files.

```mermaid
flowchart TB
  Root["~/.weekend"]
  SharedRoot["shared-assets/"]
  BridgeRoot["bridge-projects/"]
  GlobalBridge["bridge.port<br/>legacy global bridge pointer"]
  Theme["theme.json"]
  DesignCfg["design-system.json"]
  Logs["logs/"]
  Project["{project}/"]

  Root --> SharedRoot
  Root --> BridgeRoot
  Root --> GlobalBridge
  Root --> Theme
  Root --> DesignCfg
  Root --> Logs
  Root --> Project

  Project --> Config["weekend.config.json<br/>runtime, processes, env, theme, archived"]
  Project --> MCPJSON[".mcp.json<br/>mcpServers.weekend"]
  Project --> Codex[".codex/config.toml<br/>mcp_servers.weekend"]
  Project --> WeekendDir[".weekend/"]
  Project --> SharedCopy["shared-assets/"]
  Project --> Claude["CLAUDE.md / AGENTS.md<br/>managed block only when opted in"]
  Project --> Source["user app files"]

  WeekendDir --> RuntimeGuide["agent-runtime.md<br/>host-owned guidance"]
  WeekendDir --> Preview["preview.png"]
  WeekendDir --> Agents["agents/{instance}.json"]
  WeekendDir --> Autostart["agent-startup.pending + PROMPT.md"]

  SharedRoot -->|copied/synced| SharedCopy
  BridgeRoot --> ProjectBridge["{project}.port<br/>port + token + instance port file"]
```

Important consequences:

- Project identity is the directory name. Renames rekey terminal IDs, rewrite
  default runtime URLs if still default, refresh MCP/Codex config, and remove
  the old project bridge file.
- `weekend.config.json` is the source of runtime truth for Play and browser
  routing.
- `.mcp.json` and `.codex/config.toml` point agents at the sidecar binary and
  set `WEEKEND_PROJECT=<project>`.
- Shared assets are physically copied into every project as
  `./shared-assets/`.
- The design system bundle is physically copied into
  `./shared-assets/weekend-design/` when enabled.

## Startup And Backfill

On app startup, Rust repairs and publishes host-managed surfaces before the
shell begins normal interaction.

```mermaid
sequenceDiagram
  participant App as Tauri Builder
  participant Rust as Rust setup
  participant FS as ~/.weekend
  participant TCP as TCP bridge
  participant Watch as Project watcher
  participant PTY as Terminal watcher

  App->>Rust: manage TerminalState, BridgeState, EventBufferState
  App->>Rust: setup()
  Rust->>FS: backfill project configs
  Rust->>FS: repair project bin wrappers
  Rust->>FS: refresh .mcp.json + .codex/config.toml + agent guidance
  Rust->>FS: sync shared assets into projects
  Rust->>FS: sync design system into projects
  Rust->>Watch: start recursive watcher for ~/.weekend
  Rust->>TCP: bind 127.0.0.1:0 and write bridge port files
  Rust->>PTY: start foreground process watcher
  Rust-->>App: ready
```

## Runtime And PTY Surface

Play is mostly TypeScript orchestration, but every actual process is owned by
Rust via `portable_pty`.

```mermaid
sequenceDiagram
  participant UI as React controller
  participant Term as terminalRegistry/xterm
  participant Rust as Rust terminal commands
  participant PTY as PTY shell
  participant Proc as Project process
  participant Portless as portless proxy
  participant Browser as Browser webview

  UI->>Rust: project_config_read(project)
  Rust-->>UI: processes + runtime.url
  UI->>Term: create/open PTY for each process
  Term->>Rust: terminal_open(terminalId, project, role, agent metadata)
  Rust->>PTY: spawn login shell in project dir
  Rust->>PTY: inject WEEKEND_* env + shared/project env
  Rust-->>UI: terminal-session-changed
  Rust-->>Term: terminal-output stream
  UI->>Term: send process command
  Term->>Rust: terminal_write(command)
  Rust->>PTY: write command bytes
  PTY->>Proc: run command
  Proc->>Portless: dev-server command may be wrapped
  Portless->>Browser: exposes http://{project}.localhost:1355
  Browser->>Rust: browser_probe_runtime_url/readiness and page events
```

Key environment variables Rust injects into project terminals:

- `WEEKEND_PROJECT`
- `WEEKEND_TERMINAL_ID`
- `WEEKEND_RUNTIME_MODE`
- `WEEKEND_RUNTIME_URL`
- `WEEKEND_DEPLOY_URL`
- `WEEKEND_BRIDGE_TOKEN`
- `WEEKEND_BRIDGE_PORT_FILE`
- `WEEKEND_PORTLESS_BIN`
- `WEEKEND_PORTLESS_CLI`
- `WEEKEND_PORTLESS_BUNDLED`
- agent metadata variables for agent-role terminals
- shared env from `~/.weekend/shared.env.json`
- project env from `weekend.config.json`, overriding shared env

## Portless Surface

The shell treats `runtime.mode = "portless"` as the only supported runtime
mode. The browser URL defaults to `http://<sanitized-project>.localhost:1355`.

```mermaid
flowchart LR
  Config["weekend.config.json<br/>runtime.url + processes"]
  Play[React playProject]
  Plan["resolvePortlessLaunchPlan<br/>inspect command/package.json"]
  Port["find_available_port<br/>Rust TCP bind probe"]
  Wrap[buildPortlessCommand]
  PTY[terminal_open + terminal_write]
  Dev["project dev server<br/>usually Vite on 127.0.0.1:{appPort}"]
  Proxy["portless proxy<br/>{project}.localhost:1355"]
  Browser["browser-pane webview"]

  Config --> Play
  Play --> Plan
  Plan --> Port
  Plan --> Wrap
  Wrap --> PTY
  PTY --> Dev
  Dev --> Proxy
  Proxy --> Browser
```

The wrapper is skipped when the configured command already looks portless
wrapped. For simple Vite package-manager dev commands, the launch plan adds
`--host 127.0.0.1 --port <appPort> --strictPort`.

## Browser Webview Surface

The React shell creates native child webviews, but Rust tracks and injects into
them through Tauri's `on_page_load`.

```mermaid
sequenceDiagram
  participant React as React browser pane
  participant WebviewAPI as Tauri Webview JS API
  participant Rust as Rust on_page_load/browser commands
  participant Page as Project page
  participant Buffer as EventBufferState

  React->>WebviewAPI: new Webview(main, browser-pane:{project}:{frame}, url)
  WebviewAPI->>Rust: native webview created/loads
  Rust->>Rust: record browser-pane label
  Rust->>Rust: sync ~/.weekend/bridge-projects/{project}.port
  Rust->>Page: eval theme preamble + bridge_inject.js
  Page->>Rust: browser_bridge_ready(version, url)
  React->>Rust: browser_navigate/history/grab/screenshot/probe
  Rust->>Page: navigate/eval/snapshot/screenshot/grab control
  Page->>Rust: browser_push_event(category, data)
  Rust->>Buffer: append webview event
  Rust-->>React: browser-webview-page-load / browser-element-grabbed
```

The injected browser bridge provides:

- readiness callbacks via `browser_bridge_ready`
- result callbacks for remote eval via `browser_eval_result`
- observer events via `browser_push_event`
- route change observation
- external link capture
- optional observers for console, errors, navigation, clicks, inputs, DOM
  mutations, network, element grab, and custom events

Remote browser pages are only granted the callback commands needed for the
bridge capability: eval result, push event, and bridge ready.

## TCP Bridge Surface

The main Rust app starts a local bridge on an OS-assigned loopback port.

```mermaid
flowchart TB
  MainRust["src-tauri bridge_server::start"]
  Listener["TcpListener<br/>127.0.0.1:0"]
  InstanceFile["~/.weekend/bridge.{token}.port<br/>port + token"]
  LegacyFile["~/.weekend/bridge.port<br/>port + token + instance path"]
  ProjectFile["~/.weekend/bridge-projects/{project}.port<br/>port + token + instance path"]
  Client["BridgeClient in MCP sidecar"]
  Dispatch["dispatch_request"]
  WebviewOps["webview_ops"]
  Browser["browser-pane webview"]
  Events["EventBufferState"]

  MainRust --> Listener
  MainRust --> InstanceFile
  MainRust --> LegacyFile
  MainRust -->|on page load / terminal open / rename| ProjectFile
  Client -->|read WEEKEND_BRIDGE_PORT_FILE or project/global file| InstanceFile
  Client --> ProjectFile
  Client --> LegacyFile
  Client -->|hello token handshake| Listener
  Listener --> Dispatch
  Dispatch -->|list_webviews/get_url/navigate/eval_js| WebviewOps
  Dispatch -->|drain_events/configure_observers| Events
  WebviewOps --> Browser
```

The TCP protocol is line-delimited JSON:

```json
{"id":"1","request":{"type":"list_webviews"}}
{"id":"1","status":"ok","data":["browser-pane:music:0"]}
```

Supported bridge request types:

- `hello`: token identity check
- `list_webviews`
- `eval_js`
- `navigate`
- `get_url`
- `drain_events`
- `configure_observers`

## MCP Surface

The MCP sidecar is a translator. Agents talk MCP stdio to `weekend-mcp`;
the sidecar talks TCP to the main Rust app; the main Rust app talks to native
webviews.

```mermaid
sequenceDiagram
  participant Agent as Agent/MCP client
  participant MCP as weekend-mcp stdio server
  participant Port as Port-file resolver
  participant TCP as Main app TCP bridge
  participant Rust as Rust dispatch
  participant Webview as Browser webview

  Agent->>MCP: initialize
  MCP-->>Agent: tools capability
  Agent->>MCP: tools/list
  MCP-->>Agent: browser_* and weekend_* tool definitions
  Agent->>MCP: tools/call browser_snapshot(...)
  MCP->>Port: resolve bridge port
  Port-->>MCP: project port or explicit/global port
  MCP->>TCP: hello(token)
  TCP-->>MCP: ready
  MCP->>TCP: eval_js/list_webviews/navigate/etc
  TCP->>Rust: dispatch_request
  Rust->>Webview: eval or native navigation
  Webview->>Rust: callback/event
  Rust-->>TCP: bridge response
  TCP-->>MCP: JSON line
  MCP-->>Agent: MCP tool result text
```

Default webview label resolution:

1. Use explicit `label` if the tool call provides one.
2. Else infer project from `WEEKEND_PROJECT`.
3. Else walk upward from current working directory until `.mcp.json`,
   `weekend.config.json`, or `aios.config.json` is found.
4. List webviews from the bridge.
5. Prefer a label matching `browser-pane:<project>:*`.
6. If there is exactly one webview, use it.
7. Otherwise return an error asking for an explicit label.

MCP tools exposed by the sidecar:

- `browser_eval_js`
- `browser_get_dom`
- `browser_get_text`
- `browser_click`
- `browser_type`
- `browser_snapshot`
- `browser_click_ref`
- `browser_type_ref`
- `browser_wait_for`
- `browser_scroll`
- `browser_navigate`
- `browser_get_url`
- `browser_list_webviews`
- `browser_observe`
- `browser_drain_events`

## Eval And Event Flow

Remote eval is intentionally callback-based. Rust cannot synchronously read JS
return values from `webview.eval`, so it installs a pending eval slot, injects a
wrapper, and waits for `browser_eval_result`.

```mermaid
sequenceDiagram
  participant MCP as MCP sidecar
  participant Bridge as TCP bridge
  participant Rust as webview_ops
  participant Pending as BridgeState.pending_evals
  participant Page as Browser page

  MCP->>Bridge: eval_js(label, script)
  Bridge->>Rust: eval_js_with_result
  Rust->>Pending: insert request_id + callback_token + oneshot sender
  Rust->>Page: webview.eval(wrapper(script))
  Page->>Page: run user script
  Page->>Rust: browser_eval_result(request_id, callback_token, payload)
  Rust->>Pending: validate label + token, remove pending eval
  Pending-->>Rust: resolve waiting receiver
  Rust-->>Bridge: ok(value) or error(message)
  Bridge-->>MCP: JSON response
```

Observer flow is similar but event buffered:

```mermaid
sequenceDiagram
  participant MCP as MCP sidecar
  participant Bridge as TCP bridge
  participant Rust as Rust dispatch
  participant Page as Browser page
  participant Buffer as EventBufferState

  MCP->>Bridge: configure_observers(label, config)
  Bridge->>Buffer: store observer config
  Bridge->>Page: window.__WEEKEND_BRIDGE__.configure(config)
  Page->>Rust: browser_push_event(category, data)
  Rust->>Buffer: append seq/timestamp/category/data
  MCP->>Bridge: drain_events(label, sinceSeq)
  Bridge->>Buffer: drain events with seq > sinceSeq
  Bridge-->>MCP: events
```

## Theme And Design Surface

The shell owns global theme and design variable defaults. Projects can opt out
of shell theme tracking in `weekend.config.json`.

```mermaid
flowchart TB
  ShellTheme[React theme provider]
  RustTheme[set_active_theme/get_active_theme]
  ThemeFile["~/.weekend/theme.json"]
  MainWindows["Shell webviews<br/>listen theme-changed"]
  ProjectWebviews["Project browser-pane webviews"]
  DSPrefs["set_design_system_config/get_design_system_config"]
  DSFile["~/.weekend/design-system.json"]
  DSBundle["packages/design/dist"]
  ProjectDS["{project}/shared-assets/weekend-design"]

  ShellTheme --> RustTheme
  RustTheme --> ThemeFile
  RustTheme -->|emit theme-changed| MainWindows
  RustTheme -->|direct eval theme_apply_script| ProjectWebviews

  ShellTheme --> DSPrefs
  DSPrefs --> DSFile
  DSPrefs -->|emit design-system-changed| MainWindows
  DSPrefs -->|direct eval overrides script| ProjectWebviews

  DSBundle -->|startup/create/sync command| ProjectDS
```

Injected project theme state anchors:

- `document.documentElement.dataset.theme`
- `.dark` / `.light` classes
- `window.__WEEKEND_SHELL_THEME__`
- `weekend:theme` browser event
- `window.__WEEKEND_SHELL_DESIGN_SYSTEM__`
- `weekend:design-system` and `weekend:design-system-overrides` events
- style tag `#weekend-project-ds-vars`

## Shared Assets And Env

Shared assets are host-level files copied into every project. Shared env is not
written into project files; it is injected into project terminal processes.

```mermaid
flowchart LR
  SharedUI[Shared Files / Shared Env UI]
  Rust[Shared commands in Rust]
  SharedAssets["~/.weekend/shared-assets/*"]
  ProjectCopies["~/.weekend/{project}/shared-assets/*"]
  SharedEnv["~/.weekend/shared.env.json"]
  Terminal["terminal_open"]
  ProjectEnv["weekend.config.json env"]
  PTY["PTY process env"]

  SharedUI -->|list/upload/import/rename/delete| Rust
  Rust --> SharedAssets
  Rust -->|sync all projects| ProjectCopies
  SharedUI -->|read/write| Rust
  Rust --> SharedEnv
  Terminal --> SharedEnv
  Terminal --> ProjectEnv
  SharedEnv --> PTY
  ProjectEnv -->|overrides duplicate keys| PTY
```

## State Ownership Summary

```mermaid
flowchart TB
  subgraph RustOwns["Rust owns"]
    A[Project directories and config normalization]
    B[PTY process lifecycle and metadata]
    C[Filesystem watcher]
    D[Native browser webview callbacks and screenshots]
    E[TCP bridge and token files]
    F[Event buffers]
    G[Logs and previews]
  end

  subgraph ReactOwns["React owns"]
    H[Workspace controller state]
    I[Play orchestration and process command selection]
    J[xterm instances and DOM attachment]
    K[Native webview cache and layout attachment]
    L[Navigation UI, panes, settings]
  end

  subgraph ProjectOwns["Project owns"]
    M[Application source files]
    N[Runtime command behavior]
    O[Optional theme opt-out/custom variables]
    P[Agent/user docs outside managed blocks]
  end

  ReactOwns <-->|Tauri IPC/events| RustOwns
  RustOwns <-->|files/processes/browser| ProjectOwns
  ReactOwns -->|Play/browser/editor workflows| ProjectOwns
```

## Source Landmarks

- Main Rust command/event/backend surface: `src-tauri/src/main.rs`
- TCP bridge dispatcher: `src-tauri/src/bridge_server.rs`
- Bridge request/state types: `src-tauri/src/bridge_types.rs`
- Webview eval/navigation helpers: `src-tauri/src/webview_ops.rs`
- Browser event buffer: `src-tauri/src/event_buffer.rs`
- Browser injected script: `src-tauri/src/bridge_inject.js`
- MCP stdio server: `src-mcp/src/mcp_protocol.rs`
- MCP TCP client and port-file resolution: `src-mcp/src/bridge_client.rs`
- MCP tool definitions and tool-to-bridge translation: `src-mcp/src/tools.rs`
- React workspace controller: `src/lib/controller/index.ts`
- Project config/tree actions: `src/lib/controller/projects.ts`
- Portless launch planning: `src/lib/controller/portless.ts`
- Terminal xterm/PTY bridge: `src/lib/terminal-registry.ts`
- Native browser webview creation/layout: `src/lib/embedded-browser-webview.ts`
- Browser pane runtime behavior: `src/components/browser/browser-webview.tsx`
- Tauri command permissions/capabilities: `src-tauri/permissions/*`,
  `src-tauri/capabilities/*`
