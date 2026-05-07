# Weekend — Claude instructions

This is a Tauri + React + Rust monorepo. The desktop app lives at the repo root; `packages/design` is the `@weekend/design` system that gets distributed both to the desktop UI and to every project Weekend creates.

## Architecture

- `src/**` — desktop app (React, TanStack hash router, Tauri 2)
- `src-tauri/**` — Rust backend, Tauri commands, project lifecycle
- `packages/design/**` — `@weekend/design`, the canonical design system (vendored from fluid-functionalism, internally maintained)
- `packages/design/dist/` — build output, synced into `<project>/shared-assets/weekend-design/` so agents building apps inside projects can `npm install` it
- `~/.weekend/` — user data: projects, theme.json, shared-assets

## Design system absorption — the discipline

**As we migrate Weekend's UI to use `@weekend/design`, the design system absorbs general patterns rather than leaving them as ad-hoc Weekend-only code.** This is load-bearing — without it, the design system stays a thin shell and Weekend's UI keeps drifting.

When you encounter a UI pattern during migration, classify it:

1. **General pattern → absorb upstream into `packages/design/`.** Examples already absorbed: Tabs (was in `src/components/ui/tabs.tsx`, moved to `packages/design/src/registry/tabs.tsx`); Button variants `destructive`/`secondary`/`success`/`link` and `xs` size and `asChild` prop (were Weekend-specific, expanded the design Button to cover them). When absorbing: add the component, add tests, update `packages/design/src/registry.ts` or `index.ts`, run `pnpm --filter @weekend/design test`, run `pnpm design:build` to refresh the dist, run `pnpm design:index` to refresh consumer manifests.

2. **General pattern + Weekend-specific behavior → wrapper at `src/components/ui/<name>.tsx`.** The wrapper imports from `@weekend/design`, delegates the visual concerns, adds Weekend-only behavior. Example: `src/components/ui/button.tsx` is now a 95-line wrapper that calls fluid Button + adds `soundCue` side-effects + maps `icon`/`icon-sm`/`icon-xs` sizes to Tailwind classes that force square dimensions. Consumers don't change.

3. **Truly Weekend-specific → keep local, document why.** Examples: confirm-dialog (Tauri UX), AgentCommandPicker on the home page (combobox UX neither system has), Textarea (design has no Textarea — could be added if a second consumer appears).

**Before migrating a page**: read it, list every interactive element, classify each into the three buckets, and only then start editing.

**Heuristic for absorption**: if you can imagine an agent-created project app wanting this pattern, absorb it. The design system isn't just for the desktop chrome — it ships into every project.

## Theming

- Single source of truth: `<html data-theme="...">` where the value is `fluid` | `fluid-dark` | `weekend-dark` | `weekend-paper`.
- `ThemeProvider` (`src/components/theme/theme-provider.tsx`) writes `data-theme` only — never `style.setProperty("--*", ...)`. Inline-style writes break the design system's `:root[data-theme=...]` cascade because inline has specificity 1,0,0,0. ThemeProvider also toggles `.light` / `.dark` classes; these no longer carry token definitions but are still load-bearing as the anchor for Tailwind's `dark:` variant.
- Active theme persists to `~/.weekend/theme.json` via Tauri commands `get_active_theme` / `set_active_theme`. Setting emits a `theme-changed` event so all webviews stay in sync.
- **All theme tokens live in `packages/design/src/tokens.css`.** Adding a token: add it to all six blocks (`:root`, `.dark`, and the four `:root[data-theme="..."]` blocks). The exception is the Weekend `@theme inline` block in `src/styles.css`, which holds Tailwind v4 utility-class generators (`--font-sans`, `--font-mono`, `--text-xs..3xl`, `--radius-sm..xl`) — those drive `.text-xs`, `.font-mono`, `.rounded-sm` etc. and are intentionally global.
- `src/styles.css` is for **app-internal CSS only** (animations, `.tool-*` classes, scrollbar webkit overrides, `@theme inline` for Tailwind utilities). It does not define theme tokens. Run `pnpm tokens:lint` any time to see what's defined where; `pnpm tokens:lint:check` exits 1 if a legacy-only token gains a consumer (use it in CI).

## Commands

| Command | Purpose |
|---|---|
| `pnpm tauri:dev` | Run app (auto-builds design dist via `pretauri:dev`) |
| `pnpm exec tsc --noEmit -p tsconfig.json` | App typecheck |
| `pnpm --filter @weekend/design test` | Design package tests (vitest) |
| `pnpm --filter @weekend/design typecheck` | Design package types |
| `pnpm design:build` | Build `packages/design/dist/` |
| `pnpm design:index` | Regenerate `packages/design/.consumers/*.json` |
| `pnpm design:index:check` | CI mode — exits 1 if manifests are stale |
| `pnpm tokens:lint` | Diagnose token drift between `src/styles.css` and `packages/design/src/tokens.css` |
| `pnpm tokens:lint:check` | CI mode — exits 1 if any legacy-only token has a consumer |
| `cargo check` (in `src-tauri/`) | Rust check |

## /dev/ds

The fluid docs site is cloned into `src/dev/docs/` and rendered at the `/dev/ds` route. It's the visual reference for all design primitives across all four themes, with a topbar theme cycler. When adding a primitive to `@weekend/design`, also update the corresponding docs page so it has a live demo.

## Consumer manifests

`packages/design/.consumers/<symbol>.json` lists every file consuming each design export, with prop-level usage counts. Use these before deprecating a prop — they tell you the blast radius. The desktop's `src/components/ui/*` wrappers count as consumers; downstream files using the wrappers don't show up directly (they consume through the wrapper).

## Don't

- Don't add CSS variables on `<html>` via `style.setProperty` — break the cascade.
- Don't import from `@fluid/*` — that name was retired during vendoring; the package is `@weekend/design`.
- Don't create new Weekend-only primitives without first checking if `@weekend/design` should grow to cover the case.
- Don't write to `location.hash` from within `/dev/ds` — TanStack hash history owns it. The embedded docs use module-level state in `src/dev/docs/docs-route-store.ts`.
