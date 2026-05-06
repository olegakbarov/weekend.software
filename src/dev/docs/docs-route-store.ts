import { useSyncExternalStore } from "react";
import { findRouteById, DEFAULT_ROUTE } from "./routes";

let current: string = DEFAULT_ROUTE;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getDocsRoute(): string {
  return current;
}

export function setDocsRoute(next: string): void {
  const valid = findRouteById(next) ? next : DEFAULT_ROUTE;
  if (valid === current) return;
  current = valid;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDocsRoute(): string {
  return useSyncExternalStore(subscribe, getDocsRoute, getDocsRoute);
}
