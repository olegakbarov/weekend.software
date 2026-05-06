# Audit: NavMenu

**Status**: minor-drift (Wave 1 mis-classified as `not-in-upstream`)

**Upstream source**: `registry/default/nav-menu.tsx` (commit `d850ecf`)
(re-exported through `components/ui/nav-menu.tsx`)
**Our source**: `packages/design/src/registry/nav-menu.tsx`

> Wave 1 listed this as EXTRA. Incorrect. Upstream's `registry/default/`
> contains a canonical `nav-menu.tsx` consumed by `app/components/sidebar.tsx`.
> Like `mobile-drawer` and `nav-item`, it is **not in `registry.json`** and
> has **no `app/docs/nav-menu/page.tsx`**. Treat as "canonical-but-
> unregistered" upstream component.

## API drift
Identical public API:
- Component props: `children: ReactNode`, `activeSlug: string | null`,
  spread `HTMLAttributes<HTMLElement>`.
- Context shape: `{ registerItem, registerSlug, activeIndex, activeSlug }`.
- Hook export: `useNavMenu()` throws "useNavMenu must be used within a
  NavMenu" if context is null. Identical message.
- Both export named `NavMenu` and `useNavMenu`. Upstream also exports
  `default NavMenu`; we don't. We additionally export `type { NavMenuProps }`.

## Visual drift
**None functionally.** All three animated layers match upstream:
- **Active-route background**: `absolute ${shape.bg} bg-selected/50
  dark:bg-accent/40 pointer-events-none`, `springs.moderate`,
  `opacity 0.8` while hovering a different item.
- **Hover background**: `absolute ${shape.bg} bg-accent/40 dark:bg-accent/25
  pointer-events-none`, keyed by `sessionRef.current` so a fresh fade
  triggers on each hover-enter; springs.fast; init position lifted to active
  route rect when present (creates the "settle from active" feel).
- **Focus ring**: `absolute ${shape.focusRing} pointer-events-none z-20
  border border-[#6B97FF]`, expanded `+4px` with `-2px` offset. Hard-coded
  hex `#6B97FF` matches upstream verbatim — note this bypasses our
  `--focus-ring` token.
- Container: `relative flex flex-col gap-0.5 w-full select-none`. Identical.

## Behavioral drift
**Indirect drift** — both implementations are textually identical, but two
of the primitives they depend on diverge from upstream (drift inherited from
Wave 1 lib audit, not from this file):

1. **`useProximityHover` drift** (per Wave 1): ours has rAF batching,
   transform-aware coordinates, axis option, "inside-rect → containing
   index else closest" hit-testing. Upstream is simpler bounding-box.
   Visible result: hover-target selection logic differs subtly when the
   nav has CSS transforms or extreme spacing. Not a visual diff in the
   simple case.
2. **`useShape` drift** (per Wave 1): ours is a `useSyncExternalStore` hook
   reading `[data-shape]`; upstream is a Context provider with `R` keyboard
   shortcut and `transitionShape` helper that toggles `html.transitioning`.
   Visible result: shape transitions are abrupt in our package; upstream
   gets the `180ms` cross-fade.
3. **`springs` drift** (per Wave 1): the `transition` argument shape is
   different — ours is stiffness/damping, upstream is duration/bounce.
   Both are framer-motion-valid; the perceived feel differs slightly.

Keyboard nav, focus management, slug-to-index registry: identical.

## Severity
**low** for this file in isolation; **medium** when combined with the
shape-context + springs lib drift, because NavMenu is the showpiece for
the proximity-hover + shape stack.

## Recommended fix
1. **INVENTORY.md**: re-classify NavMenu as **EXISTS (drift: inherited from
   `useProximityHover` + `shape-context` + `springs`)**.
2. No edits needed in `nav-menu.tsx` itself.
3. Consider replacing the hard-coded `border-[#6B97FF]` focus-ring color
   with the `--focus-ring` CSS token Weekend already ships
   (`packages/design/src/tokens.css`). Upstream uses the literal hex
   because it has no such token; we do, and the literal currently bypasses
   it. This is a small **fidelity-improving divergence** rather than a
   regression.
4. Real wins live one layer down — fixing `useProximityHover`,
   `shape-context`, or `springs` (out of scope for this audit) propagates
   here automatically.
