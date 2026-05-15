import { invoke } from "@tauri-apps/api/core";
import { isLocalDevUrl } from "./browser-url-utils";

export type BrowserRuntimeProbeResult = {
  ready: boolean;
  statusCode: number | null;
  error: string | null;
};

export async function probeBrowserRuntimeReadiness(
  url: string,
): Promise<BrowserRuntimeProbeResult> {
  return await invoke<BrowserRuntimeProbeResult>("browser_probe_runtime_url", {
    url,
  });
}

export async function isBrowserRuntimeUrlReady(url: string): Promise<boolean> {
  if (!isLocalDevUrl(url)) return true;

  try {
    const result = await probeBrowserRuntimeReadiness(url);
    return result.ready;
  } catch {
    return false;
  }
}
