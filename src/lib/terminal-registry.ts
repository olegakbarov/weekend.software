import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

const DARK_THEME = {
  foreground: "#d9dee7",
  cursor: "#d9dee7",
  black: "#15161e",
  red: "#f7768e",
  green: "#9ece6a",
  yellow: "#e0af68",
  blue: "#7aa2f7",
  magenta: "#bb9af7",
  cyan: "#7dcfff",
  white: "#c0caf5",
  brightBlack: "#414868",
  brightRed: "#f7768e",
  brightGreen: "#9ece6a",
  brightYellow: "#e0af68",
  brightBlue: "#7aa2f7",
  brightMagenta: "#bb9af7",
  brightCyan: "#7dcfff",
  brightWhite: "#c0caf5",
  selectionBackground: "#33467c",
  selectionForeground: "#c0caf5",
  background: "rgba(0, 0, 0, 0)",
};

const LIGHT_THEME = {
  foreground: "#2C2420",
  cursor: "#2C2420",
  black: "#2C2420",
  red: "#8c4351",
  green: "#485e30",
  yellow: "#8f5e15",
  blue: "#34548a",
  magenta: "#5a4a78",
  cyan: "#0f4b6e",
  white: "#F5F0EB",
  brightBlack: "#8A7F75",
  brightRed: "#8c4351",
  brightGreen: "#485e30",
  brightYellow: "#8f5e15",
  brightBlue: "#34548a",
  brightMagenta: "#5a4a78",
  brightCyan: "#0f4b6e",
  brightWhite: "#2C2420",
  selectionBackground: "#E84B8A40",
  selectionForeground: "#2C2420",
  background: "#F5F0EB",
};

type TerminalOutputPayload = {
  terminalId: string;
  seq?: number;
  data: string;
};

type ManagedTerminal = {
  terminal: Terminal;
  fitAddon: FitAddon;
  project: string;
  inputDisposable: { dispose: () => void } | null;
  resizeObserver: ResizeObserver | null;
  container: HTMLElement | null;
  resizeRafId: number | null;
  lastReportedSize: { cols: number; rows: number };
  opened: boolean;
  ptyReady: boolean;
  ptyOpenPromise: Promise<void> | null;
  pendingCommands: string[];
  playSpawned: boolean;
  processRole: string | null;
};

class TerminalRegistry {
  private terminals = new Map<string, ManagedTerminal>();
  private outputChunks = new Map<string, string[]>();
  private flushRafIds = new Map<string, number>();
  private lastSeqByTerminal = new Map<string, number>();
  private globalUnlisten: UnlistenFn | null = null;
  private listenerSetupPromise: Promise<void> | null = null;
  private currentTheme: "dark" | "light" = "dark";

  private isDebugEnabled(): boolean {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("weekend.debug.terminal") === "1";
  }

  private ensureGlobalListener(): Promise<void> {
    if (this.globalUnlisten) return Promise.resolve();
    if (this.listenerSetupPromise) return this.listenerSetupPromise;

    this.listenerSetupPromise = listen<TerminalOutputPayload>(
      "terminal-output",
      (event) => {
        const { terminalId, data, seq } = event.payload;
        const managed = this.terminals.get(terminalId);
        if (!managed) return;

        if (typeof seq === "number" && Number.isFinite(seq)) {
          const lastSeq = this.lastSeqByTerminal.get(terminalId);
          if (
            typeof lastSeq === "number" &&
            seq !== lastSeq + 1 &&
            this.isDebugEnabled()
          ) {
            console.warn("[TerminalRegistry] terminal-output sequence anomaly", {
              terminalId,
              lastSeq,
              nextSeq: seq,
            });
          }
          this.lastSeqByTerminal.set(terminalId, seq);
        }

        let chunks = this.outputChunks.get(terminalId);
        if (!chunks) {
          chunks = [];
          this.outputChunks.set(terminalId, chunks);
        }
        chunks.push(data);

        if (this.flushRafIds.has(terminalId)) return;
        const rafId = window.requestAnimationFrame(() => {
          this.flushRafIds.delete(terminalId);
          const pendingChunks = this.outputChunks.get(terminalId);
          if (!pendingChunks || pendingChunks.length === 0) return;
          this.outputChunks.set(terminalId, []);
          const m = this.terminals.get(terminalId);
          if (m) {
            m.terminal.write(pendingChunks.join(""));
          }
        });
        this.flushRafIds.set(terminalId, rafId);
      }
    ).then((unlisten) => {
      this.globalUnlisten = unlisten;
      this.listenerSetupPromise = null;
    });

    return this.listenerSetupPromise;
  }

  private acquirePromises = new Map<string, Promise<void>>();

  private ensurePtyOpen(
    terminalId: string,
    managed: ManagedTerminal,
    cols: number,
    rows: number
  ): Promise<void> {
    if (managed.ptyReady) {
      return Promise.resolve();
    }
    if (managed.ptyOpenPromise) {
      return managed.ptyOpenPromise;
    }

    const open = (): Promise<void> =>
      invoke("terminal_open", {
        terminalId,
        project: managed.project,
        cols,
        rows,
        playSpawned: managed.playSpawned || undefined,
        processRole: managed.processRole || undefined,
      });

    managed.ptyOpenPromise = open()
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("terminal is still opening")) {
          console.debug("[TerminalRegistry] terminal_open in progress, retrying", {
            terminalId,
          });
          return new Promise<void>((resolve) => {
            window.setTimeout(() => resolve(), 30);
          }).then(() => open());
        }
        throw error;
      })
      .then(() => {
        managed.ptyReady = true;
        if (managed.pendingCommands.length > 0) {
          const commands = managed.pendingCommands.splice(0);
          for (const cmd of commands) {
            this.writeToPty(terminalId, managed, cmd + "\n");
          }
        }
      })
      .catch((error) => {
        console.warn("[TerminalRegistry] terminal_open failed", {
          terminalId,
          error: error instanceof Error ? error.message : String(error),
        });
        managed.terminal.writeln(
          `\r\n[terminal error] ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      })
      .finally(() => {
        managed.ptyOpenPromise = null;
      });

    return managed.ptyOpenPromise;
  }

  async acquire(
    terminalId: string,
    project: string,
    opts?: { playSpawned?: boolean; processRole?: string }
  ): Promise<void> {
    if (this.terminals.has(terminalId)) return;

    // Deduplicate concurrent acquire calls for the same terminal
    const inflight = this.acquirePromises.get(terminalId);
    if (inflight) return inflight;

    const promise = this.acquireInternal(terminalId, project, opts);
    this.acquirePromises.set(terminalId, promise);
    try {
      await promise;
    } finally {
      this.acquirePromises.delete(terminalId);
    }
  }

  private async acquireInternal(
    terminalId: string,
    project: string,
    opts?: { playSpawned?: boolean; processRole?: string }
  ): Promise<void> {
    await this.ensureGlobalListener();

    // Re-check after await in case another call completed first
    if (this.terminals.has(terminalId)) return;

    const theme = this.currentTheme === "dark" ? DARK_THEME : LIGHT_THEME;
    const terminal = new Terminal({
      allowTransparency: true,
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Berkeley Mono', Menlo, Monaco, 'Courier New', monospace",
      // Keep accessibility tree disabled in-app; when exposed by host webviews
      // it can render duplicate plain-text rows on top of styled terminal rows.
      screenReaderMode: false,
      scrollback: 5000,
      theme,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    const managed: ManagedTerminal = {
      terminal,
      fitAddon,
      project,
      inputDisposable: null,
      resizeObserver: null,
      container: null,
      resizeRafId: null,
      lastReportedSize: { cols: 0, rows: 0 },
      opened: false,
      ptyReady: false,
      ptyOpenPromise: null,
      pendingCommands: [],
      playSpawned: opts?.playSpawned ?? false,
      processRole: opts?.processRole ?? null,
    };

    const inputDisposable = terminal.onData((data) => {
      if (!managed.ptyReady) return;
      this.writeToPty(terminalId, managed, data);
    });
    managed.inputDisposable = inputDisposable;

    this.terminals.set(terminalId, managed);
  }

  attach(terminalId: string, container: HTMLElement): void {
    const managed = this.terminals.get(terminalId);
    if (!managed) return;

    if (managed.container === container) return;

    // Detach from previous container if any
    this.detachInternal(managed);

    managed.container = container;

    if (!managed.opened) {
      managed.terminal.open(container);
      managed.opened = true;
    } else {
      // Re-parent: xterm stores its DOM in terminal.element
      const el = managed.terminal.element;
      if (el) {
        container.appendChild(el);
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      if (managed.resizeRafId !== null) return;
      managed.resizeRafId = window.requestAnimationFrame(() => {
        managed.resizeRafId = null;
        if (!managed.container) return;
        managed.fitAddon.fit();
        const nextCols = managed.terminal.cols;
        const nextRows = managed.terminal.rows;
        const prev = managed.lastReportedSize;
        if (prev.cols === nextCols && prev.rows === nextRows) return;
        managed.lastReportedSize = { cols: nextCols, rows: nextRows };
        void invoke("terminal_resize", {
          terminalId,
          cols: nextCols,
          rows: nextRows,
        }).catch(() => {});
      });
    });
    resizeObserver.observe(container);
    managed.resizeObserver = resizeObserver;

    // Defer fit + PTY open until after layout so fit() gets real dimensions.
    window.requestAnimationFrame(() => {
      if (!managed.container) return;
      managed.fitAddon.fit();
      managed.lastReportedSize = {
        cols: managed.terminal.cols,
        rows: managed.terminal.rows,
      };

      if (managed.ptyReady) {
        // PTY already opened (e.g. by openPty for startup commands).
        // Just send a resize so the shell adapts to the actual viewport.
        void invoke("terminal_resize", {
          terminalId,
          cols: managed.terminal.cols,
          rows: managed.terminal.rows,
        }).catch(() => {});
      } else {
        // Open backend PTY with the real container dimensions.
        void this.ensurePtyOpen(
          terminalId,
          managed,
          managed.terminal.cols,
          managed.terminal.rows
        )
          .then(() => {
            void invoke("terminal_resize", {
              terminalId,
              cols: managed.terminal.cols,
              rows: managed.terminal.rows,
            }).catch(() => {});
          });
      }
    });

    managed.terminal.focus();
  }

  detach(terminalId: string): void {
    const managed = this.terminals.get(terminalId);
    if (!managed) return;
    this.detachInternal(managed);
  }

  private detachInternal(managed: ManagedTerminal): void {
    if (managed.resizeRafId !== null) {
      window.cancelAnimationFrame(managed.resizeRafId);
      managed.resizeRafId = null;
    }
    if (managed.resizeObserver) {
      managed.resizeObserver.disconnect();
      managed.resizeObserver = null;
    }
    // Remove terminal element from container without disposing
    if (managed.container && managed.terminal.element) {
      try {
        managed.container.removeChild(managed.terminal.element);
      } catch {
        // Element may already be removed
      }
    }
    managed.container = null;
  }

  destroy(terminalId: string): void {
    const managed = this.terminals.get(terminalId);
    if (!managed) return;

    this.detachInternal(managed);

    managed.inputDisposable?.dispose();
    managed.terminal.dispose();
    this.terminals.delete(terminalId);
    managed.ptyOpenPromise = null;

    // Clean up output buffering
    const rafId = this.flushRafIds.get(terminalId);
    if (rafId !== undefined) {
      window.cancelAnimationFrame(rafId);
      this.flushRafIds.delete(terminalId);
    }
    this.outputChunks.delete(terminalId);
    this.lastSeqByTerminal.delete(terminalId);

    void invoke("terminal_close", { terminalId }).catch(() => {});
  }

  destroyAllForProject(project: string): void {
    for (const [terminalId, managed] of this.terminals) {
      if (managed.project === project) {
        this.destroy(terminalId);
      }
    }
  }

  setTheme(mode: "dark" | "light"): void {
    this.currentTheme = mode;
    const theme = mode === "dark" ? DARK_THEME : LIGHT_THEME;
    for (const managed of this.terminals.values()) {
      managed.terminal.options.theme = theme;
      if (managed.opened) {
        managed.terminal.refresh(0, managed.terminal.rows - 1);
      }
    }
  }

  has(terminalId: string): boolean {
    return this.terminals.has(terminalId);
  }

  focus(terminalId: string): void {
    const managed = this.terminals.get(terminalId);
    if (managed) {
      managed.terminal.focus();
    }
  }

  /** Open the backend PTY without attaching to a DOM container.
   *  Output is still captured by the global listener and buffered in xterm
   *  so it will be visible when the terminal is later attached. */
  async openPty(terminalId: string): Promise<void> {
    const managed = this.terminals.get(terminalId);
    if (!managed || managed.ptyReady) return;

    await this.ensurePtyOpen(terminalId, managed, 120, 40);
  }

  /** Queue a command to be sent to the terminal. If the PTY is ready it is
   *  sent immediately, otherwise it is buffered until the PTY opens. */
  sendCommand(terminalId: string, command: string): void {
    const managed = this.terminals.get(terminalId);
    if (!managed) return;
    if (managed.ptyReady) {
      this.writeToPty(terminalId, managed, command + "\n");
    } else {
      managed.pendingCommands.push(command);
    }
  }

  private writeToPty(
    terminalId: string,
    managed: ManagedTerminal,
    data: string
  ): void {
    void invoke("terminal_write", { terminalId, data }).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("terminal session not found")) {
        return;
      }
      console.warn("[TerminalRegistry] terminal_write hit missing session, reopening", {
        terminalId,
      });

      managed.ptyReady = false;
      void this.ensurePtyOpen(
        terminalId,
        managed,
        managed.terminal.cols || 120,
        managed.terminal.rows || 40
      )
        .then(() => invoke("terminal_write", { terminalId, data }))
        .catch(() => {});
    });
  }

  disposeRegistry(): void {
    for (const terminalId of Array.from(this.terminals.keys())) {
      this.destroy(terminalId);
    }
    if (this.globalUnlisten) {
      try {
        this.globalUnlisten();
      } catch {
        // Ignore listener disposal errors.
      }
      this.globalUnlisten = null;
    }
    this.listenerSetupPromise = null;
  }
}

const TERMINAL_REGISTRY_GLOBAL_KEY = "__WEEKEND_TERMINAL_REGISTRY__";
const TERMINAL_REGISTRY_VERSION_KEY = "__WEEKEND_TERMINAL_REGISTRY_VERSION__";
const TERMINAL_REGISTRY_VERSION = 2;

type TerminalRegistryGlobalWindow = Window & {
  [TERMINAL_REGISTRY_GLOBAL_KEY]?: TerminalRegistry;
  [TERMINAL_REGISTRY_VERSION_KEY]?: number;
};

function hasTerminalRegistryShape(value: unknown): value is TerminalRegistry {
  if (!value || typeof value !== "object") return false;
  return (
    "acquire" in value &&
    typeof (value as { acquire?: unknown }).acquire === "function" &&
    "attach" in value &&
    typeof (value as { attach?: unknown }).attach === "function" &&
    "detach" in value &&
    typeof (value as { detach?: unknown }).detach === "function" &&
    "destroy" in value &&
    typeof (value as { destroy?: unknown }).destroy === "function" &&
    "disposeRegistry" in value &&
    typeof (value as { disposeRegistry?: unknown }).disposeRegistry === "function"
  );
}

function getSharedTerminalRegistry(): TerminalRegistry {
  if (typeof window === "undefined") {
    return new TerminalRegistry();
  }

  const globalWindow = window as TerminalRegistryGlobalWindow;
  const existing = globalWindow[TERMINAL_REGISTRY_GLOBAL_KEY];
  if (
    hasTerminalRegistryShape(existing) &&
    globalWindow[TERMINAL_REGISTRY_VERSION_KEY] === TERMINAL_REGISTRY_VERSION
  ) {
    return existing;
  }

  if (hasTerminalRegistryShape(existing)) {
    existing.disposeRegistry();
  }

  const created = new TerminalRegistry();
  globalWindow[TERMINAL_REGISTRY_GLOBAL_KEY] = created;
  globalWindow[TERMINAL_REGISTRY_VERSION_KEY] = TERMINAL_REGISTRY_VERSION;
  return created;
}

export const terminalRegistry = getSharedTerminalRegistry();

// Vite HMR: dispose the old registry so stale Tauri event listeners don't
// cause duplicate terminal output after a hot-module replacement.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    terminalRegistry.disposeRegistry();
    const w = window as TerminalRegistryGlobalWindow;
    delete w[TERMINAL_REGISTRY_GLOBAL_KEY];
    delete w[TERMINAL_REGISTRY_VERSION_KEY];
  });
}
