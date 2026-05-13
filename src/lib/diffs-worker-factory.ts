// Vite-specific worker import. The `?worker&url` query tells Vite to bundle
// the worker as a separate asset and return its URL. We instantiate one
// `Worker` per call from the WorkerPoolContextProvider; @pierre/diffs reuses
// it across every <PatchDiff> on the page via its internal worker pool.
import WorkerUrl from "@pierre/diffs/worker/worker.js?worker&url";

export function diffsWorkerFactory(): Worker {
  return new Worker(WorkerUrl, { type: "module" });
}
