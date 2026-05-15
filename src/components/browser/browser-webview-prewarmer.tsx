import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceController } from "@/hooks/use-workspace-controller";
import type { WorkspaceControllerState } from "@/lib/controller";
import {
  buildManagedBrowserWebviewCacheKey,
  closeManagedBrowserWebviewsNotInProjects,
  getManagedBrowserWebview,
  prewarmManagedBrowserWebview,
  updateManagedBrowserWebviewLastUrl,
  updateManagedBrowserWebviewReadyState,
} from "@/lib/browser-webview-manager";
import {
  buildEmbeddedBrowserWebviewLabel,
  createEmbeddedBrowserWebview,
  type BrowserWebviewPageLoadPayload,
} from "@/lib/embedded-browser-webview";
import { MOCK_MODE } from "@/lib/tauri-mock";
import { buildBrowserSurfaceUrl } from "./browser-url-utils";
import { isBrowserRuntimeUrlReady } from "./browser-runtime-probe";
import { resolveBrowserRuntimeTarget } from "./browser-runtime";

const PREWARM_FRAME_VERSION = 0;
const PREWARM_RETRY_INTERVAL_MS = 700;

type BrowserPrewarmTarget = {
  cacheKey: string;
  label: string;
  project: string;
  url: string;
};

export function BrowserWebviewPrewarmer({
  activeProjectKey,
  controller,
  state,
}: {
  activeProjectKey?: string | null;
  controller: WorkspaceController;
  state: WorkspaceControllerState;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(false);
  const activeProjectKeyRef = useRef(activeProjectKey ?? null);
  const [prewarmRetryTick, setPrewarmRetryTick] = useState(0);
  const runningProjectKeys = useMemo(
    () =>
      state.projects.reduce((keys, project) => {
        if ((state.playStateByProject[project] ?? "idle") === "running") {
          keys.add(project);
        }
        return keys;
      }, new Set<string>()),
    [state.playStateByProject, state.projects],
  );
  const runningProjectKeysRef = useRef(runningProjectKeys);
  runningProjectKeysRef.current = runningProjectKeys;
  activeProjectKeyRef.current = activeProjectKey ?? null;

  const canPrewarmProject = useCallback(
    (project: string): boolean =>
      isMountedRef.current &&
      activeProjectKeyRef.current !== project &&
      runningProjectKeysRef.current.has(project),
    [],
  );

  const prewarmTargets = useMemo<BrowserPrewarmTarget[]>(() => {
    const targets: BrowserPrewarmTarget[] = [];

    for (const project of state.projects) {
      if (project === activeProjectKey) continue;
      const playState = state.playStateByProject[project] ?? "idle";
      const hasHealthyRuntimeProcess =
        state.runtimeProcessHealthyByProject[project] ?? false;
      const projectConfigSnapshot =
        state.projectConfigSnapshotByProject[project] ?? null;
      const isProjectConfigLoading =
        state.projectConfigLoadingByProject[project] ?? false;
      const projectConfigError =
        state.projectConfigErrorByProject[project] ?? null;
      const browserTarget = resolveBrowserRuntimeTarget({
        projectId: project,
        playState,
        hasHealthyRuntimeProcess,
        isProjectConfigLoading,
        projectConfigError,
        projectConfigSnapshot,
      });
      if (browserTarget.status !== "ready" || !browserTarget.url) continue;

      const url = buildBrowserSurfaceUrl(browserTarget.url);
      const cacheKey = buildManagedBrowserWebviewCacheKey(
        project,
        PREWARM_FRAME_VERSION,
      );
      const cached = getManagedBrowserWebview(cacheKey);
      if (cached?.isReady && cached.lastUrl === url) continue;

      targets.push({
        cacheKey,
        label: buildEmbeddedBrowserWebviewLabel(project, PREWARM_FRAME_VERSION),
        project,
        url,
      });
    }

    return targets;
  }, [
    activeProjectKey,
    prewarmRetryTick,
    state.playStateByProject,
    state.projectConfigErrorByProject,
    state.projectConfigLoadingByProject,
    state.projectConfigSnapshotByProject,
    state.projects,
    state.runtimeProcessHealthyByProject,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (MOCK_MODE) return;
    void closeManagedBrowserWebviewsNotInProjects(runningProjectKeys);
  }, [runningProjectKeys]);

  useEffect(() => {
    if (MOCK_MODE) return;
    if (prewarmTargets.length === 0) return;

    const intervalId = window.setInterval(() => {
      setPrewarmRetryTick((tick) => tick + 1);
    }, PREWARM_RETRY_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [prewarmTargets.length]);

  useEffect(() => {
    for (const project of state.projects) {
      const playState = state.playStateByProject[project] ?? "idle";
      const hasHealthyRuntimeProcess =
        state.runtimeProcessHealthyByProject[project] ?? false;
      if (playState !== "running" || !hasHealthyRuntimeProcess) continue;
      if (state.projectConfigSnapshotByProject[project]) continue;
      if (state.projectConfigLoadingByProject[project]) continue;
      if ((state.projectConfigErrorByProject[project] ?? null) !== null) {
        continue;
      }

      void controller.refreshProjectConfig(project).catch(() => undefined);
    }
  }, [
    controller,
    state.playStateByProject,
    state.projectConfigErrorByProject,
    state.projectConfigLoadingByProject,
    state.projectConfigSnapshotByProject,
    state.projects,
    state.runtimeProcessHealthyByProject,
  ]);

  useEffect(() => {
    if (MOCK_MODE) return;
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;

    for (const { cacheKey, label, project, url } of prewarmTargets) {
      const handlePageLoad = (payload: BrowserWebviewPageLoadPayload): void => {
        if (cancelled || !canPrewarmProject(project)) return;
        if (payload.phase === "started") {
          updateManagedBrowserWebviewReadyState(cacheKey, false);
          updateManagedBrowserWebviewLastUrl(cacheKey, payload.url);
          return;
        }
        updateManagedBrowserWebviewLastUrl(cacheKey, payload.url);
        void isBrowserRuntimeUrlReady(payload.url).then((isReady) => {
          if (cancelled || !canPrewarmProject(project)) return;
          updateManagedBrowserWebviewReadyState(cacheKey, isReady);
        });
      };

      void (async () => {
        if (cancelled || !canPrewarmProject(project)) return;
        if (!(await isBrowserRuntimeUrlReady(url))) return;
        if (cancelled || !canPrewarmProject(project)) return;

        await prewarmManagedBrowserWebview({
          cacheKey,
          createHandle: () =>
            createEmbeddedBrowserWebview({
              container: host,
              label,
              onPageLoad: handlePageLoad,
              url,
            }),
          frameVersion: PREWARM_FRAME_VERSION,
          isCurrent: () => !cancelled && canPrewarmProject(project),
          onPageLoad: handlePageLoad,
          projectKey: project,
          url,
        });
      })().catch((error) => {
        console.warn("[Browser] prewarm failed", {
          error,
          project,
          url,
        });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [canPrewarmProject, prewarmTargets]);

  if (MOCK_MODE) return null;

  return (
    <div
      aria-hidden
      ref={hostRef}
      className="pointer-events-none fixed h-px w-px overflow-hidden opacity-0"
      style={{ left: -10000, top: -10000 }}
    />
  );
}
