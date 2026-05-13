import { useEffect, type ReactNode } from "react";
import { Cable } from "lucide-react";
import { SHELL_DOCS_SECTIONS } from "@/components/docs/shell-docs-sections";
import {
  SHELL_DOCS_NAVIGATE_EVENT,
  setShellDocsSection,
} from "@/components/docs/shell-docs-route-store";
import "@/dev/docs/app.css";

const managedFiles = [
  ["weekend.config.json", "Runtime URL, process commands, env, archive state, theme policy."],
  [".weekend/agent-runtime.md", "Host-authored instructions for agents working inside the project."],
  [".mcp.json", "MCP server entry for the weekend browser and terminal tools."],
  [".codex/config.toml", "Codex MCP server entry with WEEKEND_PROJECT preconfigured."],
  ["shared-assets/", "Synced global assets plus the weekend-design package when enabled."],
];

const environmentVariables = [
  ["WEEKEND_PROJECT", "Current Weekend project name."],
  ["WEEKEND_TERMINAL_ID", "Current PTY session id."],
  ["WEEKEND_RUNTIME_MODE", "Runtime mode from weekend.config.json."],
  ["WEEKEND_RUNTIME_URL", "Portless URL the shell and browser pane use."],
  ["WEEKEND_DEPLOY_URL", "Optional public deploy URL."],
  ["WEEKEND_BRIDGE_TOKEN", "Token used by bridge-aware MCP clients."],
  ["WEEKEND_BRIDGE_PORT_FILE", "Path to the active Tauri TCP bridge port file."],
  ["WEEKEND_PORTLESS_BIN", "Portable portless command name."],
  ["WEEKEND_PORTLESS_CLI", "Bundled portless CLI path when available."],
  ["WEEKEND_PORTLESS_BUNDLED", "Whether Tauri resolved the bundled CLI."],
];

const mcpTools = [
  ["browser_snapshot", "Accessibility snapshot with stable element refs."],
  ["browser_click_ref", "Click an element from the latest snapshot."],
  ["browser_type_ref", "Type into an element from the latest snapshot."],
  ["browser_wait_for", "Wait for text, URL, visibility, or time."],
  ["browser_eval_js", "Run async JavaScript in the live browser pane."],
  ["browser_get_text", "Read visible text from the page or selector."],
  ["browser_get_dom", "Read outerHTML from the page or selector."],
  ["browser_navigate", "Navigate the active browser pane."],
  ["browser_observe", "Enable observer streams for console, errors, clicks, inputs, network, DOM, navigation, or custom events."],
  ["browser_drain_events", "Read buffered observer events by sequence number."],
  ["weekend_terminal_spawn", "Create a Weekend-managed terminal session."],
  ["weekend_terminal_read", "Drain terminal output lines by sequence number."],
  ["weekend_terminal_write", "Write raw input to a terminal PTY."],
  ["weekend_terminal_list", "List user and agent terminal sessions."],
  ["weekend_terminal_kill", "Kill a terminal process and remove the session."],
];

const configSnippet = `{
  "runtime": {
    "mode": "portless",
    "url": "http://my-project.localhost:1355/",
    "deployUrl": "https://my-project.example.com"
  },
  "processes": {
    "dev": { "command": "pnpm dev", "role": "dev-server" },
    "agent": { "command": "codex", "role": "agent" }
  },
  "env": {
    "PUBLIC_API_BASE": "https://api.example.com"
  },
  "theme": {
    "trackShell": true,
    "designSystem": "weekend"
  }
}`;

const bridgeSnippet = `window.__WEEKEND_BRIDGE__?.emit("checkout-ready", {
  cartId: "cart_123",
  total: 42.5
});

window.__WEEKEND_BRIDGE__?.configure({
  console: true,
  errors: true,
  navigation: true,
  custom: true
});`;

const designSnippet = `"@weekend/design": "file:./shared-assets/weekend-design"`;

export function ShellDocsPage() {
  useEffect(() => {
    const scrollRoot = document.querySelector<HTMLElement>(".shell-docs-main");
    const headings = SHELL_DOCS_SECTIONS
      .map((item) => document.getElementById(item.id))
      .filter((item): item is HTMLElement => Boolean(item));

    if (!scrollRoot || headings.length === 0 || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const nearest = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (first, second) =>
              first.boundingClientRect.top - second.boundingClientRect.top,
          )[0];

        if (nearest?.target.id) {
          setShellDocsSection(nearest.target.id);
        }
      },
      {
        root: scrollRoot,
        rootMargin: "-88px 0px -65% 0px",
        threshold: [0, 1],
      },
    );

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (!id) return;
      document
        .getElementById(id)
        ?.scrollIntoView({ block: "start", inline: "nearest" });
    };

    window.addEventListener(SHELL_DOCS_NAVIGATE_EVENT, onNavigate);
    return () => window.removeEventListener(SHELL_DOCS_NAVIGATE_EVENT, onNavigate);
  }, []);

  return (
    <section className="ds-docs-root h-full min-h-0 overflow-hidden select-text">
      <main className="shell-docs-main h-full min-h-0 overflow-auto">
        <div className="topbar">
          <div className="crumbs">
            <span>Docs</span>
            <span className="sep">/</span>
            <span className="leaf">Project integration</span>
          </div>
        </div>

        <article className="page">
          <header className="page-header">
            <div className="page-eyebrow">Weekend docs</div>
            <h1>Project and Shell Integration</h1>
            <p className="lede">
              Projects communicate with Weekend through host-managed files,
              PTY environment, a live browser-pane bridge, and a local MCP
              sidecar. The Tauri backend owns those surfaces and keeps the
              shell, running process, browser webview, and agents pointed at
              the same project.
            </p>
          </header>

            <DocSection id="mental-model" title="Mental Model">
              <p>
                A Weekend project is a normal local web project with a small
                shell contract. The React shell talks to the Tauri backend; the
                backend reads and writes project files, starts PTYs, manages
                native browser webviews, and exposes a TCP bridge for MCP tools.
              </p>
              <ul>
                <li>The project owns source files and app behavior.</li>
                <li>The shell owns project discovery, runtime launch, browser panes, shared assets, and agent wiring.</li>
                <li>The MCP sidecar translates agent tool calls into bridge requests against the live Tauri app.</li>
              </ul>
              <div className="callout">
                <Cable className="ico" size={16} />
                <div>
                  <strong>Default integration path:</strong> agents should use
                  the weekend MCP tools against the visible browser pane instead
                  of launching a separate browser or hardcoding local ports.
                </div>
              </div>
            </DocSection>

            <DocSection id="filesystem" title="Project Files">
              <p>
                Project identity is directory-based. A project lives at
                <CodeInline>~/.weekend/&lt;project&gt;</CodeInline>, and Tauri
                treats selected files as a contract between the app, terminals,
                browser panes, and agents.
              </p>
              <DataTable
                columns={["File", "Purpose"]}
                rows={managedFiles}
              />
            </DocSection>

            <DocSection id="runtime" title="Runtime Config">
              <p>
                <CodeInline>weekend.config.json</CodeInline> is the runtime
                source of truth. The shell expects
                <CodeInline>runtime.mode</CodeInline> to be
                <CodeInline>portless</CodeInline> and routes project browser
                traffic through <CodeInline>runtime.url</CodeInline>.
              </p>
              <CodeBlock code={configSnippet} />
              <p className="note">
                Use <CodeInline>runtime.deployUrl</CodeInline> only when you
                need the public deployment target. Runtime testing should use
                the portless URL.
              </p>
            </DocSection>

            <DocSection id="environment" title="Terminal Environment">
              <p>
                Weekend terminals are spawned by Tauri with project, runtime,
                bridge, and agent context already injected. Shared env is loaded
                first; project env from <CodeInline>weekend.config.json</CodeInline>
                overrides shared values.
              </p>
              <DataTable
                columns={["Variable", "Meaning"]}
                rows={environmentVariables}
              />
            </DocSection>

            <DocSection id="mcp" title="MCP Tools">
              <p>
                The <CodeInline>weekend</CodeInline> MCP sidecar connects to
                the Tauri bridge and operates on browser-pane webviews and
                Weekend terminal sessions. The current project is usually
                inferred from <CodeInline>WEEKEND_PROJECT</CodeInline>.
              </p>
              <DataTable
                columns={["Tool", "Purpose"]}
                rows={mcpTools}
              />
            </DocSection>

            <DocSection id="page-bridge" title="Page Bridge">
              <p>
                Browser-pane pages receive an injected
                <CodeInline>window.__WEEKEND_BRIDGE__</CodeInline> object after
                load. Pages can emit custom events or enable observers for
                console, errors, navigation, clicks, inputs, network, DOM
                mutations, and custom events.
              </p>
              <CodeBlock code={bridgeSnippet} />
            </DocSection>

            <DocSection id="theme" title="Theme and Design">
              <p>
                The shell can inject the active theme and design-system override
                state into tracking-enabled project webviews.
                <CodeInline>window.__WEEKEND_SHELL_THEME__</CodeInline> exposes
                the active theme, and
                <CodeInline>window.__WEEKEND_SHELL_DESIGN_SYSTEM__</CodeInline>
                exposes shape and variable overrides.
              </p>
              <ul>
                <li>Set <CodeInline>theme.trackShell: false</CodeInline> to opt out for a project.</li>
                <li>Use <CodeInline>data-theme</CodeInline> for theme switching inside projects.</li>
                <li>Do not write inline CSS variables onto <CodeInline>&lt;html&gt;</CodeInline> for theme overrides.</li>
              </ul>
            </DocSection>

            <DocSection id="shared-assets" title="Shared Assets">
              <p>
                The shell copies global assets from
                <CodeInline>~/.weekend/shared-assets</CodeInline> into each
                project as <CodeInline>./shared-assets</CodeInline>. User-managed
                assets should be treated as opt-in unless the user names them.
              </p>
              <p>
                When enabled, Weekend also syncs a local design-system package
                into <CodeInline>./shared-assets/weekend-design</CodeInline>.
              </p>
              <CodeBlock code={designSnippet} />
            </DocSection>
        </article>
      </main>
    </section>
  );
}

function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="section scroll-mt-16" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function CodeInline({ children }: { children: ReactNode }) {
  return <code className="code-inline">{children}</code>;
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="code-block">
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: [string, string] | string[];
  rows: string[][];
}) {
  return (
    <div className="my-3 overflow-x-auto">
      <table className="props-table">
        <thead>
          <tr>
            <th>{columns[0]}</th>
            <th>{columns[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, description]) => (
            <tr key={name}>
              <td className="prop-name">{name}</td>
              <td>{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
