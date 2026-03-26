import { invoke } from "@tauri-apps/api/core";
import { toErrorMessage } from "@/lib/utils/error";
import type { ControllerContext } from "./types";

export async function refreshSharedEnv(
  ctx: ControllerContext
): Promise<void> {
  ctx.setState((previous) => ({
    ...previous,
    sharedEnvLoading: true,
    sharedEnvError: null,
  }));

  try {
    const env = await invoke<Record<string, string>>("shared_env_read");
    ctx.setState((previous) => ({
      ...previous,
      sharedEnv: env,
      sharedEnvLoading: false,
      sharedEnvError: null,
    }));
  } catch (error) {
    ctx.setState((previous) => ({
      ...previous,
      sharedEnvLoading: false,
      sharedEnvError: toErrorMessage(error),
    }));
    throw error;
  }
}

export async function updateSharedEnv(
  ctx: ControllerContext,
  env: Record<string, string>
): Promise<void> {
  ctx.setState((previous) => ({
    ...previous,
    sharedEnvLoading: true,
    sharedEnvError: null,
  }));

  try {
    const result = await invoke<Record<string, string>>("shared_env_write", {
      env,
    });
    ctx.setState((previous) => ({
      ...previous,
      sharedEnv: result,
      sharedEnvLoading: false,
      sharedEnvError: null,
    }));
  } catch (error) {
    ctx.setState((previous) => ({
      ...previous,
      sharedEnvLoading: false,
      sharedEnvError: toErrorMessage(error),
    }));
    throw error;
  }
}
