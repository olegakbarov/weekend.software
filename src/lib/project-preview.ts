import { invoke } from "@tauri-apps/api/core";

export async function loadProjectPreview(
  project: string
): Promise<string | null> {
  try {
    return await invoke<string | null>("project_load_preview", { project });
  } catch (error) {
    console.warn("[project-preview] load failed", { project, error });
    return null;
  }
}

export async function saveProjectPreview(
  project: string,
  dataUrl: string
): Promise<void> {
  await invoke<void>("project_save_preview", { project, dataUrl });
}

type Capturer = () => Promise<void>;
const capturers = new Map<string, Capturer>();

export function registerPreviewCapturer(
  project: string,
  capturer: Capturer
): () => void {
  capturers.set(project, capturer);
  return () => {
    if (capturers.get(project) === capturer) {
      capturers.delete(project);
    }
  };
}

export async function runRegisteredPreviewCapturer(
  project: string
): Promise<void> {
  const capturer = capturers.get(project);
  if (!capturer) return;
  try {
    await capturer();
  } catch (error) {
    console.warn("[project-preview] capturer threw", { project, error });
  }
}

type CapturedListener = (project: string, dataUrl: string) => void;
const capturedListeners = new Set<CapturedListener>();

export function onPreviewCaptured(listener: CapturedListener): () => void {
  capturedListeners.add(listener);
  return () => {
    capturedListeners.delete(listener);
  };
}

export function notifyPreviewCaptured(project: string, dataUrl: string): void {
  for (const listener of Array.from(capturedListeners)) {
    try {
      listener(project, dataUrl);
    } catch (error) {
      console.warn("[project-preview] listener threw", { project, error });
    }
  }
}
