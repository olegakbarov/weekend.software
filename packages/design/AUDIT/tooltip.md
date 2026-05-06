# Audit: Tooltip

**Status**: major-drift

**Upstream source**: `registry/default/tooltip.tsx` (commit `d850ecf`, 145 lines)
**Our source**: `packages/design/src/registry/tooltip.tsx` (54 lines)

## API drift

Missing exports:

- `TooltipPortalContainer` — upstream provides a Context provider that lets
  consumers nest the tooltip's portal inside a CSS-scaled ancestor so the
  tooltip visually scales with its surroundings (used by upstream `/demo`
  carousels). Missing in ours.
- `TooltipSide` — explicit type alias for `"top" | "right" | "bottom" | "left"`.
  We inline the union on `TooltipProps.side`.

Different prop defaults:

- `delayDuration`: upstream **200**, ours **300**.
- `sideOffset`: upstream **8**, ours **4**.
- `children` typing: upstream `React.ReactElement` (Radix asChild requires a
  single element child); ours loosens to `ReactNode`. With `Radix.Trigger
  asChild`, our typing accepts compositions Radix will runtime-warn about.

## Visual drift

Animation system entirely different:

- **Upstream**: framer-motion `motion.div` inside Radix Content. On open it
  animates `{ opacity: 0, x|y: ±4 } → { opacity: 1, x: 0, y: 0 }` using
  `springs.fast`. On close it tweens `opacity → 0, duration: 0.1`. Origin
  per side via `getSlideOffset(side)` (top: `y: 4`, bottom: `y: -4`,
  left: `x: 4`, right: `x: -4`). Implements its own `mounted` gate +
  `onAnimationComplete` so it can render through exit.
- **Ours**: no framer-motion. Uses Tailwind animate utilities
  (`data-[state=delayed-open]:animate-in data-[state=closed]:animate-out
  data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0`).
  Relies on Radix's `data-state` and the `tw-animate` plugin (or shadcn's
  fade keyframes) being available in the consumer's Tailwind config.
- Net effect: upstream slides + fades with a directional spring matching
  the placement; ours fades only, no slide, no spring.

Missing `shape` integration:

- Upstream: `shape.bg` (rounded class chosen from `useShape()`). Reacts to
  the user's shape preference (square / rounded / pill).
- Ours: hard-coded `rounded-md`. No shape integration.

Missing `font-weight` integration:

- Upstream: `style={{ fontVariationSettings: fontWeights.medium }}` — the
  tooltip text renders at `wght 500`.
- Ours: no `fontVariationSettings`; falls back to whatever the parent's
  weight is (typically `wght 400`). Visually thinner text.

Shadow:

- Upstream relies on the tooltip pill being a small dark rect — **no
  explicit shadow** in upstream. The colors `bg-foreground text-background`
  carry the contrast.
- Ours adds `shadow-[0_4px_12px_rgba(0,0,0,0.18)]`. Difference is subtle on
  light theme (small drop) and a no-op on dark.

z-index:

- Upstream puts `z-50` on the Radix `Content` (parent of the motion.div).
- Ours puts `z-50` on the inner styled element. Effectively the same when
  Radix renders Content into a fresh stacking context, but differs if the
  consumer overrides Content's class.

## Behavioral drift

Missing controlled sync:

- Upstream `forceOpen` overrides the internal open state and the
  `onOpenChange` callback fires _before_ `forceOpen` is applied (i.e. the
  consumer is informed of intent even when forced). Ours simply spreads
  `{open: forceOpen}` onto Radix and `onOpenChange` if provided — Radix
  handles the rest, and our callback only fires when uncontrolled.
- Ours uses object-spread guards (`forceOpen !== undefined ? { open: forceOpen } : {}`)
  rather than passing `undefined`. Behaviorally similar but the upstream
  design intentionally synthesizes `open` so it can also gate `mounted`
  exit animation via `onAnimationComplete`. Without that, our exit cannot
  animate (Radix unmounts immediately).

Missing portal container hook:

- Without `TooltipPortalContainer`, consumers cannot redirect the portal to
  a CSS-scaled ancestor. Affects any future `/demo` style carousel in our
  desktop, but no current consumer needs it.

Provider scope:

- Both end up calling `<TooltipPrimitive.Provider delayDuration={…}>` inside
  every `Tooltip`. That's an upstream tradeoff (each tooltip mounts its own
  provider) we faithfully copy.

Inherited drift:

- Upstream uses `springs.fast` for the open transition and a 100ms tween
  for close. We've removed both. The `springs.fast` drift documented in
  `_lib-springs.md` is therefore irrelevant for the tooltip in our current
  state — until we re-port the motion, that lib drift doesn't manifest.
- `useShape()` is consumed by upstream; we don't call it. Once `useShape`
  is re-aligned (`_lib-shape-context.md`), we still need to actually call
  it here.
- No icon-context dependency on either side, so `_lib-icon-and-icon-context.md`
  doesn't apply to Tooltip.

## Severity

**medium-to-high** — A tooltip is a small surface, but ours is visually a
different component: no slide-in motion, no shape integration, no
font-variation weight, hard-coded shadow. Upstream's tooltip is a
characteristic Fluid micro-interaction (the springy slide) and we've
replaced it with a generic shadcn fade. Visible difference on every hover.

## Recommended fix

Re-port from upstream wholesale: (1) add the `motion.div` open/close logic
with `getSlideOffset` and `springs.fast`/100ms tween; (2) use
`shape.bg` instead of `rounded-md`; (3) restore `fontVariationSettings: fontWeights.medium`;
(4) drop the explicit shadow class; (5) add `TooltipPortalContainer`
context provider and consume it via `useContext` for the portal's
`container` prop; (6) tighten `children` to `React.ReactElement`; (7) align
default `delayDuration` (200) and `sideOffset` (8). The motion-based exit
animation requires the `mounted` + `onAnimationComplete` gate so Radix
keeps the node alive long enough to fade out.
