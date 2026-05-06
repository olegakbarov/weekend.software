# Fluid Functionalism — Upstream Inventory

> Wave 1 fidelity audit, **revised post-Phase-D** (commit `6de75be`). This
> file enumerates every artifact in the canonical upstream and
> cross-references it against `@weekend/design` (`packages/design/src/`).
>
> **Audit basis:** post-Phase-D commit `6de75be` (was: "audit time" / Wave 1
> snapshot). All HIGH-drift components and MISSING primitives identified in
> the original audit have been ported. Status columns now reflect ported state.
> See `SUMMARY.md` for the per-commit migration record and `RESIDUAL.md` for
> the visual eyeball checklist.

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
| Accordion | `registry/default/accordion.tsx` | `src/registry/accordion.tsx` | EXISTS, identical-to-upstream (post-B1) | Full `AccordionGroup` proximity-hover overlay, chevron-right + 90° rotation, dual-text width-stable weight transition all restored. 100→663 LOC. |
| Badge | `registry/default/badge.tsx` | `src/registry/badge.tsx` | EXISTS, identical-to-upstream (post-B8) | `forwardRef` + HTML-attrs spread; uses `shape.item`; restored upstream sizes (h-5/6/7); solids mix into `--background`. New exports `badgeColors`, `badgeVariants`, `BadgeProps`. |
| Button | `registry/default/button.tsx` | `src/components/button.tsx` (+ `button.css`) | EXISTS, identical-to-upstream + Weekend extension (post-B7) | Restored 4 upstream variants (`primary/secondary/tertiary/ghost`); kept Weekend's 3 extras (`destructive/success/link`) per D3. Default reverted `tertiary` → `primary`. `loading` prop with spinner-move/dash keyframes. Auto-sized icons. |
| CheckboxGroup + CheckboxItem | `registry/default/checkbox-group.tsx` | `src/registry/checkbox-group.tsx` | EXISTS, identical-to-upstream (post-D2) | Form-input pair on Phase F's proximity-hover + animated focus-ring infra. `role="checkbox"` + `aria-checked` + roving tabIndex. Deviation: doesn't yet wrap `@radix-ui/react-checkbox` (pnpm add unavailable at port time) — public API matches upstream so swap is API-compatible. |
| ColorPicker | `registry/default/color-picker.tsx` | `src/registry/color-picker.tsx` | EXISTS, identical-to-upstream (post-C, post-D1) | 92→1227 LOC. Full HSV/HSL/OKLCH + eyedropper + scrubbable channels + ColorPickerPopover/ColorSwatch/ColorTile. `FormatDropdown` swapped to use the new `Dropdown` (Phase D close-out). `ChannelSlider` stays inline — needs colored-tile thumb the registry Slider doesn't expose. EyeDropper hidden on Tauri WKWebView (Chromium-only API). |
| Dialog | `registry/default/dialog.tsx` | `src/registry/dialog.tsx` | EXISTS, identical-to-upstream (post-B9) | Close affordance routed through `Button variant="ghost"`; font-variation source-style aligned. |
| Dropdown + MenuItem | `registry/default/dropdown.tsx` (+ `menu-item.tsx`) | `src/registry/dropdown.tsx` + `src/registry/menu-item.tsx` | EXISTS, identical-to-upstream (post-D1) | Single-select menu surface with proximity-hover bg, animated checked-row, animated focus ring. Exports: `Dropdown`, `DropdownLabel`, `DropdownSeparator`, `useDropdown`, `MenuItem`. |
| InputCopy | `registry/default/input-copy.tsx` | `src/registry/input-copy.tsx` | EXISTS, identical-to-upstream (post-B3) | 3-state tooltip machine (`idle | copied | suppressed`) + `onPointerDown` capture; `<mark>` hover-highlight on the value. |
| InputGroup / InputField | `registry/default/input-group.tsx` | `src/registry/input-group.tsx` | EXISTS, identical-to-upstream | Verbatim port pre-audit; only formatting differs. |
| RadioGroup + RadioItem | `registry/default/radio-group.tsx` | `src/registry/radio-group.tsx` | EXISTS, identical-to-upstream (post-D2) | Pair with CheckboxGroup. Native `role="radio"` + roving tabIndex, Arrow/Home/End nav. Same Radix-deferred deviation as CheckboxGroup. |
| Select (registry) | `registry/default/select.tsx` | `src/registry/select.tsx` | EXISTS, identical-to-upstream (post-B4) | 312→769 LOC. Animated proximity-hover bg, animated checked-row, animated focus ring all under one `containerRef` with springs. Container-level Arrow/Home/End. Hidden form input. New exports: `SelectGroup`, `SelectLabel`, `SelectSeparator`, `triggerVariants`. `SelectItem.index` now optional with auto-index. |
| Select (Weekend skin) | — | `src/components/select.tsx` | not-in-upstream, retained | Thin Weekend-only wrapper for legacy desktop call sites; delegates visual concerns. |
| Slider | `registry/default/slider.tsx` | `src/components/slider.tsx` | EXISTS, identical-to-upstream (post-B5) | 73→1515 LOC + 515 CSS. Replaces placeholder with full Radix-backed port. `SliderComfortable` variant. Full keyboard a11y (Arrow/Home/End/PageUp/PageDown). `format` retained as deprecated alias for `formatValue`. |
| Switch | `registry/default/switch.tsx` | `src/components/switch.tsx` | EXISTS, identical-to-upstream + Weekend theme override (post-B6) | Drag-to-toggle via `useMotionValue` + `springs.moderate`. Hover/press thumb morph restored. ON-state is `#6B97FF` blue under fluid themes; weekend themes override to mono `var(--foreground)` via `[data-theme="weekend-*"]` (D1 decision — fluid keeps signature; weekend keeps identity). |
| Table | `registry/default/table.tsx` | `src/registry/table.tsx` | EXISTS, identical-to-upstream | Verbatim. |
| Tabs (ours) | `registry/default/tabs.tsx` | `src/registry/tabs.tsx` | not-in-upstream-shape, retained | Thin Radix wrapper. Upstream Tabs is rich/animated; this stays the simple shadcn-style fallback we ship. Justification: real consumer surfaces (settings, /dev/ds) need only the simple shape. |
| TabsSubtle | `registry/default/tabs-subtle.tsx` | — (overlapping `Seg`) | DEFERRED | Skipped per D2 — Weekend `Seg` covers the segmented-control intent. Re-evaluate if a true subtle-tabs surface emerges. |
| ThinkingIndicator | `registry/default/thinking-indicator.tsx` | — | DEFERRED | Skipped per D2. `shimmer-text` keyframes are already in tokens (Phase F) so the port is one-file when needed. |
| ThinkingSteps | `registry/default/thinking-steps.tsx` | `src/registry/thinking-steps.tsx` | EXISTS, identical-to-upstream (post-B8) | Added missing `[&>.absolute]:hidden` rule + `w-fit` header layout (was full-width — Accordion bg bleed-through). Active label gets `shimmer-text` class. New exports `ThinkingStepDetails`, `ThinkingStepImage`. |
| Tooltip | `registry/default/tooltip.tsx` | `src/registry/tooltip.tsx` | EXISTS, identical-to-upstream (post-B2) | Directional spring slide-in via framer-motion + `getSlideOffset` per side. `springs.fast` open / `{duration:0.1}` close. Defaults realigned: `delayDuration` 200, `sideOffset` 8. |
| MobileDrawer | — | `src/registry/mobile-drawer.tsx` | EXISTS (Wave 1 corrected — was misclassified as EXTRA) | Upstream-canonical visuals, just not surfaced in upstream `registry.json`. Identical except doc-comment + named-vs-default export. |
| NavItem | — | `src/registry/nav-item.tsx` | EXISTS (Wave 1 corrected — was misclassified as EXTRA) | Identical visuals; deliberate `<a>` vs `next/link` swap (correct for our hash router). |
| NavMenu | — | `src/registry/nav-menu.tsx` | EXISTS (Wave 1 corrected — was misclassified as EXTRA) | Identical text; inherits foundation aligned in Phase F. |
| Combobox | — | `src/registry/combobox.tsx` (+ test) | not-in-upstream, retained | Justification: combobox/select hybrid UX has no upstream equivalent (Dropdown is a menu, not a combobox). Used by `AgentCommandPicker`. |
| NumberStepper | — | `src/components/number-stepper.tsx` | not-in-upstream, retained | Justification: numeric `+/-` stepper with hold-to-repeat is a Weekend product surface (settings, font-size); no upstream parity primitive exists. |
| Seg | — | `src/components/seg.tsx` | not-in-upstream, retained | Justification: Weekend's segmented control. Overlaps in *intent* with upstream `tabs-subtle` but our Seg is consumer-facing in production (settings theme picker); rename/merge would churn callers without payoff. |
| Textarea | — | `src/components/textarea.tsx` (+ test, css) | not-in-upstream, retained | Justification: upstream has no textarea primitive; Weekend ships one because home-page editor and ProjectEditor need it. Could be absorbed upstream-first if a second consumer-style appears. |
| FileTree | — | re-export of `@pierre/trees/react` | weekend-only, backed by @pierre/trees | Justification: upstream has no tree primitive. We expose `@pierre/trees` (vendored Pierre tree component) through `@weekend/design` so projects can `npm install @weekend/design` and get it. No fidelity audit possible; tracked as a third-party adapter. |

**Wave 1 orphan-files claim: WITHDRAWN.** Wave 1 invented an ~18-path
"orphan files in `src/components/`" list. The actual `src/components/`
directory contains 9 properly-exported source files (`button.tsx`,
`number-stepper.tsx`, `seg.tsx`, `select.tsx`, `slider.tsx`, `switch.tsx`,
`textarea.tsx`, plus `theme/`). Every other claimed orphan path
(`src/components/dropdown.tsx`, `src/components/checkbox-group.tsx`, etc.)
was fabrication — see `_orphan-files-classification.md` for the per-path
verification done in Wave 2.

**Component count summary (post-Phase-D)**

| Bucket | Count |
|---|---|
| Upstream component files (registry tier, dropdown counted as 1) | 24 |
| Our exported components (`index.ts` + `registry.ts`) | 30 (Accordion + AccordionGroup, Badge, Button + IconButton, CheckboxGroup + CheckboxItem, ColorPicker + ColorPickerPopover/Swatch/Tile, Combobox, Dialog, Dropdown + MenuItem, InputCopy, InputField + InputGroup, MobileDrawer, NavItem, NavMenu, NumberStepper, RadioGroup + RadioItem, Seg, Select×2, Slider + SliderComfortable, Switch, Table, Tabs, Textarea, ThinkingSteps, Tooltip, FileTree) |
| EXISTS, identical-to-upstream | 19 (incl. Phase B+C+D ports) |
| EXISTS + Weekend extension | 2 (Button — extra variants; Switch — theme override on ON-state) |
| not-in-upstream, retained | 5 (Combobox, NumberStepper, Seg, Tabs-as-shipped, Textarea) |
| weekend-only, backed by 3p | 1 (FileTree → @pierre/trees) |
| DEFERRED | 2 (TabsSubtle — overlap with Seg; ThinkingIndicator — keyframes ready, port-on-demand) |
| MISSING | 0 |

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
| `--checker-a` / `--checker-b` | yes | yes (post-Phase-F) | EXISTS | Added in Phase F across light + all dark blocks. ColorPicker uses these. |
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
| `html.transitioning` block | yes (180ms transitions) | yes (post-Phase-F) | EXISTS | Added in Phase F. Our `ShapeProvider` toggles the class via `transitionShape`. |
| `.bento-card-border` | yes | — | n/a | Demo-only. |
| `.shimmer-text` + `@keyframes shimmer-text` | yes | yes (post-Phase-F) | EXISTS | Added in Phase F with per-theme gradient variants. Used by `ThinkingSteps` active label (post-B8); port-ready for `ThinkingIndicator`. |
| `@keyframes spinner-move` / `spinner-dash` | yes | yes (post-Phase-F) | EXISTS | Added in Phase F. Consumed by Button `loading` state (post-B7). |
| Shiki dual-theme block | yes | — | n/a | Demo-only. |

**Token count summary**

| Bucket | Count |
|---|---|
| Upstream token surface (count of distinct CSS custom properties) | ~30 |
| Our token surface | ~80+ (4 themes; per-theme overrides) |
| EXISTS (we have it) | ~30 (post-Phase-F: `--checker-a/b`, `html.transitioning`, `shimmer-text` keyframes, `spinner-move/dash` keyframes all added) |
| MISSING (upstream has, we don't) | 0 |
| EXTRA (Weekend additions) | ~50+ (focus-ring, success, font slots, type scale, radii, spacing, shadows, motion, accent palette) |

---

## Hooks

| Hook | Upstream path | Our path | Status | Note |
|---|---|---|---|---|
| `useProximityHover` | `registry/default/hooks/use-proximity-hover.ts` | `src/hooks/use-proximity-hover.ts` | EXISTS, identical-to-upstream (post-Phase-F) | **Wave 1 had the drift direction inverted** — upstream IS the sophisticated version (axis option, rAF batching, transform-aware coords, `useRegisterProximityItem`). Phase F replaced ours verbatim. |
| `useRegisterProximityItem` | `registry/default/hooks/use-proximity-hover.ts` (named export) | `src/hooks/use-proximity-hover.ts` (named export) | EXISTS, identical-to-upstream (post-Phase-F) | Re-exported from upstream-verbatim hook. |

---

## Lib utilities

| Symbol | Upstream path | Our path | Status | Note |
|---|---|---|---|---|
| `cn` | `registry/default/lib/utils.ts` | `src/lib/cn.ts` | EXISTS, identical-to-upstream | Same `clsx + twMerge` impl. File renamed `utils.ts` → `cn.ts` for clarity. |
| `springs` | `registry/default/lib/springs.ts` | `src/lib/springs.ts` | EXISTS, identical-to-upstream (post-Phase-F) | Migrated to framer-motion v12 `{type, duration, bounce}` shape. fast = `duration: 0.08, bounce: 0` etc. |
| `fontWeights` | `registry/default/lib/font-weight.ts` | `src/lib/font-weight.ts` | EXISTS, identical-to-upstream | Same values. |
| `ShapeProvider` / `useShape` / `useShapeContext` / `shapeMap` / `transitionShape` | `registry/default/lib/shape-context.tsx` | `src/lib/shape-context.tsx` | EXISTS, identical-to-upstream (post-Phase-F) | Now a Provider + `R` keyboard shortcut + `transitionShape` helper. Mounted in `src/main.tsx` between ThemeProvider and InnerApp; mirrors state to `<html data-shape>`. `useShape` keeps the read-only signature for consumers that don't need set. |
| `IconProvider` / `useIcon` / `useIcons` / `useIconLibrary` / `iconLibraryOrder` / `iconLibraryLabels` / `registerIconLibrary` | `registry/default/lib/icon-context.tsx` | `src/lib/icon-context.tsx` | EXISTS, identical-to-upstream (post-Phase-F) | 4-library runtime swap (lucide always installed; tabler/phosphor/hugeicons resolved via `registerIconLibrary` with peer-dep fallback). `I` keyboard shortcut to cycle. Legacy camelCase 6-name shim preserved for back-compat. |
| `iconMap` (canonical name → 4 libraries) | `registry/default/lib/icon-map.tsx` | `src/lib/icon-map.tsx` | EXISTS, identical-to-upstream (post-Phase-F) | 40 kebab-case canonical names. |
| `ThemeProvider` / `useThemeContext` | `registry/default/lib/theme-context.tsx` | — (lives in `src/components/theme/theme-provider.tsx` in the desktop app) | not-shipped-in-package, deliberate | The package itself ships no ThemeProvider — consumers wire their own (Weekend writes `data-theme` from a Tauri-aware app-level provider). |
| `IconContextProps` adapter type | `registry/default/lib/icon-map.tsx` | `src/lib/icon-context.tsx` | EXISTS, identical-to-upstream (post-Phase-F) | Aligned with upstream adapter shape. |

**Lib count summary**

| Bucket | Count |
|---|---|
| Upstream lib symbols | 7 files (utils, springs, font-weight, shape-context, icon-context, icon-map, theme-context) |
| Our lib symbols | 6 files (cn, springs, font-weight, shape-context, icon-context, icon-map) — `theme-context` deliberately excluded |
| EXISTS, identical-to-upstream | 6 |
| MISSING | 0 — Phase F closed all foundation drift |
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

## Open questions — resolutions (post-Phase-D)

All five Wave 2 open questions resolved during Phases F / B+C / D:

1. **Orphan `src/components/*.tsx`**: Wave 1 fabricated the orphan list.
   Confirmed in Wave 2 via `_orphan-files-classification.md` — those files
   never existed. `src/components/` has 9 properly-exported sources only
   (button, number-stepper, seg, select, slider, switch, textarea, plus
   `theme/` provider).
2. **`components/Select` vs `registry/Select`**: both intentional. The
   registry Select is the upstream-fidelity port (post-B4); the
   `components/select.tsx` is a thin Weekend wrapper retained for legacy
   call sites and emits the same visuals via the registry.
3. **springs migration**: done in Phase F. `{type, duration, bounce}` shape
   matches upstream framer-motion v12.
4. **`useShape` as Provider**: done in Phase F. `ShapeProvider` mounted in
   `src/main.tsx`; `R` shortcut + `transitionShape` helper + `html.transitioning`
   class all wired. `useShape()` keeps the read-only signature for consumers
   that don't need the setter.
5. **`--secondary` usage**: kept as deliberate Weekend deviation per D1.
   Upstream forbids `bg-secondary` via eslint outside `/compare`; that rule
   is upstream-internal and not enforced in our package.
