# `@weekend/design` migration plan — fidelity alignment with upstream Fluid Functionalism

**Audit basis:** Wave 1 inventory + Waves 2A–F (35 audit docs) against upstream commit `d850ecf` of `mickadesign/fluid-functionalism`.
**Scope:** Full audit — every primitive in our package, plus tokens, lib utilities, hooks, and missing/extra components.
**Bottom line:** The intermediate vendor we cloned was a **partial, sometimes-deliberate port** of upstream. Several files self-document as "simplified port." Fidelity gaps fall into four buckets: foundation drift (cross-cutting), major rebuilds (200+ LOC missing per component), minor visual drift, and missing primitives.

---

## Audit summary by tier

### CRITICAL — foundation drift (every animated component inherits)
| Artifact | Drift | Severity |
|---|---|---|
| `lib/springs` | Legacy `{stiffness, damping, mass}` vs upstream framer-motion v12 `{duration, bounce}`. Worse: our CSS motion tokens (`--spring-fast-ms: 80ms`) match upstream, so our package disagrees with itself. | HIGH |
| `lib/icon` + `lib/icon-context` + `lib/icon-map` | 4-library runtime swap (lucide/tabler/phosphor/hugeicons) with `I` keyboard shortcut + 40 kebab-case names, ~440 LOC. Ours: 6 camelCase Lucide names. Public-API break. | HIGH |
| `lib/shape-context` | Upstream is React Context + Provider + `R` keyboard shortcut + `transitionShape` helper. Ours is a `useSyncExternalStore` hook reading `[data-shape]`. Different mental model. | MEDIUM |
| `hooks/use-proximity-hover` | **UPSTREAM is the sophisticated version** (axis option, rAF batching, transform-aware coords, `useRegisterProximityItem`); ours is the simple subset. Replace ours verbatim. | MEDIUM |
| `tokens.css` | Missing: `--checker-a/b` (ColorPicker), `html.transitioning` block (theme/shape switch flicker), `shimmer-text` keyframes (ThinkingIndicator + thinking states), `spinner-move/dash` keyframes (Button loading state). Pill radius differs (ours `rounded-2xl` = 16px, upstream `rounded-[20px]` = 20px). `bg-secondary` forbidden upstream (eslint-enforced), used heavily by us. fluid-dark surfaces 2 shades darker than upstream `.dark`. | HIGH |

### HIGH — major component rework (≥200 LOC missing or fundamentally different)
| Component | Drift | Status |
|---|---|---|
| **Slider** | 73-line placeholder vs ~1570 LOC upstream. Missing range/step-dots/tooltip/click-to-edit/keyboard-a11y. `tabIndex` without arrow handlers is a real a11y bug. 4px thin track vs 18px chunky pill — different visual identity. | major-drift |
| **Switch** | Drag-to-toggle gone. Hover/press thumb-morphing gone. **ON-state color changed from `#6B97FF` blue (upstream's signature) to `var(--foreground)` monochrome.** Identity-level visual divergence. | major-drift |
| **Button** | Variants forked (`primary/secondary/tertiary/ghost` upstream → 7 ours). Default changed (`primary` → `tertiary`). `leadingIcon` renamed to `icon`. Loading state dropped (spinner keyframes missing). Icons no longer auto-sized inside button. IconButton split as separate component. | major-drift |
| **Accordion** | Self-documents as "simplified port." Missing entire `AccordionGroup` proximity-hover overlay (~700 LOC). Chevron rotation flipped. Trigger spacing differs. Dual-text width-stable weight transition gone. | major-drift |
| **InputCopy** | Missing 3-state tooltip machine (`idle | copied | suppressed`) + `onPointerDown` capture. Missing `<mark>` hover-highlight (the dominant clickability signal). | major-drift |
| **ColorPicker** | **Functionally a different component.** Ours = 92-line `BadgeColor` radiogroup. Upstream = 1726-line full HSV/HSL/OKLCH picker with eyedropper, format dropdown, scrubbable channels, `ColorPickerPopover`, `ColorSwatch`, `ColorTile`. Type signatures incompatible at the very first prop. | major-drift |
| **Tooltip** | Dropped framer-motion entirely. Upstream is directional spring slide-in (`getSlideOffset` per-side, `springs.fast`); ours uses `tw-animate` data-state classes. Defaults differ (`delayDuration` 200 vs 300; `sideOffset` 8 vs 4). | major-drift |
| **Registry Select** | Stripped every animated layer (no proximity-hover bg, no animated checked-row bg, no animated focus ring, no scroll-close, no Arrow/Home/End keyboard nav, no hidden form input). Missing `variant`/`icon`/`error`/`SelectGroup`/`SelectLabel`/`SelectSeparator`/`triggerVariants` exports. `SelectItem` lacks `index` prop — API divergence. | major-drift |

### MEDIUM — visual polish
| Component | Drift | Status |
|---|---|---|
| **Badge** | Hardcoded `rounded-full` instead of `shape.item`. Sizes uniformly smaller (h-5/6/7 → h-[18/22/26]). Solids mix into `--card` instead of `--background`. No `forwardRef` or HTML-attrs spread. | minor-drift |
| **ThinkingSteps** | Missing `[&>.absolute]:hidden` rule + inverted header layout (full-width vs `w-fit`). Underlying Accordion's hover bg bleeds through every step — visual bug. | minor-drift |

### LOW — nearly identical (cosmetic only)
| Component | Drift | Status |
|---|---|---|
| `Dialog` | Cosmetic differences only. | minor-drift |
| `InputGroup` | Verbatim port; only formatting differs. | identical |
| `MobileDrawer` | Identical except doc-comment + named-vs-default export. | identical |
| `NavItem` | Identical visuals; deliberate behavior diff (`<a>` vs `next/link` — correct for our hash router). | identical |
| `NavMenu` | Identical text; inherits drift from `useProximityHover`/`shape-context`/`springs`. | identical |
| `Table` | Verbatim. | identical |
| `Seg` | Not in upstream — Weekend addition. Overlaps with upstream `TabsSubtle` (a variant of Tabs). Decide whether Seg = TabsSubtle. | not-in-upstream |
| `Textarea` | Not in upstream — Weekend addition. | not-in-upstream |
| `NumberStepper` | Not in upstream — Weekend addition. | not-in-upstream |
| `Tabs` (ours) | Simple Radix wrapper. Upstream Tabs is rich/animated; `TabsSubtle` is a separate variant. Three-way mismatch. | minor-drift |
| `Combobox` (ours) | Weekend addition. Upstream's Dropdown+MenuItem is a different UX category (menu, not combobox). Should not unify. | not-in-upstream |
| `FileTree` | Re-export of `@pierre/trees`. Upstream has no tree. No fidelity audit possible. | not-applicable |
| `cn`, `font-weight` | Identical. | identical |

### MISSING — components in upstream we don't ship
| Component | Use case | Severity |
|---|---|---|
| `Dropdown` + `MenuItem` | Single-select menu (sort/filter/option pickers) | MEDIUM (high if Weekend wants it) |
| `CheckboxGroup` | Form input | LOW (build when consumer needs) |
| `RadioGroup` | Form input; pair with CheckboxGroup (shared infra) | LOW |
| `TabsSubtle` | Subtle Tabs variant (Seg-like) — relates to our Seg | LOW |
| `ThinkingIndicator` | Distinct from our `ThinkingSteps`; agentic shimmer | LOW |

### CORRECTIONS to Wave 1 inventory
- `mobile-drawer`/`nav-item`/`nav-menu` were misclassified as EXTRA — they're upstream-canonical, just not surfaced in `registry.json`.
- Wave 1's "orphan files in `src/components/`" list was wrong — none of those 18 listed paths actually exist. `src/components/` has exactly 9 source files, all properly re-exported.

---

## Decisions you need to lock in

These shape Phases B+ scope. Pick one option per question.

### D1 — Identity choices that diverge from upstream
For each, choose: **revert to upstream** / **keep Weekend** / **upstream-default + Weekend-theme override**.

| Item | Upstream | Weekend |
|---|---|---|
| Switch ON-state color | `#6B97FF` (signature blue) | `var(--foreground)` (mono) |
| Pill radius | `rounded-[20px]` (20px) | `rounded-2xl` (16px) |
| Button variants | 4 (`primary/secondary/tertiary/ghost`) | 7 (added destructive/success/outline/link) |
| `bg-secondary` usage | Forbidden via eslint | Used heavily |
| fluid-dark surface darkness | upstream values | 2 shades darker in our overrides |
| Tabs default style | Rich/animated | Simple Radix (we shipped) |

**Recommendation**: I'd default to **upstream values for fluid theme, Weekend overrides at `[data-theme="weekend-*"]`**. That preserves Weekend's identity where it matters and lets fluid theme actually look like fluid. Variants on Button are arguably a Weekend extension worth keeping — they cover real UX surfaces (destructive delete, success confirm) — but reverting Button's `default` from our `tertiary` back to upstream's `primary` is correct.

### D2 — Phase D scope (which missing primitives to port)
- **Build now**: Dropdown + MenuItem (general-purpose menu surface — agent-built apps will want it)
- **Defer until consumer needs**: CheckboxGroup, RadioGroup
- **Skip / replace**: TabsSubtle (we have Seg with overlapping intent), ThinkingIndicator (defer)

If you disagree, say so.

### D3 — Per-component fidelity floor
For each major-drift HIGH component, choose: **upstream verbatim** / **upstream-aligned with Weekend tweaks** / **rebuild ours from scratch on upstream's foundation**.

Most should be **upstream verbatim** — that's what the audit is for. Only deviate when there's a clear Weekend reason (e.g., Button's extra variants).

---

## Phase plan

### Phase F — Foundation (sequential, single PR, blocks all others)
**Goal:** every primitive in Phases B+ can rely on canonical foundations.

| Step | Effort | Risk |
|---|---|---|
| Port `lib/springs.ts` to framer-motion v12 `{type, duration, bounce}` API | 0.5 day | Low — only DS-internal consumers |
| Port `lib/icon-context.ts` + new `lib/icon-map.tsx` (lucide/tabler/phosphor/hugeicons runtime swap, 440 LOC). Default to lucide for back-compat. Update DS components to consume via context. | 1 day | Medium — public API change but Weekend doesn't import icons through it |
| Port `lib/shape-context.ts` to Provider + R-key + `transitionShape` helper. Mount Provider in Weekend app shell with default `pill`. | 0.5 day | Medium — requires Provider injection in Weekend |
| Replace `hooks/use-proximity-hover.ts` with upstream verbatim (axis option, rAF, transform-aware, `useRegisterProximityItem`) | 0.5 day | Low |
| Token additions: `--checker-a/b`, `html.transitioning`, `shimmer-text` keyframes, `spinner-move/dash` keyframes. Bump pill radii to `20px`. Apply per-theme value reconciliation per D1. | 1 day | Low |
| Run `pnpm --filter @weekend/design test`; smoke /dev/ds | 0.25 day | — |

**Total: ~3.5 days; single PR; single agent.**

### Phase B — Primitive fidelity sweep (parallel after F)
Each PR is one component (or tight pair). Each agent gets the audit doc as its spec.

| PR | Scope | Effort |
|---|---|---|
| B1 | Accordion + AccordionGroup overlay | 2–3 days |
| B2 | Tooltip framer-motion port | 1 day |
| B3 | InputCopy 3-state machine + `<mark>` | 1 day |
| B4 | Registry Select animated layers + missing exports + keyboard nav | 2 days |
| B5 | Slider full port (~1570 LOC) | 3 days |
| B6 | Switch identity revert (or D1 deviate) + drag/morph behavior | 1.5 days |
| B7 | Button D1 deviation + spinner keyframes + `leadingIcon`→`icon` rename | 1 day |
| B8 | Badge `forwardRef` + shape-context + sizes; ThinkingSteps visual bug | 1 day |
| B9 | Dialog cosmetic alignment | 0.5 day |

**Total wall time if dispatched all-parallel: ~3 days. Sequential: ~13 days.**

### Phase C — ColorPicker port (independent track, parallelize with Phase B)
**Scope:** port the ~1726-LOC upstream ColorPicker (HSV/HSL/OKLCH + eyedropper + format dropdown + popover scaling + parseColor/buildParsed). Add `ColorSwatch`, `ColorTile`, `ColorPickerPopover` exports. Add tests.

**Effort: ~3 days.** Single agent, separate PR. The size warrants its own dedicated review.

### Phase D — New ports (after Phases B + C)
| PR | Scope | Effort |
|---|---|---|
| D1 | Dropdown + MenuItem (menu surface, single-select) | 2 days |
| D2 | CheckboxGroup + RadioGroup (paired — shared infra) | 1.5 days |
| (deferred) | TabsSubtle, ThinkingIndicator | — |

### Phase E — Cleanup + visual re-verify
- Update `INVENTORY.md` to reflect post-fix state and correct Wave 1's misclassifications.
- Reconcile our Tabs (D1 decision) — likely a `variant="rich"` addition, not a replacement.
- Decide Seg vs TabsSubtle — they overlap in intent; rename Seg or keep both?
- Eyeball `/dev/ds` against `fluidfunctionalism.com`; produce `AUDIT/RESIDUAL.md` with anything still off.
- Update `INVENTORY.md` to mark all components `EXISTS, identical-to-upstream`.

**Effort: ~1 day.**

---

## Total effort estimate

| Phase | Sequential | Parallel | Single agents |
|---|---|---|---|
| F | 3.5 days | 3.5 days (sequential prereq) | 1 |
| B | 13 days | 3 days (9-way parallel) | 8–9 |
| C | 3 days | parallel with B | 1 |
| D | 3.5 days | 1.5–2 days | 2 |
| E | 1 day | sequential after others | 1 (or me) |
| **Total** | **~24 days** | **~7 wall-time days** | **~13 agent dispatches** |

If we skip the deferred Phase D primitives and accept Weekend deviations on D1 wholesale (no upstream revert for Switch color, Button variants, etc.), wall-time drops to ~5 days.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Phase F's `useShape` Provider change breaks Weekend's app shell or `/dev/ds` route | Add Provider near app root in Phase F's PR; keep `useSyncExternalStore` fallback signature for one transition cycle |
| Phase F's icon-system change requires Weekend to update icon imports | Default `useIcon` to lucide; expose backward-compat shim that maps our 6 camelCase names to upstream's kebab-case |
| Phase B5 (Slider port) introduces user-visible behavior change in any Weekend consumer | Audit Weekend Slider consumers (currently zero — Slider was deleted as unused; check if anyone re-added). If consumers exist, plan a migration commit alongside |
| Switch ON-state color change (D1) is user-visible | If user confirms upstream blue, ship behind a Weekend theme override at `[data-theme="weekend-*"]` so weekend keeps mono and fluid gets blue |
| ColorPicker port (Phase C) takes longer than estimated | Worst case: timebox Phase C to 4 days; if not landing, ship a stub that throws with a "not yet ported" message and defer real port |
| Phase B agents can't run in parallel because they all touch shared `lib/` files | Phase F lands all `lib/` changes first; Phase B agents only touch their component file + CSS + test |

---

## What to do right now

1. **Lock in D1, D2, D3 above.** Without these, Phase B agents will improvise.
2. **Dispatch Phase F as a single sequential agent.** ~3.5 days; single PR; everything else blocks on it.
3. **After F lands, dispatch Phases B + C in parallel.** Up to 9 agents. Wall time ~3 days.
4. **Phase D + E come last.** Optional/cleanup.

If you want to start without locking decisions, the safest defaults are:
- D1: upstream-verbatim for tokens; Weekend retains Button extra variants and `data-theme="weekend-*"` overrides for surfaces.
- D2: build Dropdown + MenuItem now; defer the rest.
- D3: upstream-verbatim everywhere except Button (keep extra variants).

Say which set, and I'll dispatch Phase F.
