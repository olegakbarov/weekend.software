# Audit: Seg

**Status**: not-in-upstream (Weekend addition that overlaps conceptually with upstream `TabsSubtle`)

**Upstream source**: _no direct equivalent_. The closest upstream component is `registry/default/tabs-subtle.tsx` (with corresponding `app/docs/tabs-subtle/page.tsx`), which provides the same "segmented control / pill picker" pattern but with a different API and richer interaction model.
**Our source**: `packages/design/src/components/seg.tsx` (+ `seg.css`)

## Conceptual overlap

`Seg` and upstream `TabsSubtle` both render a horizontal row of buttons with a single moving "active" pill behind the selected item. Differences below.

| | Upstream `TabsSubtle` | Our `Seg` |
|---|---|---|
| Composition | Compound (`<TabsSubtle><TabsSubtleItem index={0}>…</TabsSubtleItem></TabsSubtle>`) | Data-driven (`<Seg items={[…]} value={…} onChange={…} />`) |
| Variants | Single style (subtle pill) + `activeLabel` mode (label hides on inactive icon-only tabs) | Two variants: `filled` (plate-on-muted-track) and `subtle` (closer to upstream's TabsSubtle) |
| Layout | Horizontal flex, scrolls on overflow, individual items resize-observed | Horizontal flex (`filled`) or 2-column grid via `grid` prop (`filled` only) |
| Plate animation | framer-motion (springs.moderate) on `selectedRect` motion-div | CSS `transition: transform/width var(--spring-moderate-ms)` on a single span |
| Hover pill | Yes — separate hover-pill + selected-pill that animate independently using `useProximityHover` | No — only the selected plate moves; hover is a `color` change only |
| Focus ring | Animated outer focus-ring rect that follows focused tab | None |
| Keyboard nav | Full Arrow/Home/End handling, `tabIndex` rotation | None — buttons are individually tabbable, no roving tabindex |
| ARIA | `role="tablist"` + `role="tab"` + `aria-controls` + `aria-selected` (and a separate `<TabsSubtlePanel>` for content) | `role="tablist"` + `role="tab"` + `aria-selected` (no `aria-controls`, no panel pairing — it's a picker, not a tab system) |
| Icons | `useIcon`-driven (4-library swap + stroke-width hover anim) | Plain `IconComponent` rendered at fixed `size={12}` |
| Labels | Per-tab `label: string` + optional `icon: IconComponent` | Per-item `label: string` + optional `icon: IconComponent` |

## API drift

`Seg` is not trying to be `TabsSubtle` — they have different goals. Seg is a **picker / segmented control** (think iOS `UISegmentedControl`); TabsSubtle is a **tab navigator** with panels. The "drift" classification depends on intent:

- If Weekend wants a segmented picker, `Seg` is reasonable but should not pretend to be tabs (`role="tablist"` is borderline misuse without panels — `role="radiogroup"` with `role="radio"` is a better fit semantically).
- If Weekend wants tabs, drop `Seg` and use `TabsSubtle` from `@weekend/design/registry`.

Internal consistency notes:

| Prop | Type | Default | Notes |
|---|---|---|---|
| `items` | `ReadonlyArray<SegItem<T>>` | required | clean generic typing ✓ |
| `value` | `T` | required | (no undefined — must be controlled to a known value) |
| `onChange` | `(value: T) => void` | required | ✓ |
| `grid` | `boolean` | `false` | only meaningful for `variant="filled"` |
| `variant` | `"filled" \| "subtle"` | `"filled"` | ✓ |
| `className` | `string` | — | ✓ |

The `grid` prop is silently ignored when `variant="subtle"` (per inline comment) — would be cleaner to encode this with a discriminated union or warn in dev.

## Visual drift

Compared to upstream's `TabsSubtle`:

- **Plate animation**: ours is CSS `transition` on `transform`/`width` — runs in the compositor, no JS overhead, but **doesn't respect the spring** that the rest of the system uses (springs are framer-motion `{ type: "spring", ...}` for the registry components). Visually noticeable on direct comparison: ours has a constant-velocity ease, upstream has a spring with bounce profile.
- **No hover pill**: this is the most visible interaction loss. Hovering an inactive tab in upstream shows a softer secondary pill that slides toward the cursor; ours just changes the foreground color. Loses the "magnetic" feel that's central to fluid-functionalism's identity.
- **No focus ring**: a focused tab gets the browser default outline (or none, depending on UA). Upstream renders an animated `border border-[#6B97FF]` rect around the focused tab. Accessibility regression.
- **`subtle` variant**: our subtle plate is `var(--accent)` background — upstream `TabsSubtle` uses `bg-selected/50 dark:bg-accent/40` (alpha-blended for soft layering). Different look.
- **Filled variant plate**: `var(--card)` (white in light themes) on a `var(--muted)` track. Looks more like an iOS segmented control. No upstream equivalent — Weekend-specific.
- **Icons fixed at 12px**: too small for the default 28px button height (upstream uses `size={16}` for tab icons in `TabsSubtle`). Visually feels under-scaled.
- **Border radii**: `calc(var(--radius-container) - 4px)` for the inner button radius (matches a `padding: 3px` outer), which is a sensible inset trick. Upstream uses `useShape().bg` for the pill's radius and lets the layout container drive its own.

## Behavioral drift

- **No keyboard navigation**: arrow keys do nothing. Tab cycles every button (no roving tabindex). Upstream `TabsSubtle` has full ArrowLeft/Right + Home/End + roving tabindex.
- **No proximity hover** ("magnetic" hover that pre-shows the hover pill). Upstream uses `useProximityHover({ axis: "x" })` and animates the hover-pill with `useProximityHover` rects. Ours has only mouse-over color flips.
- **Plate measurement**: uses `useLayoutEffect` + `offsetLeft/Top/Width/Height` on `button[data-active="true"]`. Upstream uses a `useProximityHover`-managed `itemRects` array updated via `ResizeObserver`. Ours doesn't observe resize — if the tab labels grow at runtime (i18n, dynamic content), the plate goes out of sync until the next `value/items` change.
- **`PlateRect.ready` flag**: nice touch — plate doesn't render until measured, avoiding a flash at `(0,0)` on first paint. ✓.
- **No spring/icon-context dependency** — no framer-motion, no `useShape`, no `useIcon`. Doesn't inherit `_lib-springs.md` drift directly, but the `var(--spring-moderate-ms)` token *does* reflect part of the spring system; that token is currently `300ms` per `tokens.css`, which is mathematically a different curve than upstream's spring `{ duration: 0.3, bounce: 0 }` ease.

## Severity
**medium** — Seg is functional but visibly less polished than upstream's TabsSubtle. The biggest perceivable losses are: (1) no hover pill, (2) no keyboard nav, (3) no resize-observation, (4) no focus ring. None are functional blockers; all hurt fidelity.

## Recommended fix

Two paths — pick one:

**Path A: Replace `Seg` with `TabsSubtle`.** If Weekend doesn't have callsites that depend on the data-driven API or the `grid` mode, deprecate `Seg`, port `TabsSubtle` from upstream, and migrate consumers. This is the higher-fidelity path and reduces the surface area Weekend has to maintain.

**Path B: Keep `Seg` but level it up.**
1. Add proximity hover pill (port `useProximityHover` use from `TabsSubtle`).
2. Add focus ring (animated rect, same pattern as upstream).
3. Add keyboard nav (Arrow + Home/End + roving tabindex).
4. Add `ResizeObserver` on items so the plate stays aligned with dynamic content.
5. Bump default icon size to 16; expose `iconSize?` if 12 is needed.
6. Consider `role="radiogroup"` + `role="radio"` instead of `role="tablist"` since there are no associated panels.

Either way, document `Seg` vs `TabsSubtle` in CLAUDE.md so future agents know which to reach for.
