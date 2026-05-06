# Audit: Accordion

**Status**: major-drift

**Upstream source**: `registry/default/accordion.tsx` (commit `d850ecf`, 823 lines)
**Our source**: `packages/design/src/registry/accordion.tsx` (100 lines)

The upstream is an elaborate composition with proximity-hover overlays,
focus-rect tracking, dual-text weight transitions, an `AccordionGroup`
wrapper, and a chevron-rotation spring. Our copy is acknowledged in its own
header comment as **"a simplified port"** that "skips the proximity overlay
layer." That note understates the diff: we are missing roughly 87% of the
upstream code surface.

## API drift

- **Missing exports**: `AccordionGroup` is upstream's primary composition
  primitive (gated `proximity-hover`, animated expanded backgrounds, focus
  ring overlay, single/multiple value modes, `collapsible`). We don't export
  it at all (verify via `packages/design/.consumers/`).
- **Missing props on `Accordion`**: upstream `Accordion` takes
  `type | collapsible | defaultValue | value | onValueChange` and manages
  internal state for both single and multiple modes; ours is `Accordion =
  AccordionPrimitive.Root` direct re-export, so the controlled/uncontrolled
  shim and `StandaloneOpenContext`/`StandaloneToggleContext` are gone.
- **`AccordionItem`**: upstream takes `value, index, disabled, children` and
  registers itself with the proximity hover system + standalone background
  layer. Ours is a thin Radix `Item` wrapper with a `border` and
  `data-[state=open]:bg-muted/40`.
- **`AccordionTrigger`**: upstream renders a dual-layer text grid (invisible
  semibold layer reserves width so the visible weight transition doesn't
  cause layout shift) and an animated chevron. Ours uses a single text node
  + a `transition-transform` chevron — no width-stable typography pattern.
- **`AccordionContent`**: upstream uses `springs.moderate` with **bounce: 0**
  override (with a code comment explaining why height shouldn't bounce).
  Ours uses `springs.moderate` raw and adds `opacity` to the in/out anim
  (upstream animates only `height`).

## Visual drift

- Item container: ours wraps every item with `border border-border/60` +
  rounded `shape.container`; upstream items have **no per-item border** —
  separation is via `gap-0.5` between items in the group, with hover/expand
  rendered as absolutely-positioned overlays inside the group container.
- Hover: upstream paints `bg-accent/40 dark:bg-accent/25` overlay tracked
  to the proximity-active item, with a focus-ring overlay (`#6B97FF`,
  2-pixel offset). Ours uses bare `hover:bg-hover` Tailwind.
- Expanded background: upstream paints `bg-accent/20 dark:bg-accent/12`
  spanning the full open item rect; ours uses `data-[state=open]:bg-muted/40`
  on the item element itself.
- Trigger sizing: upstream `px-3 py-2`, ours `px-4 py-3`.
- Chevron: upstream `chevron-right` (rotates 90° down via framer
  `springs.fast`); ours `chevron-down` (rotates 180° via Tailwind
  `transition-transform`).
- Text weight: upstream label switches `fontWeights.normal` →
  `fontWeights.semibold` on open with `duration-80` transition; ours sets
  `fontWeights.medium` always.
- Focus: upstream paints a separate animated focus rect overlay; ours uses
  `focus-visible:ring-2 ring-[#6B97FF]` Tailwind.

## Behavioral drift

- **Proximity hover** is the centerpiece interaction in upstream and is
  absent from our port. The hover indicator slides between items as the
  cursor approaches; mouseover an expanded item's content area suppresses
  the hover overlay (see upstream lines 297–321).
- No keyboard focus ring tracking (we rely on Tailwind `focus-visible`).
- No remeasurement on open/close — upstream re-runs `measureItems` +
  `measureFullItems` on `openValuesKey` change and on every `motion.div`
  `onUpdate`. Without this, sibling-item rects drift during animation.
- No `AnimatePresence initial={false}` correctness around the standalone
  background paint; ours wraps `motion.div` inside `AnimatePresence` on
  every render of `AccordionContent`, which is a bit of a no-op since the
  child is never conditionally mounted.
- Spring shape: upstream's `springs.fast` / `springs.moderate` use the v12
  `{ duration, bounce }` API; ours uses legacy stiffness/damping. **See
  `_lib-springs.md` (referenced)** — every animated component in this
  package inherits that drift.

## Severity

**high** — the proximity-hover overlay system is upstream Accordion's
identity. We don't ship `AccordionGroup` at all, so any consumer who needs
the group treatment has no path. Even single-item visuals diverge in
spacing, border treatment, chevron direction, and weight transition.

## Recommended fix

Port `AccordionGroup` and the `useProximityHover` integration verbatim;
adopt upstream's per-item rect-tracking + AnimatePresence overlays. As a
prerequisite, finish the `useProximityHover` parity work flagged in
`INVENTORY.md`. Update `AccordionTrigger` to upstream's dual-text weight
pattern and chevron-right composition. Drop the per-item border and bg
overrides — they become incompatible once the overlay system is in place.
Inherits spring drift (`_lib-springs.md`) and icon-context drift
(`_lib-icon-and-icon-context.md`).
