import { invoke } from "@tauri-apps/api/core";
import { toErrorMessage } from "@/lib/utils/error";
import {
  type ControllerContext,
  type SharedAssetSnapshot,
  type SharedAssetUploadInput,
} from "./types";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(`failed to read "${file.name}"`));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error(`failed to read "${file.name}"`));
    };
    reader.readAsDataURL(file);
  });
}

async function toSharedAssetUploadPayload(
  file: File
): Promise<SharedAssetUploadInput> {
  const dataUrl = await readFileAsDataUrl(file);
  const commaIndex = dataUrl.indexOf(",");
  const dataBase64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  return {
    fileName: file.name,
    dataBase64,
  };
}

export async function refreshSharedAssets(
  ctx: ControllerContext
): Promise<void> {
  ctx.setState((previous) => ({
    ...previous,
    sharedAssetsLoading: true,
    sharedAssetsError: null,
  }));

  try {
    const assets = await invoke<SharedAssetSnapshot[]>("shared_assets_list");
    ctx.setState((previous) => ({
      ...previous,
      sharedAssets: assets,
      sharedAssetsLoading: false,
      sharedAssetsError: null,
    }));
  } catch (error) {
    ctx.setState((previous) => ({
      ...previous,
      sharedAssetsLoading: false,
      sharedAssetsError: toErrorMessage(error),
    }));
    throw error;
  }
}

export async function uploadSharedAssets(
  ctx: ControllerContext,
  files: File[]
): Promise<void> {
  const selectedFiles = files.filter((file) => file.name.trim().length > 0);
  if (selectedFiles.length === 0) return;

  const payload = await Promise.all(
    selectedFiles.map((file) => toSharedAssetUploadPayload(file))
  );

  await runSharedAssetsMutation(ctx, () =>
    invoke<SharedAssetSnapshot[]>("shared_assets_upload_batch", {
      files: payload,
    })
  );
}

export async function renameSharedAsset(
  ctx: ControllerContext,
  fileName: string,
  newFileName: string
): Promise<void> {
  const currentName = fileName.trim();
  const nextName = newFileName.trim();
  if (!currentName || !nextName || currentName === nextName) return;

  await runSharedAssetsMutation(ctx, () =>
    invoke<SharedAssetSnapshot[]>("shared_assets_rename", {
      fileName: currentName,
      newFileName: nextName,
    })
  );
}

export async function deleteSharedAsset(
  ctx: ControllerContext,
  fileName: string
): Promise<void> {
  const normalizedName = fileName.trim();
  if (!normalizedName) return;

  await runSharedAssetsMutation(ctx, () =>
    invoke<SharedAssetSnapshot[]>("shared_assets_delete", {
      fileName: normalizedName,
    })
  );
}

async function runSharedAssetsMutation(
  ctx: ControllerContext,
  operation: () => Promise<SharedAssetSnapshot[]>
): Promise<void> {
  ctx.setState((previous) => ({
    ...previous,
    sharedAssetsUploading: true,
    sharedAssetsError: null,
  }));

  try {
    const assets = await operation();
    ctx.setState((previous) => ({
      ...previous,
      sharedAssets: assets,
      sharedAssetsError: null,
    }));
  } catch (error) {
    ctx.setState((previous) => ({
      ...previous,
      sharedAssetsError: toErrorMessage(error),
    }));
    throw error;
  } finally {
    ctx.setState((previous) => ({
      ...previous,
      sharedAssetsUploading: false,
    }));
  }
}
