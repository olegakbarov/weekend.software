# Audit: FileTree

**Status**: not-in-upstream — re-export of a third-party library (`@pierre/trees`). No fidelity audit possible.

**Upstream source**: none. Fluid-functionalism does not ship a tree primitive. There is no `tree.tsx` in `registry/default/`, no `app/docs/tree/` page, and no related symbol in `registry.json`.

**Our source**: `packages/design/src/registry.ts` lines 87–108 — re-exports from `@pierre/trees` and `@pierre/trees/react`.

## What we ship

`@weekend/design/registry` re-exports the entire `@pierre/trees` React surface:

```ts
// from @pierre/trees/react
export {
  FileTree,
  useFileTree,
  useFileTreeSearch,
  useFileTreeSelection,
  useFileTreeSelector,
};
export type {
  FileTreePreloadedData,
  FileTreeProps,
  FileTreeSearchState,
  FileTreeSelector,
  FileTreeSelectorEquality,
  UseFileTreeResult,
};
// from @pierre/trees root entry
export { prepareFileTreeInput, preparePresortedFileTreeInput };
export type { FileTreePreparedInput };
```

The component renders inside a **shadow root** with its own bundled styles, so consumers don't need a CSS import. It is a path-first virtualized tree (you give it a paths array, it builds the tree itself via `prepareFileTreeInput`).

## Why it's here, not upstream

- `@pierre/trees` is a separately-versioned npm package (currently `^1.0.0-beta.3`) maintained by Pierre.dev. Its design assumptions (shadow DOM, virtualized rendering, path-first input) are scoped to file-tree UX specifically, not to a general-purpose "tree" primitive.
- Fluid-functionalism is a Tailwind v4 + Radix design library aimed at flat composable surfaces; tree views are out of scope upstream.
- Re-exporting through `@weekend/design/registry` is a deliberate Weekend choice so consumers can `import { FileTree } from "@weekend/design/registry"` alongside other primitives — keeps the import surface uniform.

## Bundling note

`packages/design/vite.config.ts` includes `/^@pierre\//` in `external`, so `@pierre/trees` is **not** bundled into our `dist/`. Consumers must install `@pierre/trees` themselves (or rely on the workspace hoisting). The desktop app picks it up transitively because the design package declares it as a `dependencies` entry, not a `peerDependency`.

## Theme bridge

`src/styles.css` in the desktop app contains a `@pierre/trees theme bridge` block that maps `@pierre/trees` CSS custom properties (which leak into the shadow root via `inherit`) onto our token palette. That bridge is not part of `@weekend/design` itself — projects/agents consuming `@weekend/design` need to apply a similar bridge if they want the FileTree to follow Weekend tokens.

## Severity

**n/a** — there is nothing to align with upstream.

## Recommendations

1. **Keep the re-export**. The current arrangement (re-export from `@weekend/design/registry`, peer-bundled, theme bridged in the consumer) is sound.
2. **Document the theme-bridge expectation** in `packages/design/AUDIT/` or in JSDoc above the re-export, so consumer projects know they need to wire variables through if they want themed colors.
3. **Watch for `@pierre/trees` major version bumps** — since we re-export the public types directly, breaking changes in `@pierre/trees` propagate to our consumers without a Weekend-side wrapper to absorb them. If that becomes painful, consider adding a thin `<FileTree>` wrapper in `src/registry/file-tree.tsx` that pins our public type surface and re-maps as needed.
4. **Do not try to absorb a tree component upstream-side**. Upstream is unlikely to want this and the path-first virtualized model is more invasive than the rest of fluid-functionalism's primitives.
