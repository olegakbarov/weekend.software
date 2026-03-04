import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { BrowserPane } from "@/components/browser/browser-pane";
import { ProjectEditorPane } from "@/components/editor/project-editor-pane";
import { HomePage } from "@/components/home/home-page";
import { ProjectSettingsPage } from "@/components/settings/project-settings-page";
import { SettingsPage } from "@/components/settings/settings-page";
import {
  LogsPage,
  type WeekendLogsSnapshot,
} from "@/components/logs/logs-page";
import { TerminalView } from "@/components/terminal/terminal-view";
import { Sidebar } from "@/components/sidebar/sidebar";
import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
} from "@/lib/utils/safe-local-storage";
import { cn } from "@/lib/utils";
import {
  createWorkspaceController,
  type CreateProjectInput,
} from "@/lib/workspace-controller";
import type { ActiveView } from "@/lib/types";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const VIM_MODE_STORAGE_KEY = "weekend.editor.vim-mode-enabled";
const FULLSCREEN_SIDEBAR_EDGE_TRIGGER_WIDTH_PX = 3;
const FULLSCREEN_SIDEBAR_WIDTH_PX = 260;

function readPersistedVimMode(): boolean {
  const persisted = safeLocalStorageGetItem(VIM_MODE_STORAGE_KEY);
  if (persisted === "0") return false;
  return true;
}

function hasTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const internals = (window as { __TAURI_INTERNALS__?: { invoke?: unknown } })
    .__TAURI_INTERNALS__;
  return !!internals && typeof internals.invoke === "function";
}

export function App() {
  const workspaceController = useMemo(() => createWorkspaceController(), []);
  const workspaceState = useSyncExternalStore(
    workspaceController.subscribe,
    workspaceController.getState,
    workspaceController.getState
  );

  const [activeView, setActiveView] = useState<ActiveView>({
    route: "settings",
  });
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isArchivingProject, setIsArchivingProject] = useState(false);
  const [isVimModeEnabled, setIsVimModeEnabled] = useState(() =>
    readPersistedVimMode()
  );
  const [isWindowFullscreen, setIsWindowFullscreen] = useState(false);
  const [isFullscreenSidebarVisible, setIsFullscreenSidebarVisible] =
    useState(false);
  const [selectedEditorFilePathByProject, setSelectedEditorFilePathByProject] =
    useState<Record<string, string | null>>({});
  const [lastNonTerminalViewByProject, setLastNonTerminalViewByProject] =
    useState<Record<string, "browser" | "editor">>({});

  const [isRefreshingRuntimeSnapshot, setIsRefreshingRuntimeSnapshot] =
    useState(false);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [weekendLogsSnapshot, setWeekendLogsSnapshot] =
    useState<WeekendLogsSnapshot | null>(null);
  const isRefreshingLogsRef = useRef(false);
  const hasAutoSelectedInitialProjectRef = useRef(false);
  const workspaceModeHotkeyRef = useRef<
    (mode: "browser" | "editor" | "agent") => void
  >(() => undefined);

  const projects = workspaceState.projects;
  const workspaceSelectedProject = workspaceState.selectedProject;
  const selectedProject =
    activeView.route === "workspace" ? activeView.project : null;
  const selectedProjectTree = selectedProject
    ? workspaceState.projectTreeByProject[selectedProject] ?? []
    : [];
  const selectedEditorFilePath = selectedProject
    ? selectedEditorFilePathByProject[selectedProject] ?? null
    : null;
  const activeProjectKey = selectedProject ?? "__root__";
  const activeTerminalId =
    activeView.route === "workspace" && activeView.view.kind === "terminal"
      ? activeView.view.terminalId
      : null;
  const activeTerminalSession = activeTerminalId && selectedProject
    ? (workspaceState.terminalSessionsByProject[selectedProject] ?? []).find(
        (s) => s.terminalId === activeTerminalId
      ) ?? null
    : null;
  // displayName is kept current by the backend process watcher (every 2s),
  // which resolves the foreground process and humanizes it (e.g. "Claude", "Node.js").
  const activeTerminalLabel = activeTerminalSession?.displayName ?? null;

  const selectedProjectConfigSnapshot = selectedProject
    ? workspaceState.projectConfigSnapshotByProject[selectedProject] ?? null
    : null;
  const isSelectedProjectConfigLoading = selectedProject
    ? workspaceState.projectConfigLoadingByProject[selectedProject] ?? false
    : false;
  const selectedProjectConfigError = selectedProject
    ? workspaceState.projectConfigErrorByProject[selectedProject] ?? null
    : null;
  const selectedProjectPlayState = selectedProject
    ? workspaceState.playStateByProject[selectedProject] ?? "idle"
    : "idle";
  const selectedProjectFilesystemEventVersion = selectedProject
    ? workspaceState.filesystemEventVersionByProject[selectedProject] ?? 0
    : workspaceState.filesystemEventVersion;
  const selectedProjectHasHealthyRuntimeProcess = selectedProject
    ? workspaceState.runtimeProcessHealthyByProject[selectedProject] ?? false
    : false;
  const sharedAssets = workspaceState.sharedAssets;
  const sharedAssetsError = workspaceState.sharedAssetsError;
  const isSharedAssetsLoading = workspaceState.sharedAssetsLoading;
  const isSharedAssetsUploading = workspaceState.sharedAssetsUploading;
  const handleSelectedFilePathChange = useCallback(
    (path: string | null) => {
      if (!selectedProject) return;
      setSelectedEditorFilePathByProject((previous) => ({
        ...previous,
        [selectedProject]: path,
      }));
    },
    [selectedProject]
  );
  const handleProjectTreeMutated = useCallback(
    async (project: string) => {
      await workspaceController.refreshProjectTree(project);
    },
    [workspaceController]
  );
  const getNonTerminalViewForProject = useCallback(
    (project: string): "browser" | "editor" => {
      const remembered = lastNonTerminalViewByProject[project];
      if (remembered) return remembered;
      const playState = workspaceState.playStateByProject[project] ?? "idle";
      return playState === "running" ? "browser" : "editor";
    },
    [lastNonTerminalViewByProject, workspaceState.playStateByProject]
  );

  // Initialize workspace controller
  useEffect(() => {
    void workspaceController.init().catch(() => undefined);
    return () => {
      void workspaceController.dispose();
    };
  }, [workspaceController]);

  useEffect(() => {
    safeLocalStorageSetItem(
      VIM_MODE_STORAGE_KEY,
      isVimModeEnabled ? "1" : "0"
    );
  }, [isVimModeEnabled]);

  useEffect(() => {
    if (!hasTauriRuntime()) return;

    let disposed = false;
    let unlistenResized: (() => void) | null = null;
    const currentWindow = getCurrentWindow();

    const syncFullscreenState = async () => {
      try {
        const fullscreen = await currentWindow.isFullscreen();
        if (disposed) return;
        setIsWindowFullscreen(fullscreen);
      } catch {
        // Ignore if fullscreen state cannot be read in non-Tauri contexts.
      }
    };

    void syncFullscreenState();
    void currentWindow
      .onResized(() => {
        void syncFullscreenState();
      })
      .then((unlisten) => {
        if (disposed) {
          void unlisten();
          return;
        }
        unlistenResized = unlisten;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      if (unlistenResized) {
        void unlistenResized();
      }
    };
  }, []);

  useEffect(() => {
    if (!isWindowFullscreen) {
      setIsFullscreenSidebarVisible(false);
      return;
    }
    // Fullscreen should start with the sidebar hidden until the left edge is hovered.
    setIsFullscreenSidebarVisible(false);
  }, [isWindowFullscreen]);

  // Auto-select first project only once on initial load.
  useEffect(() => {
    if (hasAutoSelectedInitialProjectRef.current) return;
    if (activeView.route !== "settings") {
      hasAutoSelectedInitialProjectRef.current = true;
      return;
    }
    if (projects.length === 0) return;
    const first = projects[0];
    if (!first) return;
    hasAutoSelectedInitialProjectRef.current = true;
    setActiveView({
      route: "workspace",
      project: first,
      view: { kind: "browser" },
    });
  }, [projects, activeView.route]);

  useEffect(() => {
    if (activeView.route !== "workspace") return;
    if (activeView.view.kind !== "browser" && activeView.view.kind !== "editor") {
      return;
    }

    const { project } = activeView;
    const nextKind = activeView.view.kind;
    setLastNonTerminalViewByProject((previous) => {
      if (previous[project] === nextKind) return previous;
      return {
        ...previous,
        [project]: nextKind,
      };
    });
  }, [activeView]);

  useEffect(() => {
    if (activeView.route !== "workspace" || activeView.view.kind !== "terminal") {
      return;
    }
    const activeProject = activeView.project;
    const activeTerminal = activeView.view.terminalId;

    const hasTerminalInProject =
      (workspaceState.terminalSessionsByProject[activeProject] ?? []).some(
        (session) => session.terminalId === activeTerminal
      );
    if (!hasTerminalInProject) {
      setActiveView((prev) => {
        if (
          prev.route !== "workspace" ||
          prev.project !== activeProject ||
          prev.view.kind !== "terminal" ||
          prev.view.terminalId !== activeTerminal
        ) {
          return prev;
        }
        return {
          ...prev,
          view: { kind: getNonTerminalViewForProject(activeProject) },
        };
      });
    }
  }, [activeView, getNonTerminalViewForProject, workspaceState.terminalSessionsByProject]);

  useEffect(() => {
    if (!selectedProject) return;
    if (selectedProjectConfigSnapshot) return;
    if (isSelectedProjectConfigLoading) return;
    if (selectedProjectConfigError !== null) return;
    void workspaceController.refreshProjectConfig(selectedProject).catch(() => undefined);
  }, [
    isSelectedProjectConfigLoading,
    selectedProject,
    selectedProjectConfigError,
    selectedProjectConfigSnapshot,
    workspaceController,
  ]);

  const createProject = async (input: CreateProjectInput) => {
    if (isCreatingProject) return;
    setIsCreatingProject(true);
    try {
      const created = await workspaceController.createProject(input);
      setActiveView({
        route: "workspace",
        project: created,
        view: { kind: "browser" },
      });
    } finally {
      setIsCreatingProject(false);
    }
  };

  const deleteSelectedProject = async () => {
    if (isDeletingProject || !selectedProject) return;
    const projectToDelete = selectedProject;
    setIsDeletingProject(true);
    try {
      await workspaceController.deleteProject(projectToDelete);
      // Navigate to first remaining project or settings
      const remaining = workspaceState.projects.filter(
        (p) => p !== projectToDelete
      );
      if (remaining.length > 0) {
        setActiveView({
          route: "workspace",
          project: remaining[0]!,
          view: { kind: "browser" },
        });
      } else {
        setActiveView({ route: "settings" });
      }
    } finally {
      setIsDeletingProject(false);
    }
  };

  const archiveSelectedProject = async () => {
    if (isArchivingProject || !selectedProject) return;
    const projectToArchive = selectedProject;
    setIsArchivingProject(true);
    try {
      await workspaceController.archiveProject(projectToArchive);
      // Navigate to first remaining project or settings
      const remaining = workspaceState.projects.filter(
        (p) => p !== projectToArchive
      );
      if (remaining.length > 0) {
        setActiveView({
          route: "workspace",
          project: remaining[0]!,
          view: { kind: "browser" },
        });
      } else {
        setActiveView({ route: "settings" });
      }
    } finally {
      setIsArchivingProject(false);
    }
  };

  const handleUnarchiveProject = useCallback(
    async (project: string) => {
      await workspaceController.unarchiveProject(project);
      setActiveView({
        route: "workspace",
        project,
        view: { kind: "browser" },
      });
    },
    [workspaceController]
  );

  const handleToggleShowArchived = useCallback(() => {
    workspaceController.toggleShowArchived();
  }, [workspaceController]);

  const handleRenameProject = useCallback(
    async (oldName: string, newName: string) => {
      const resolvedName = await workspaceController.renameProject(oldName, newName);
      setActiveView((prev) => {
        if (prev.route !== "workspace" || prev.project !== oldName) return prev;
        return { ...prev, project: resolvedName };
      });
    },
    [workspaceController]
  );

  const handleReorderProjects = useCallback(
    (reordered: string[]) => {
      workspaceController.reorderProjects(reordered);
    },
    [workspaceController]
  );

  const handleSelectBrowser = useCallback(
    (project: string) => {
      workspaceController.selectProject(project);
      setActiveView({
        route: "workspace",
        project,
        view: { kind: "browser" },
      });
    },
    [workspaceController]
  );

  const handleSelectTerminal = useCallback(
    (project: string, terminalId: string) => {
      workspaceController.selectProject(project);
      setActiveView({
        route: "workspace",
        project,
        view: { kind: "terminal", terminalId },
      });
    },
    [workspaceController]
  );

  const handleCreateTerminal = useCallback(
    (project: string) => {
      const descriptor = workspaceController.createTerminalSession(project);
      workspaceController.selectProject(project);
      setActiveView({
        route: "workspace",
        project,
        view: { kind: "terminal", terminalId: descriptor.terminalId },
      });
    },
    [workspaceController]
  );

  const handlePlay = useCallback(
    (project: string) => {
      void workspaceController
        .playProject(project)
        .then(() => {
          workspaceController.selectProject(project);
          const playState =
            workspaceController.getState().playStateByProject[project] ?? "idle";
          if (playState === "failed") {
            return;
          }
          setActiveView({
            route: "workspace",
            project,
            view: { kind: "browser" },
          });
        })
        .catch(() => undefined);
    },
    [workspaceController]
  );

  const handleStop = useCallback(
    (project: string) => {
      workspaceController.stopProject(project);
    },
    [workspaceController]
  );

  const handlePlayFromSettings = useCallback(async () => {
    if (!selectedProject) return;
    try {
      await workspaceController.playProject(selectedProject);
    } catch {
      // Failed state/error text is synchronized via workspace controller state.
    }
  }, [selectedProject, workspaceController]);

  const handleStopFromSettings = useCallback(() => {
    if (!selectedProject) return;
    workspaceController.stopProject(selectedProject);
  }, [selectedProject, workspaceController]);

  const handlePlayFromBrowser = useCallback(
    (project: string) => {
      void workspaceController
        .playProject(project)
        .then(() => {
          workspaceController.selectProject(project);
        })
        .catch(() => undefined);
    },
    [workspaceController]
  );

  const handleRemoveTerminal = useCallback(
    (terminalId: string) => {
      workspaceController.removeTerminalSession(terminalId);
      setActiveView((prev) => {
        if (
          prev.route !== "workspace" ||
          prev.view.kind !== "terminal" ||
          prev.view.terminalId !== terminalId
        ) {
          return prev;
        }
        return {
          ...prev,
          view: { kind: getNonTerminalViewForProject(prev.project) },
        };
      });
    },
    [getNonTerminalViewForProject, workspaceController]
  );

  const switchWorkspaceMode = useCallback(
    (mode: "browser" | "editor" | "agent" | "settings") => {
      if (activeView.route !== "workspace") return;
      const { project } = activeView;

      if (mode === "browser") {
        setActiveView({
          route: "workspace",
          project,
          view: { kind: "browser" },
        });
        return;
      }

      if (mode === "editor") {
        setActiveView({
          route: "workspace",
          project,
          view: { kind: "editor" },
        });
        return;
      }

      if (mode === "settings") {
        setActiveView({
          route: "workspace",
          project,
          view: { kind: "settings" },
        });
        return;
      }

      const agentId =
        workspaceController.getAgentTerminalId(project) ??
        workspaceController.ensureAgentTerminalSession(project);
      setActiveView({
        route: "workspace",
        project,
        view: {
          kind: "terminal",
          terminalId: agentId,
        },
      });
    },
    [
      activeView,
      workspaceController,
    ]
  );

  useEffect(() => {
    workspaceModeHotkeyRef.current = switchWorkspaceMode;
  }, [switchWorkspaceMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          setActiveView({ route: "home" });
          break;
        case "j":
          e.preventDefault();
          workspaceModeHotkeyRef.current("browser");
          break;
        case "k":
          e.preventDefault();
          workspaceModeHotkeyRef.current("agent");
          break;
        case "l":
          e.preventDefault();
          workspaceModeHotkeyRef.current("editor");
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const openHome = useCallback(() => {
    setActiveView({ route: "home" });
  }, []);

  const closeHome = useCallback(() => {
    const fallbackProject =
      workspaceSelectedProject && projects.includes(workspaceSelectedProject)
        ? workspaceSelectedProject
        : projects[0] ?? null;
    if (!fallbackProject) {
      setActiveView({ route: "settings" });
      return;
    }
    setActiveView({
      route: "workspace",
      project: fallbackProject,
      view: { kind: getNonTerminalViewForProject(fallbackProject) },
    });
  }, [getNonTerminalViewForProject, projects, workspaceSelectedProject]);

  const openSettings = useCallback(() => {
    setActiveView({ route: "settings" });
  }, []);

  const openLogs = useCallback(() => {
    setActiveView({ route: "logs" });
  }, []);

  const handleWorkspaceModeChange = useCallback(
    (mode: "browser" | "editor" | "agent" | "settings") => {
      switchWorkspaceMode(mode);
    },
    [switchWorkspaceMode]
  );

  const handleElementGrabbed = useCallback(
    (data: {
      tag: string;
      id: string;
      className: string;
      text: string;
      selector: string;
      outerHTML?: string;
    }) => {
      if (activeView.route !== "workspace") return;
      const project = activeView.project;
      workspaceController.selectProject(project);

      const agentTerminalId =
        workspaceController.getAgentTerminalId(project) ??
        workspaceController.ensureAgentTerminalSession(project);
      setActiveView({
        route: "workspace",
        project,
        view: {
          kind: "terminal",
          terminalId: agentTerminalId,
        },
      });

      const tagPart =
        data.tag +
        (data.id ? `#${data.id}` : "") +
        (data.className
          ? `.${data.className.trim().split(/\s+/).join(".")}`
          : "");
      const textSnippet = data.text ? data.text.slice(0, 200) : "";
      const htmlSnippet = data.outerHTML ? data.outerHTML.slice(0, 500) : "";
      const formatted = [
        "",
        `DOM node selected: <${tagPart}>`,
        `selector: ${data.selector}`,
        textSnippet ? `text: ${textSnippet}` : null,
        htmlSnippet ? `html: ${htmlSnippet}` : null,
        "",
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n");

      void invoke("terminal_write", {
        terminalId: agentTerminalId,
        data: formatted,
      }).catch(() => undefined);
    },
    [activeView, workspaceController]
  );

  const refreshRuntimeSnapshot = useCallback(() => {
    if (isRefreshingRuntimeSnapshot) return;
    setIsRefreshingRuntimeSnapshot(true);
    void workspaceController
      .refreshRuntimeSnapshot()
      .catch(() => undefined)
      .finally(() => {
        setIsRefreshingRuntimeSnapshot(false);
      });
  }, [isRefreshingRuntimeSnapshot, workspaceController]);

  const refreshSharedAssets = useCallback(() => {
    void workspaceController.refreshSharedAssets().catch(() => undefined);
  }, [workspaceController]);

  const handleUploadSharedAssets = useCallback(
    async (files: File[]) => {
      await workspaceController.uploadSharedAssets(files);
    },
    [workspaceController]
  );

  const refreshLogs = useCallback(() => {
    if (isRefreshingLogsRef.current) return;
    isRefreshingLogsRef.current = true;
    setIsRefreshingLogs(true);
    setLogsError(null);

    void invoke<WeekendLogsSnapshot>("logs_read_weekend", { maxBytes: 200000 })
      .then((weekendLogs) => {
        setWeekendLogsSnapshot(weekendLogs);
      })
      .catch((error) => {
        setLogsError(toErrorMessage(error));
      })
      .finally(() => {
        isRefreshingLogsRef.current = false;
        setIsRefreshingLogs(false);
      });
  }, []);

  useEffect(() => {
    if (activeView.route !== "logs") return;
    refreshLogs();
  }, [activeView.route, refreshLogs]);

  useEffect(() => {
    if (activeView.route !== "settings") return;
    refreshSharedAssets();
  }, [activeView.route, refreshSharedAssets]);

  const sidebar = (
    <Sidebar
      activeView={activeView}
      activeTerminalId={activeTerminalId}
      isFullscreen={isWindowFullscreen}
      onCreateTerminal={handleCreateTerminal}
      onOpenHome={openHome}
      onOpenLogs={openLogs}
      onOpenSettings={openSettings}
      onRenameTerminal={(terminalId, newLabel) => {
        workspaceController.renameTerminalSession(terminalId, newLabel);
      }}
      onPlay={handlePlay}
      onStop={handleStop}
      onRemoveTerminal={handleRemoveTerminal}
      onReorderProjects={handleReorderProjects}
      onRenameProject={handleRenameProject}
      onSelectBrowser={handleSelectBrowser}
      onSelectTerminal={handleSelectTerminal}
      playStateByProject={workspaceState.playStateByProject}
      playErrorByProject={workspaceState.playErrorByProject}
      projects={projects}
      terminalSessionsByProject={workspaceState.terminalSessionsByProject}
      showArchived={workspaceState.showArchived}
      archivedProjects={workspaceState.archivedProjects}
      onToggleShowArchived={handleToggleShowArchived}
      onUnarchiveProject={handleUnarchiveProject}
    />
  );

  return (
    <div className="relative flex h-screen flex-row bg-background text-foreground">
      {isWindowFullscreen ? (
        <>
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 z-40"
            onMouseEnter={() => {
              setIsFullscreenSidebarVisible(true);
            }}
            style={{ width: `${FULLSCREEN_SIDEBAR_EDGE_TRIGGER_WIDTH_PX}px` }}
          />
          <div
            className={cn(
              "relative z-50 h-full shrink-0 overflow-hidden transition-[width] duration-150 ease-out"
            )}
            style={{
              width: isFullscreenSidebarVisible
                ? `${FULLSCREEN_SIDEBAR_WIDTH_PX}px`
                : "0px",
            }}
            onMouseLeave={() => {
              setIsFullscreenSidebarVisible(false);
            }}
          >
            <div
              className="h-full"
              style={{ width: `${FULLSCREEN_SIDEBAR_WIDTH_PX}px` }}
            >
              {sidebar}
            </div>
          </div>
        </>
      ) : (
        sidebar
      )}
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {activeView.route === "home" ? (
          <HomePage
            isCreatingProject={isCreatingProject}
            onCreateProject={createProject}
          />
        ) : activeView.route === "settings" ? (
          <SettingsPage
            error={workspaceState.runtimeDebugError}
            isRefreshing={isRefreshingRuntimeSnapshot}
            isSharedAssetsLoading={isSharedAssetsLoading}
            isSharedAssetsUploading={isSharedAssetsUploading}
            isVimModeEnabled={isVimModeEnabled}
            onRefreshSharedAssets={refreshSharedAssets}
            onVimModeEnabledChange={setIsVimModeEnabled}
            onRefreshRuntimeSnapshot={refreshRuntimeSnapshot}
            onUploadSharedAssets={handleUploadSharedAssets}
            sharedAssets={sharedAssets}
            sharedAssetsError={sharedAssetsError}
            snapshot={workspaceState.runtimeDebugSnapshot}
          />
        ) : activeView.route === "logs" ? (
          <LogsPage
            weekendLogs={weekendLogsSnapshot}
            error={logsError}
            isRefreshing={isRefreshingLogs}
            onRefresh={refreshLogs}
          />
        ) : (
          <div className="relative min-h-0 flex flex-1 flex-col overflow-hidden">
            <BrowserPane
              agentContent={
                activeView.route === "workspace" &&
                activeView.view.kind === "terminal" &&
                selectedProject ? (
                  <TerminalView
                    key={activeView.view.terminalId}
                    project={selectedProject}
                    terminalId={activeView.view.terminalId}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="font-code text-sm text-muted-foreground/50">
                      No terminal selected
                    </p>
                  </div>
                )
              }
              editorContent={
                activeView.route === "workspace" && selectedProject ? (
                  <ProjectEditorPane
                    isVimModeEnabled={isVimModeEnabled}
                    onVimModeEnabledChange={setIsVimModeEnabled}
                    onProjectTreeMutated={handleProjectTreeMutated}
                    project={selectedProject}
                    projectTree={selectedProjectTree}
                    requestedFilePath={selectedEditorFilePath}
                    onSelectedFilePathChange={handleSelectedFilePathChange}
                  />
                ) : null
              }
              settingsContent={
                activeView.route === "workspace" && selectedProject ? (
                  <ProjectSettingsPage
                    project={selectedProject}
                    configPath={selectedProjectConfigSnapshot?.configPath ?? null}
                    playState={selectedProjectPlayState}
                    playError={
                      workspaceState.playErrorByProject[selectedProject] ?? null
                    }
                    onPlayProject={handlePlayFromSettings}
                    onStopProject={handleStopFromSettings}
                    isArchivingProject={isArchivingProject}
                    onArchiveProject={archiveSelectedProject}
                    isDeletingProject={isDeletingProject}
                    onDeleteProject={deleteSelectedProject}
                  />
                ) : null
              }
              agentTerminalLabel={activeTerminalLabel}
              onElementGrabbed={handleElementGrabbed}
              onWorkspaceModeChange={handleWorkspaceModeChange}
              onPlayProject={handlePlayFromBrowser}
              playState={selectedProjectPlayState}
              projectConfigError={selectedProjectConfigError}
              projectConfigSnapshot={selectedProjectConfigSnapshot}
              projectKey={activeProjectKey}
              filesystemEventVersion={selectedProjectFilesystemEventVersion}
              selectedProject={selectedProject}
              hasHealthyRuntimeProcess={selectedProjectHasHealthyRuntimeProcess}
              selectedEditorFilePath={selectedEditorFilePath}
              workspaceMode={
                activeView.route === "workspace"
                  ? activeView.view.kind === "editor"
                    ? "editor"
                    : activeView.view.kind === "settings"
                      ? "settings"
                    : activeView.view.kind === "terminal"
                      ? activeTerminalSession?.processRole === "agent"
                        ? "agent"
                        : "terminal"
                      : "browser"
                  : "browser"
              }
              isProjectConfigLoading={isSelectedProjectConfigLoading}
            />
          </div>
        )}
      </main>
    </div>
  );
}
