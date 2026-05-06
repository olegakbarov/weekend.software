# Fluid Functionalism — Upstream Inventory

> Wave 1 fidelity audit. This file enumerates every artifact in the canonical
> upstream and cross-references it against `@weekend/design`
> (`packages/design/src/`). Subsequent waves use this list to do per-component
> drift audits — see `AUDIT-TEMPLATE.md`.

## Upstream

- **Repo**: <https://github.com/mickadesign/fluid-functionalism>
- **Local clone**: `/Users/venge/Code/fluid-functionalism-upstream/`
- **Commit**: `d850ecf76a9972b185564faec0fd927f4b66979c`
- **Short**: `d850ecf` — _"Polish color picker popover, format dropdown, and swatches"_
- **Tag**: none (no tags exist in the upstream repo)
- **Branches of note** (remote): `main` (default — what we audit against), plus
  feature/experiment branches (`dark-mode`, `feat/thinking-steps`, several
  `claude/*` branches). Wave 2 should stick to `main` unless an absorbed
  Weekend feature traces to one of these branches.

## Upstream project shape

The upstream is **a Next.js 15 + Tailwind v4 demo site** that ships a shadcn
registry alongside it — _not_ a clean component package. Important
implications for Wave 2:

- The package name is `fluid-functionalism` and it is `private: true`. There
  is **no published npm artifact** — consumption is via shadcn registry
  (`shadcn build` → `registry.json` items pulled into a project). Our
  intermediate copy at `/Users/venge/Code/fluid/` is a vendored snapshot of
  the registry tier; we vendored it as a workspace package.
- The **canonical component sources live at `registry/default/*.tsx`**. These
  are the "production" copies that ship to consumers. Every `registry/default/*.tsx`
  file is referenced by `registry.json`.
- A **second copy of some components lives at `components/ui/*.tsx`** (used by
  the demo site itself). These are the same components but with internal
  imports rewritten from `@/registry/default/...` aliases to `@/lib/...`.
  Wave 2: read both, but treat `registry/default/` as the source of truth.
- `components/shadcn/*.tsx` — vanilla shadcn components used **only** in the
  `/compare` route to A/B Fluid against shadcn. These are NOT part of the
  design system; do not audit against them.
- `app/components/*` — demo-site chrome (sidebar, bento card, previews). Not
  part of the design system.
- Tokens live in `app/globals.css` (single light/dark block, much simpler
  than ours).
- `app/docs/<component>/page.tsx` exists for almost every component and is
  the canonical visual reference. Wave 2 agents should pull these up when
  diffing — they document the intended demos.

## Repo tree (key dirs only)

```
fluid-functionalism-upstream/
  app/
    globals.css                  ← TOKENS (single source upstream)
    layout.tsx
    page.tsx
    components/                  ← demo-site chrome (NOT design system)
    docs/<name>/page.tsx         ← per-component reference demos
    compare/                     ← /compare route, uses components/shadcn
    demo/, slider/, table/       ← misc demo subroutes
  components/
    ui/                          ← demo-app copies (5 files; uses @/lib aliases)
    shadcn/                      ← vanilla shadcn (compare-only, IGNORE)
  registry/default/              ← *** CANONICAL component sources ***
    <component>.tsx              ← 24 component files
    lib/                         ← 7 lib files (utils, springs, contexts…)
    hooks/                       ← 1 hook
  hooks/
    use-proximity-hover.ts       ← thin re-export of registry/default/hooks
  lib/                           ← thin re-exports of registry/default/lib
    utils.ts, font-weight.ts, springs.ts, icon-context.tsx,
    icon-map.tsx, shape-context.tsx
  public/fonts/InterVariable.ttf
  registry.json                  ← *** authoritative registry manifest ***
  package.json                   ← Next 15, React 19, Tailwind v4, framer-motion 12
  components.json                ← shadcn config
```

Our package mirrors this much more flatly:

```
packages/design/src/
  components/      ← Weekend-specific re-skins (Button, Select, Switch, …)
  registry/        ← shadcn-registry-derived components
  lib/             ← cn, springs, font-weight, icon, shape-context
  hooks/           ← use-proximity-hover
  fonts/InterVariable.ttf
  tokens.css       ← tokens for FOUR themes (fluid, fluid-dark, weekend-dark, weekend-paper)
  index.ts         ← @weekend/design entrypoint (Weekend re-skins)
  registry.ts      ← @weekend/design/registry entrypoint (registry tier)
```

## Build / packaging

| Aspect | Upstream | Ours |
|---|---|---|
| Package name | `fluid-functionalism` (private) | `@weekend/design` |
| Distribution | shadcn registry (`shadcn build`) | workspace + `dist/` (`pnpm design:build`) |
| Tailwind | v4, configured via `app/globals.css` `@import "tailwindcss"` | v4, consumed from app via `@source` |
| React | 19 | 19 |
| framer-motion | `^12.34.0` (also imports `motion@^12.38.0` separately) | aligned |
| Radix | individual `@radix-ui/react-*` packages, latest 1.x/2.x | aligned |
| Icons | lucide + tabler + phosphor + hugeicons (4 libs swappable) | **lucide only** (drift) |
| Aliases | `@/registry/default/*`, `@/lib/*`, `@/hooks/*` | relative imports throughout |
| Fonts | `public/fonts/InterVariable.ttf` (Next public dir) | `src/fonts/InterVariable.ttf` (bundled) |

---

## Components

Upstream has 24 component files in `registry/default/` (registry.json lists
24 `registry:ui` items; `dropdown` ships two files — `dropdown.tsx` +
`menu-item.tsx`).

Our package has ~17 in `src/registry/` and ~10 Weekend re-skins in
`src/components/`.

| Component | Upstream path | Our path | Status | Note |
|---|---|---|---|---|
| Accordion | `registry/default/accordion.tsx` | `src/registry/accordion.tsx` | EXISTS | |
| Badge | `registry/default/badge.tsx` | `src/registry/badge.tsx` | EXISTS | |
| Button | `registry/default/button.tsx` | `src/components/button.tsx` (+ `button.css`) | EXISTS | Weekend's lives in `components/`, not `registry/`. Re-skinned with extra variants (`destructive`, `secondary`, `success`, `link`), extra size `xs`, `asChild`, plus icon-only `IconButton`. Wave 2: confirm the upstream-equivalent variants/sizes still match. |
| CheckboxGroup | `registry/default/checkbox-group.tsx` | — | MISSING | Not exported anywhere in `src/index.ts` or `src/registry.ts`. |
| ColorPicker | `registry/default/color-picker.tsx` | `src/registry/color-picker.tsx` | EXISTS | |
| Dialog | `registry/default/dialog.tsx` | `src/registry/dialog.tsx` | EXISTS | |
| Dropdown | `registry/default/dropdown.tsx` (+ `menu-item.tsx`) | — | MISSING | Neither `Dropdown` nor `MenuItem` are exported. Weekend has `Combobox` (registry/combobox.tsx) which is different (combobox/select hybrid, not a menu). |
| InputCopy | `registry/default/input-copy.tsx` | `src/registry/input-copy.tsx` | EXISTS | |
| InputGroup / InputField | `registry/default/input-group.tsx` | `src/registry/input-group.tsx` | EXISTS | |
| RadioGroup | `registry/default/radio-group.tsx` | — | MISSING | Not exported. |
| Select | `registry/default/select.tsx` | `src/components/select.tsx` + `src/registry/select.tsx` | EXISTS | We have BOTH a Weekend-skin Select (in `components/`) and a registry Select. Wave 2: clarify which is canonical and which the desktop UI consumes. |
| Slider | `registry/default/slider.tsx` | `src/components/slider.tsx` | EXISTS | Weekend re-skin; not under `registry/`. |
| Switch | `registry/default/switch.tsx` | `src/components/switch.tsx` | EXISTS | Weekend re-skin. |
| Table | `registry/default/table.tsx` | `src/registry/table.tsx` | EXISTS | |
| Tabs | `registry/default/tabs.tsx` | `src/registry/tabs.tsx` | EXISTS | |
| TabsSubtle | `registry/default/tabs-subtle.tsx` | — | MISSING | |
| ThinkingIndicator | `registry/default/thinking-indicator.tsx` | — | MISSING | We export `ThinkingSteps` but not `ThinkingIndicator`. (Note: an `src/components/thinking-indicator.tsx` file exists but is not re-exported — verify whether it's stale.) |
| ThinkingSteps | `registry/default/thinking-steps.tsx` | `src/registry/thinking-steps.tsx` | EXISTS | |
| Tooltip | `registry/default/tooltip.tsx` | `src/registry/tooltip.tsx` | EXISTS | |
| MobileDrawer | — | `src/registry/mobile-drawer.tsx` | EXTRA | Weekend addition. |
| NavItem | — | `src/registry/nav-item.tsx` | EXTRA | Weekend addition (sidebar pattern). |
| NavMenu | — | `src/registry/nav-menu.tsx` | EXTRA | Weekend addition. |
| Combobox | — | `src/registry/combobox.tsx` (+ test) | EXTRA | Weekend addition. Conceptually overlaps with upstream Dropdown but isn't the same component. |
| NumberStepper | — | `src/components/number-stepper.tsx` | EXTRA | Weekend-skin only. |
| Seg | — | `src/components/seg.tsx` | EXTRA | Weekend-skin segmented control (overlap with upstream `tabs-subtle`?). |
| Textarea | — | `src/components/textarea.tsx` (+ test, css) | EXTRA | Documented in CLAUDE.md as "design has no Textarea". |

**Stale/orphan candidates in our package** (Wave 2: check whether re-export
was dropped or the file is dead):

- `src/components/menu-item.tsx` — exists; not re-exported.
- `src/components/dropdown.tsx` — exists; not re-exported.
- `src/components/checkbox-group.tsx` — exists; not re-exported.
- `src/components/radio-group.tsx` — exists; not re-exported.
- `src/components/tabs-subtle.tsx` — exists; not re-exported.
- `src/components/tabs.tsx` — exists; not re-exported (we ship `registry/tabs.tsx`).
- `src/components/thinking-indicator.tsx` — exists; not re-exported.
- `src/components/dialog.tsx`, `src/components/accordion.tsx`,
  `src/components/table.tsx`, `src/components/tooltip.tsx`,
  `src/components/color-picker.tsx`, `src/components/input-copy.tsx`,
  `src/components/input-group.tsx`, `src/components/thinking-steps.tsx`,
  `src/components/badge.tsx`, `src/components/nav-item.tsx`,
  `src/components/nav-menu.tsx`, `src/components/mobile-drawer.tsx` — all
  exist; the **canonical re-export** for each comes from `src/registry/`.
  These look like a parallel set used by something else (or a legacy copy).
  Wave 2 must determine whether they are duplicates of registry copies,
  Weekend re-skins, or dead code.

**Component count summary**

| Bucket | Count |
|---|---|
| Upstream component files (registry tier, dropdown counted as 1) | 24 |
| Our exported components (`index.ts` + `registry.ts`) | ~22 (Button, IconButton, NumberStepper, Seg, Select×2, Slider, Switch, Textarea, Accordion, Badge, ColorPicker, Combobox, Dialog, InputCopy, InputField, InputGroup, MobileDrawer, NavItem, NavMenu, Table, Tabs, ThinkingSteps, Tooltip) |
| EXISTS | 16 |
| MISSING | 6 (CheckboxGroup, Dropdown, MenuItem, RadioGroup, TabsSubtle, ThinkingIndicator) |
| EXTRA | 6 (Combobox, MobileDrawer, NavItem, NavMenu, NumberStepper, Seg, Textarea) — 7 if Seg counted separately |
| RENAMED | 0 confirmed (Combobox is conceptually adjacent to Dropdown but not a rename) |

---

## Tokens

Upstream tokens live in **a single file**: `app/globals.css`. There is one
light theme on `:root` and one dark theme via `prefers-color-scheme` + `.dark`.

Ours live in `src/tokens.css` and define **four themes** via
`:root[data-theme="..."]`: `fluid`, `fluid-dark`, `weekend-dark`,
`weekend-paper`. We also expose extra tokens upstream lacks (focus-ring,
secondary, success, neutral-50/950, accent palette colors, type scale, radii,
spacing, shadows, motion durations).

| Token / category | Upstream | Ours | Status | Note |
|---|---|---|---|---|
| `--background` / `--foreground` | yes | yes | EXISTS | |
| `--card` / `--card-foreground` | yes | yes | EXISTS | |
| `--muted` / `--muted-foreground` | yes | yes | EXISTS | |
| `--accent` / `--accent-foreground` | yes | yes | EXISTS | |
| `--selected` | yes | yes (light/dark; missing in weekend themes — derived from accent) | EXISTS | |
| `--border` / `--ring` / `--input` | yes | yes | EXISTS | |
| `--destructive` / `--destructive-light` | yes | yes | EXISTS | |
| `--neutral-100..900` | yes | yes (we add `-50` and `-950`) | EXISTS | |
| `--checker-a` / `--checker-b` | yes | — | MISSING | Used by upstream color picker checkerboard. Verify ColorPicker still works without these. |
| `--hover` / `--active` | yes | yes | EXISTS | |
| `--focus-ring` | — | yes (`#6b97ff` default; theme-overridable) | EXTRA | Documented in tokens.css comment as Weekend drift. |
| `--success` / `--success-foreground` | — | yes | EXTRA | |
| `--secondary` / `--secondary-foreground` | reserved-only at `:root` (only set inside `.shadcn-theme`) | yes (set everywhere) | EXTRA-ish | Upstream comment forbids using `bg-secondary` outside `/compare` route — Wave 2: are we using upstream-forbidden tokens? |
| `--primary` / `--popover` family | reserved-only (compare route) | not present | OK | We correctly don't ship them. |
| `--font-sans` | yes (in `@theme inline`) | yes | EXISTS | Upstream uses `@theme inline { --font-sans: ... }`; we set `--font-sans` directly. |
| `--font-mono` | — | yes | EXTRA | |
| `--font-ui` / `--font-mono-ui` / `--font-display` | — | yes (font slots, consumer-overridable) | EXTRA | Used to inject Berkeley Mono / VCR OSD Mono per Weekend theme. |
| `--fw-normal/medium/semibold/bold` | — (uses `lib/font-weight.ts` constants) | yes (CSS) | EXTRA | We mirror the JS values as CSS tokens. |
| `--text-h1/h2/h3/lg/md/sm/xs/xxs` | — | yes | EXTRA | Type scale tokens (Weekend addition). |
| `--radius-sm/md/lg/xl/2xl/3xl/pill` | — | yes | EXTRA | |
| `--radius-control` / `--radius-container` | — | yes (toggled by `[data-shape]`) | EXTRA | Mirrors upstream's `lib/shape-context` JS approach. |
| `--space-0_5..12` | — | yes | EXTRA | |
| `--shadow-card / -hover / -popover / -modal` | — | yes | EXTRA | Upstream sets shadows inline (e.g. `box-shadow: 0 1px 2px rgba(0,0,0,0.04)` in `.bento-card-border`). |
| `--spring-fast-ms` / `-moderate-ms` / `-slow-ms` / `--ease-out-ui` | — | yes | EXTRA | |
| Inter `@font-face` block | yes (URL `/fonts/InterVariable.ttf`, `format("truetype")`) | yes (URL `./fonts/InterVariable.ttf`, `format("truetype-variations")`) | EXISTS | Format string differs (`truetype` vs `truetype-variations`) — minor; verify in browser. |
| `html.transitioning` block | yes (180ms transitions) | — | MISSING | Used by `lib/theme-context.tsx` and `lib/shape-context.tsx` to animate token swaps. Our ThemeProvider should consider this if shape transitions feel jarring. |
| `.bento-card-border` | yes | — | n/a | Demo-only. |
| `.shimmer-text` + `@keyframes shimmer` | yes | — | MISSING | Used by `thinking-indicator` (which we don't ship). If we ship it, port the keyframes. |
| `@keyframes spinner-move` / `spinner-dash` | yes | (verify) | UNKNOWN | Wave 2: search our build for these — used by Button loading state. |
| Shiki dual-theme block | yes | — | n/a | Demo-only. |

**Token count summary**

| Bucket | Count |
|---|---|
| Upstream token surface (count of distinct CSS custom properties) | ~30 |
| Our token surface | ~80+ (4 themes; per-theme overrides) |
| EXISTS (we have it) | ~25 |
| MISSING (upstream has, we don't) | 2 (`--checker-a/b`, `html.transitioning` block) |
| EXTRA (Weekend additions) | ~50+ (focus-ring, success, font slots, type scale, radii, spacing, shadows, motion, accent palette) |

---

## Hooks

| Hook | Upstream path | Our path | Status | Note |
|---|---|---|---|---|
| `useProximityHover` | `registry/default/hooks/use-proximity-hover.ts` | `src/hooks/use-proximity-hover.ts` | EXISTS | **Drift expected** — ours has `axis: "x" \| "y"` option, rAF batching, transform-aware coordinate mapping, "inside-rect → containing index else closest" logic, and uses `offset*` props. Upstream is simpler: `getBoundingClientRect`-only, no rAF, closest-center only, no axis option. Wave 2: this is a high-value drift to document. |
| `useRegisterProximityItem` | — | `src/hooks/use-proximity-hover.ts` (named export) | EXTRA | Weekend addition. |

---

## Lib utilities

| Symbol | Upstream path | Our path | Status | Note |
|---|---|---|---|---|
| `cn` | `registry/default/lib/utils.ts` | `src/lib/cn.ts` | EXISTS / RENAMED file | Same `clsx + twMerge` impl. File renamed `utils.ts` → `cn.ts`. |
| `springs` | `registry/default/lib/springs.ts` | `src/lib/springs.ts` | EXISTS / **drift** | **Different transition shape**. Upstream uses the framer-motion v12 API: `{ type: "spring", duration, bounce }` (e.g. fast = `duration: 0.08, bounce: 0`). Ours uses the legacy stiffness/damping API: `{ type: "spring", stiffness: 600, damping: 40, mass: 0.5 }`. Wave 2: this is a behavioral difference for every animated component. |
| `fontWeights` | `registry/default/lib/font-weight.ts` | `src/lib/font-weight.ts` | EXISTS | Same values; quoting differs (single vs double around `wght`). |
| `ShapeProvider` / `useShape` / `useShapeContext` / `shapeMap` / `transitionShape` | `registry/default/lib/shape-context.tsx` | `src/lib/shape-context.ts` | RENAMED / **drift** | Upstream is a **React Context provider** with React state, `R` keyboard shortcut, `transitionShape` helper that toggles `html.transitioning`. Ours is a `useSyncExternalStore` hook reading `[data-shape]` from `<html>` — no provider, no shortcut, no transition class. Class strings also differ slightly (e.g. `rounded-2xl` vs `rounded-[20px]` for pill input). Wave 2: high-importance drift. |
| `IconProvider` / `useIcon` / `useIcons` / `useIconLibrary` / `iconLibraryOrder` / `iconLibraryLabels` | `registry/default/lib/icon-context.tsx` | `src/lib/icon.ts` | RENAMED / **major drift** | Upstream supports **4 icon libraries** (lucide, tabler, phosphor, hugeicons) with runtime swap + `I` keyboard shortcut + 40+ icon names. Ours is **lucide-only**, exposes only 6 icons (`check`, `chevronDown`, `chevronRight`, `copy`, `search`, `x`), no provider, no swap. The `IconComponent` type alias is `LucideIcon` rather than the upstream `ComponentType<{size, strokeWidth, className}>` adapter shape. |
| `iconMap` (canonical name → 4 libraries) | `registry/default/lib/icon-map.tsx` | — | MISSING | Big file (~440 lines) and a chunky dep set. Upstream has it for the demo's icon swapper. Weekend deliberately scoped down; not a bug, but Wave 2 should confirm none of our absorbed components import `iconMap` types. |
| `ThemeProvider` / `useThemeContext` | `registry/default/lib/theme-context.tsx` | — (lives in `src/components/theme/theme-provider.tsx` in the desktop app) | MISSING from package | Upstream theming is `light`/`dark`/`system` via `.dark` class + `T` shortcut. Ours lives in the desktop app and writes `data-theme` instead. The package itself ships **no ThemeProvider** — that's a deliberate choice (consumers wire their own). |
| `IconContextProps` adapter type | `registry/default/lib/icon-map.tsx` | `src/lib/icon.ts` | RENAMED | Upstream: `{ size?: number; strokeWidth?: number; className?: string }` strict-numeric. Ours: callable with `size?: number \| string; strokeWidth?: number \| string; className?: string`. |

**Lib count summary**

| Bucket | Count |
|---|---|
| Upstream lib symbols | 7 files (utils, springs, font-weight, shape-context, icon-context, icon-map, theme-context) |
| Our lib symbols | 6 files (cn, springs, font-weight, shape-context, icon, icon-context) |
| EXISTS | 4 (cn/utils, springs, font-weight, shape-context) — all with drift |
| MISSING | 2 (icon-map full multi-library, theme-context) |
| EXTRA | 0 |

---

## Other (assets, configs)

| Artifact | Upstream | Ours | Status | Note |
|---|---|---|---|---|
| `InterVariable.ttf` | `public/fonts/InterVariable.ttf` | `src/fonts/InterVariable.ttf` | EXISTS | Upstream loads via `/fonts/InterVariable.ttf` (Next public dir); we bundle in `src/fonts/` and reference relatively. **Verify byte-identical** — the file should be the same Inter variable build. |
| Tailwind config | inferred from `app/globals.css` `@import "tailwindcss"` (Tailwind v4, no JS config) | inferred from package; consumers use `@source` to point at our `src/` | n/a | Both v4. |
| `components.json` | yes (shadcn config: `style: default`, `baseColor: neutral`, `iconLibrary: lucide`) | — | n/a | Upstream-only (shadcn build target). |
| `registry.json` | yes (24 items — see above) | — | n/a | Upstream-only. |
| `eslint.config.mjs` | yes — has rule forbidding bg-primary/secondary/popover outside `/compare` | — | n/a | Useful signal: upstream actively guards against `--secondary` and `--primary` token use in design components. We use `--secondary` heavily — Wave 2 should consider whether this is a fidelity issue. |
| `tsconfig.json` | yes (Next defaults) | yes | n/a | |
| `metadata-templates/`, `metadata.config.json` | yes | — | n/a | Demo-site routing helpers. |
| `scripts/postbuild-registry.mjs` | yes | — | n/a | shadcn registry post-processing. |
| `next.config.ts`, `vercel.json` | yes | — | n/a | Demo-site infra. |
| `animation-guidelines.md` | yes | — | MISSING | Worth importing into our docs / `CREDITS.md` as an upstream design doc. |
| `component-documentation-guidelines.md` | yes | — | MISSING | Same. |
| `app/docs/<component>/page.tsx` | yes for every component | — (we have `src/dev/docs/`) | n/a | Wave 2: when auditing a component, the upstream docs page is the visual reference. |

---

## Where to read each component (Wave 2 cheatsheet)

For every Fluid component, these three things matter:

1. **Source**: `registry/default/<name>.tsx` (canonical).
2. **Demo-site copy** (sometimes drifts intentionally for demos):
   `components/ui/<name>.tsx` if it exists. Most components have NO copy
   here — only `accordion`, `button`, `dropdown`, `nav-item`, `nav-menu`.
3. **Reference demo**: `app/docs/<name>/page.tsx`. Use this to understand
   the component's intended composition, sizes, and visual states.

Tokens are **all in `app/globals.css`**. CSS keyframes / utility classes
referenced by a component (e.g. `.shimmer-text`, `@keyframes spinner-move`)
also live there.

The `lib/` folder at the repo root is a thin re-export shell —
`lib/utils.ts` re-exports from `@/registry/default/lib/utils`. Wave 2 should
follow the alias chain back to `registry/default/lib/`.

---

## Open questions for Wave 2

1. Are `src/components/<name>.tsx` files that aren't re-exported (dropdown,
   menu-item, checkbox-group, radio-group, tabs-subtle, thinking-indicator,
   accordion, dialog, table, tooltip, color-picker, input-copy, input-group,
   thinking-steps, badge, nav-item, nav-menu, mobile-drawer) **stale
   duplicates** of the registry copies, **Weekend re-skin wrappers**, or
   **canonical components consumed elsewhere**? This determines whether
   "MISSING" entries above are actually missing or just unsurfaced.
2. The `components/Select` Weekend-skin vs `registry/Select` — which does
   the desktop UI consume, and are they intentionally divergent?
3. Should `springs` be migrated from stiffness/damping → duration/bounce to
   match upstream's framer-motion v12 idiom? (Mathematically not equivalent;
   audit visual feel.)
4. Should `useShape` be re-implemented as a Context provider to match
   upstream, given that the desktop already drives shape via `[data-shape]`?
5. `--secondary` token usage: upstream forbids it outside the compare route.
   Where do we use it, and does the equivalent upstream code use a different
   token (probably `--muted` or `--accent`)?
