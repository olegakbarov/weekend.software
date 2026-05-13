# Runtime config — `weekend.config.json`

Load when: launching a dev server, hitting a project URL, editing
`weekend.config.json`, or wondering why a fetch from outside the app
isn't reaching the runtime.

Every Weekend project has a `weekend.config.json` at its root. Read it
before launching any runtime command. The expected shape:

```json
{
  "runtime": {
    "mode": "portless",
    "url": "http://my-app.localhost:1355/",
    "deployUrl": "https://my-app.example.com"
  },
  "startup": {
    "commands": ["pnpm dev"]
  },
  "processes": {
    "agent": { "command": "claude", "role": "agent" },
    "dev":   { "command": "pnpm dev", "role": "dev-server" }
  },
  "archived": false
}
```

## Portless mode

`runtime.mode: "portless"` is the standard. Weekend runs a local proxy
on a fixed port (`1355` by default) and routes per-project subdomains
through it. Each project gets a stable URL of the form
`http://<slug>.localhost:1355/`. That URL is what you hit — not the raw
port the underlying dev server is listening on.

The dev server itself may bind to an ephemeral port; Weekend may also
wrap `dev-server` processes with a bundled `portless` runtime during
Play. Either way, you do not need to know the inner port.

## Rules

- **Always resolve endpoints from `runtime.url`.** Never hardcode
  `http://localhost:1430` (Tauri dev port) or whatever Vite prints —
  those are not stable and aren't the routable URL.
- **Use `runtime.deployUrl`** (when present) for "where will this be
  deployed" questions. Treat it as optional.
- **Do not assume every process is auto-wrapped.** Only entries with
  `role: "dev-server"` are guaranteed candidates for the bundled
  portless runtime. Other roles run as-is.
- **Edit `weekend.config.json` through Weekend.** The desktop app
  provides backend commands and a settings UI that update this file.
  Hand-editing works in a pinch but loses validation; prefer the app
  controls when the user is available.

## Common pitfalls

- Fetching `localhost:<vite-port>` from a script run inside the project:
  works inconsistently, will not survive a dev-server restart, and is
  wrong on a machine where multiple projects run.
- Assuming `runtime.url` already ends with a slash — it usually does but
  don't double up when concatenating paths.
- Adding new `processes` entries with arbitrary `role` values: the role
  string is meaningful (`agent`, `dev-server`, …). Use an existing role
  unless you've checked Weekend's source.
