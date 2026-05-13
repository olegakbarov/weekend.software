import { useSyncExternalStore } from "react";
import {
  DEFAULT_SHELL_DOCS_SECTION,
  findShellDocsSection,
} from "@/components/docs/shell-docs-sections";

export const SHELL_DOCS_NAVIGATE_EVENT = "shell-docs:navigate";

let current = DEFAULT_SHELL_DOCS_SECTION;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getShellDocsSection(): string {
  return current;
}

export function setShellDocsSection(next: string): void {
  const valid = findShellDocsSection(next)?.id ?? DEFAULT_SHELL_DOCS_SECTION;
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

export function useShellDocsSection(): string {
  return useSyncExternalStore(
    subscribe,
    getShellDocsSection,
    getShellDocsSection,
  );
}
