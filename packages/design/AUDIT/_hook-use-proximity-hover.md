# Audit: hooks/use-proximity-hover

**Status**: minor-drift (in the **opposite direction** of what Wave 1 flagged — upstream is the more sophisticated implementation; ours is the simpler subset)

**Upstream source**: `registry/default/hooks/use-proximity-hover.ts` (commit `d850ecf`)
**Our source**: `packages/design/src/hooks/use-proximity-hover.ts`

## Re-classification of Wave 1 finding

Wave 1 INVENTORY.md (line 241) wrote:

> Drift expected — ours has `axis: "x" | "y"` option, rAF batching,
> transform-aware coordinate mapping, "inside-rect → containing index else
> closest" logic, and uses `offset*` props. Upstream is simpler.

**This is inverted.** Reading the upstream file at the pinned commit
`d850ecf`, **upstream** is the file with `axis`, rAF batching, transform-
aware coords, `useRegisterProximityItem`, and the "inside-rect first,
closest fallback" logic. **Ours** is the simpler subset.

The most plausible explanation: at the time Weekend forked, upstream was
the simpler version, Weekend added the sophisticated features locally, and
upstream then adopted the same improvements (or independently arrived at
them). At commit `d850ecf` the canonical version is the sophisticated one
— so our local file is now the **lagging** copy.

Without `git log` access on the upstream clone (permissions denied) I can't
confirm the timeline; the conclusion above rests on the file contents at
the pinned commit, which is the authority for fidelity audits.

## API drift

### Upstream surface
```ts
export interface ItemRect {
  top: number; height: number; left: number; width: number;
}
export function useProximityHover<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  options?: { axis?: "x" | "y" },     // ← optional axis, default "y"
): {
  activeIndex: number | null;
  setActiveIndex: (i: number | null) => void;
  itemRects: ItemRect[];                // ← dense array of `ItemRect`
  sessionRef: RefObject<number>;
  handlers: {
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
  registerItem: (index: number, element: HTMLElement | null) => void;
  measureItems: () => void;
};

export function useRegisterProximityItem(
  registerItem, index, ref,
): void;
```

### Our surface
```ts
export interface ProximityRect {            // ← different name
  readonly top: number;
  readonly left: number;                    // ← key order differs
  readonly width: number;
  readonly height: number;
}
export interface ProximityHandlers { onMouseEnter, onMouseMove, onMouseLeave }
export interface ProximityHoverApi {
  activeIndex: number | null;
  setActiveIndex: (i: number | null) => void;
  itemRects: ReadonlyArray<ProximityRect | undefined>;  // ← sparse, undefined-tolerant
  sessionRef: RefObject<number>;
  handlers: ProximityHandlers;
  registerItem: (index: number, element: HTMLElement | null) => void;
  measureItems: () => void;
}
export function useProximityHover(
  containerRef: RefObject<HTMLElement | null>,
): ProximityHoverApi;                          // ← no generic, no options
// useRegisterProximityItem: NOT EXPORTED
```

### Drift summary

| Aspect | Upstream | Ours | Drift |
|---|---|---|---|
| Generic over `T extends HTMLElement` | yes | no — fixed `HTMLElement` | ours less flexible |
| `options.axis: "x" \| "y"` | yes (default `"y"`) | **MISSING** — Y-axis hard-coded via 2D distance | ours: any horizontally-scrolled menu picks wrong item |
| rAF batching of `mousemove` | yes (`requestAnimationFrame` + `cancelAnimationFrame` cleanup) | **MISSING** — synchronous on every mousemove | ours: more re-renders on fast cursor movement |
| Coord source | `offsetTop`/`offsetLeft`/`offsetWidth`/`offsetHeight` (transform-immune) | `getBoundingClientRect()` (transform-affected) | drift |
| Container scale compensation | computes `layoutSize / visualSize` and applies | none | ours: wrong target if any ancestor has `transform: scale(...)` |
| Scroll compensation | accounts for `container.scrollLeft/scrollTop` and `clientLeft/clientTop` | none — relies on bounding-rect, which already includes scroll | conceptually equivalent for non-transformed containers; diverges otherwise |
| "Inside rect" priority | `containingIndex` wins over `closestIndex` | always closest-center | ours: cursor hovering item 2 selects item 3 if 3's center is closer than 2's |
| `measureItems` re-runs on enter | no (separate explicit call) | yes (`onMouseEnter` calls `measureItems`) | ours: refresh on enter (good for layout-shifted parents) |
| Cleanup on unmount | cancels pending rAF | nothing to cancel | ours: trivially correct |
| Cleanup on `mouseleave` | cancels pending rAF + sets activeIndex null | sets activeIndex null only | ours: trivially correct (no rAF to cancel) |
| `useRegisterProximityItem(registerItem, index, ref)` helper | exported | **MISSING** | consumer must reimplement the `useEffect` |
| Rect type name | `ItemRect` | `ProximityRect` | ours is more namespaced |
| Rect array shape | dense `ItemRect[]` (sparse holes are `undefined` at runtime, type-cheats) | `ReadonlyArray<ProximityRect \| undefined>` (type-honest sparse array) | ours is type-safer |
| Field order in rect | `top, height, left, width` | `top, left, width, height` | cosmetic |

## Visual drift
- **Horizontally-laid-out indicator (e.g. tabs underline) tracks the wrong item in ours when distances along Y dominate.** Concrete: a horizontal tab strip with mouse at `(x = tab2_center, y = tab1_y - 30)` will compute closest by Euclidean 2D distance and may pick tab1 because `dy` dominates. Upstream's `axis: "x"` would only consider X distance and pick tab2 correctly.
- **Inside any ancestor with CSS `transform: scale(0.95)`** (we use this for "press" feedback on cards), our hook clicks the wrong item: the `getBoundingClientRect` numbers are post-transform, the cursor is post-transform, so it self-corrects — _however_, if items are measured via `bounding rect` while the container itself has the transform applied at a different time (e.g. animated scale-down on enter), the rect cache and the live cursor disagree for one frame. Upstream's `offsetTop/offsetLeft` + scale compensation avoids this entire class of bug.
- **Higher render churn under fast-moving cursors.** Without rAF batching, every `mousemove` event causes `setActiveIndex` even if the destination index hasn't changed. React 18+ batches the eventual re-render, but the hook still recomputes on every single mousemove instead of at most once per frame.

## Behavioral drift
- **No `useRegisterProximityItem`** in our exports → call sites have to inline the registration `useEffect` themselves. Upstream's helper:
  ```ts
  useEffect(() => {
    registerItem(index, ref.current);
    return () => registerItem(index, null);
  }, [index, registerItem, ref]);
  ```
- **`measureItems()` runs on enter in ours** but not in upstream. This compensates somewhat for the missing `useEffect`-based remeasure on layout shift, but means we re-measure on every enter even when nothing changed. Trade-off: more cycles vs more correctness on stale rects.
- **Strict-mode safety**: both versions are correct under React Strict Mode (no double-registration, no leaked rAFs).
- **SSR**: ours doesn't reference `document`/`window` outside of `useEffect`/handler bodies, so neither hook breaks SSR.

## Severity
**medium**. Why not high:
- The hook is consumed by Tabs / nav indicators where the missing `axis` does cause visible bugs but the rest of the UI is fine.
- The transform-coord drift only matters under specific scale animations.
- Render-churn cost is small at human cursor speeds.

Why not low:
- The Tabs component (or any horizontal indicator) needs `axis: "x"` to look right; our component-level Tabs file likely works around this with an explicit `clientX`-only computation. Wave 2B should look at how `tabs.tsx` consumes the hook and whether it duplicated the axis logic.
- `useRegisterProximityItem` is a published API in upstream; consumers porting code over hit a missing-export error.

## Recommended fix
**Replace our `use-proximity-hover.ts` with the upstream version verbatim.**
The upstream implementation strictly dominates ours: same surface plus
`axis`, rAF batching, transform-aware coords, "inside-rect first" priority,
and the `useRegisterProximityItem` helper. The only API rename needed is:

- Re-export `ItemRect` (upstream name) **as well as** `ProximityRect` (our
  name) from the migrated file, so existing call sites in our codebase
  don't break. Mark `ProximityRect` as `@deprecated — use ItemRect`.
- Re-export the upstream return type as `UseProximityHoverReturn`; alias
  `ProximityHoverApi` to it for back-compat.

Cross-cutting note for Wave 2B–F: when auditing **Tabs** specifically, look
for any inlined "X-only" distance math — once we adopt upstream's
`useProximityHover({ axis: "x" })`, that workaround can go.
