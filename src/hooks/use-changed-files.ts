import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ChangedFile {
  path: string;
  status: "A" | "M" | "D" | "R" | "U" | string;
  staged: boolean;
  /** Populated when the hook is invoked with `withDiffs: true`. */
  diff?: string;
}

export interface ChangedFilesState {
  files: ChangedFile[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

interface UseChangedFilesOptions {
  /** Set true to fetch full diffs alongside status. Heavier — only enable
   *  when the diffs view is mounted. */
  withDiffs?: boolean;
  /** ms to coalesce filesystem-event ticks. Default 300. */
  debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 300;

function shallowEqualFiles(a: ChangedFile[], b: ChangedFile[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x === undefined ||
      y === undefined ||
      x.path !== y.path ||
      x.status !== y.status ||
      x.staged !== y.staged ||
      x.diff !== y.diff
    ) {
      return false;
    }
  }
  return true;
}

/**
 * useChangedFiles — single hook for both the cheap status list and the
 * heavier batched-with-diffs payload. Behaviour:
 *
 *   • Debounces `filesystemEventVersion` by 300ms so a Vite dev server
 *     storming HMR rebuilds doesn't fire one git invocation per event.
 *   • Captures the trigger version on each fire and discards results from
 *     stale invocations (the latest fsVersion always wins).
 *   • Skips setState when the result is structurally equal to the previous
 *     one — important because the parent component re-renders cascade into
 *     the heavy ProjectFileTree.
 *   • Switches between the cheap `git_changed_files` (status only) and the
 *     batched `git_changed_files_with_diffs` (status + diff) command based
 *     on `withDiffs` so we don't pay the diff cost when only the badge is
 *     visible.
 */
export function useChangedFiles(
  project: string,
  filesystemEventVersion: number,
  options: UseChangedFilesOptions = {}
): ChangedFilesState {
  const { withDiffs = false, debounceMs = DEFAULT_DEBOUNCE_MS } = options;
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filesRef = useRef(files);
  filesRef.current = files;
  const generationRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOnce = useCallback(async () => {
    const generation = ++generationRef.current;
    setIsLoading(true);
    try {
      const command = withDiffs
        ? "git_changed_files_with_diffs"
        : "git_changed_files";
      const result = await invoke<ChangedFile[]>(command, { project });
      if (generation !== generationRef.current) {
        // A newer fetch was kicked off — drop these results.
        return;
      }
      setError(null);
      if (!shallowEqualFiles(filesRef.current, result)) {
        setFiles(result);
      }
    } catch (err) {
      if (generation !== generationRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      if (filesRef.current.length > 0) {
        setFiles([]);
      }
    } finally {
      if (generation === generationRef.current) {
        setIsLoading(false);
      }
    }
  }, [project, withDiffs]);

  // Trigger 1: fetch immediately on mount or when `project` / `withDiffs`
  // change (these change the `fetchOnce` callback's identity).
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    void fetchOnce();
  }, [fetchOnce]);

  // Trigger 2: debounced refresh on fs-event ticks. The `lastFsVersionRef`
  // gate prevents this effect from firing when only `fetchOnce` changed
  // (which is already handled by the immediate-fetch effect above).
  const lastFsVersionRef = useRef(filesystemEventVersion);
  useEffect(() => {
    if (filesystemEventVersion === lastFsVersionRef.current) return;
    lastFsVersionRef.current = filesystemEventVersion;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void fetchOnce();
    }, debounceMs);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [filesystemEventVersion, fetchOnce, debounceMs]);

  const refresh = useCallback(() => {
    void fetchOnce();
  }, [fetchOnce]);

  return { files, isLoading, error, refresh };
}
