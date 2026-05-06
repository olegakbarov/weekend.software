# Audit: Switch

**Status**: major-drift

**Upstream source**: `registry/default/switch.tsx` (commit `d850ecf`) — Radix-based, framer-motion thumb with drag-to-toggle, hover/press shape morphing.
**Visual reference**: `app/docs/switch/page.tsx`
**Our source**: `packages/design/src/components/switch.tsx` (+ `switch.css`) — plain `<button role="switch">`, CSS `transform: translateX` on `::after` pseudo-element. ~33 lines vs. upstream's ~232.

The pattern: ours is a clean "good-enough" switch; upstream is a richer "tactile" switch with drag affordance and morphing thumb.

## API drift

| | Upstream | Ours |
|---|---|---|
| Required `label` | `label: string` (visible text label rendered next to the switch) | _no label_ — switch is just the toggle |
| `checked` | required `boolean` | required `boolean` ✓ |
| Change handler | `onToggle: () => void` (no args) | `onChange: (checked: boolean) => void` |
| `disabled` | `boolean` | `boolean` ✓ |
| `ariaLabel` | _none_ (label provides the accessible name) | `ariaLabel?: string` (used when no visible label) |
| `className` | yes ✓ | yes ✓ |
| Wrapper element | `<div>` (custom layout w/ Radix.Root inside) | `<button role="switch">` (plain button) |
| Forwarded ref | `HTMLDivElement` | `HTMLButtonElement` |

The `onToggle` vs `onChange` shape and the missing `label` mean the two are not drop-in compatible. Our shape is what most Switch components in the wild look like (`onChange(boolean)`); upstream's `onToggle: () => void` is a touch unusual but symmetric.

## Visual drift

- **Track size**: upstream `34 × 20px`. Ours `36 × 20px`. ~minor (2px wider track).
- **Thumb**: upstream `THUMB_SIZE = 16px` resting, **morphs** on hover/press:
  - Hover → `width = 18px` (`PILL_EXTEND = 2px` — pill stretches forward),
  - Pressed → `width = 20px, height = 12px` (`PRESS_EXTEND = 4`, `PRESS_SHRINK = 4` — squashes flatter and longer).
  - Ours: static `16 × 16px`, no hover/press morphing.
- **Thumb travel**: upstream computes `THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET*2 = 34 - 16 - 4 = 14px`. Ours uses `transform: translateX(16px)` which is `36 - 2*2 - 16 = 16px`. Both are correct for their track widths.
- **Track color OFF**: upstream `var(--accent)` with hover variant `color-mix(in oklab, var(--accent), var(--foreground) 10%)`. Ours `var(--neutral-300)` solid, no hover state.
- **Track color ON**: upstream `#6B97FF` (focus-ring blue) with hover `#5C89F2`. Ours `var(--foreground)` (black/white). **Big visual identity drift** — upstream switches are blue when on; ours are foreground-colored.
- **Thumb color**: upstream `bg-white` ✓. Ours `background: white` ✓. Same.
- **Thumb shadow**: upstream `shadow-sm` (`0 1px 2px rgba(0,0,0,0.05)`). Ours `0 1px 2px rgba(0,0,0,0.2)`. Ours is darker.
- **Track radius**: both `rounded-full` / `var(--radius-pill)` ✓.
- **Label**: upstream renders it inside a wrapper `<div>` next to the switch with `transition-[color]` from muted (off) to foreground (on). Ours has no inline label; consumers wrap externally.
- **Focus ring**: upstream `focus-visible:ring-1 ring-[#6B97FF] ring-offset-2 ring-offset-background` (1px ring with 2px offset gap). Ours `box-shadow: 0 0 0 2px var(--background), 0 0 0 3px var(--focus-ring)` (2px gap + 1px ring; achieves same look with box-shadow). Compatible.
- **Transition**: ours `transform var(--spring-moderate-ms) var(--ease-out-ui)` — single CSS easing curve. Upstream `springs.moderate` framer-motion (`{ stiffness, damping, mass }` — drift from upstream's duration/bounce — see `_lib-springs.md`). End feel will differ.

## Behavioral drift

- **Drag-to-toggle**: upstream tracks `pointerdown` → `pointermove` deltas, drives the thumb position directly via `motionX`, then snaps to ON/OFF based on which half the thumb finishes in (with a `DRAG_DEAD_ZONE` of 2px so a click doesn't register as a drag). Ours: pure `onClick` → `onChange(!checked)`. **No drag.**
- **Press / hover morphing**: upstream's pill-stretch animation when hovering / squash when pressing is a signature interaction — ours has none.
- **Focus management**: upstream's Radix.Root.Switch is the inner element; the outer div forwards pointer events but the Switch itself owns focus. Ours: the button is the focusable element. Both correct.
- **A11y**:
  - Upstream: full Radix Switch (`role="switch"`, `aria-checked`, keyboard Space/Enter), aria-label provided by the visible label.
  - Ours: manually sets `role="switch"` + `aria-checked` + optional `aria-label`. **Doesn't handle Space/Enter** explicitly — relies on the native `<button>` to fire `onClick` on those keys, which it does. ✓ functional.
- **Disabled**: ours `:disabled { opacity: 0.5; cursor: not-allowed }` ✓.
- **Inherits drift from `_lib-springs.md`** through upstream's `springs.moderate` thumb animation; ours uses CSS `var(--spring-moderate-ms)` which is a single duration value (200ms or whatever's in `tokens.css`) — no spring bounce, just an ease-out.

## Severity
**high** — Switch is a touchpoint of brand feel. Two visible identity issues:
1. **Color**: ON state is `var(--foreground)` (black/white) instead of upstream's `#6B97FF` blue. Anyone looking at upstream and ours side by side will notice.
2. **Tactility**: drag-to-toggle and the pill-stretch / squash animations are upstream's signature feel; we shipped a static slider.

Both reflect Weekend's "minimal & monochrome" aesthetic vs. upstream's "tactile blue accent" aesthetic. If Weekend wants its own visual language, document; if Weekend wants fluid-functionalism fidelity, port upstream.

## Recommended fix

Most-faithful path:
1. **Port upstream's drag-to-toggle and morph animations** — adapt `motionX` + framer-motion to use our `cn` and `springs`. Upstream's source is self-contained.
2. **Adopt upstream's color palette** for the track (accent off → blue on) — but verify with the design owner; Weekend may have intentionally chosen monochrome.
3. **Switch the label model**: either accept `label?: string` and render it (upstream-style — easier UX, requires more layout commitment) or keep the bare button (Weekend-style — composable, requires consumers to wire labels).
4. **Migrate the change handler** — pick `onChange(checked: boolean)` (ours) or `onToggle()` (upstream); ours is more conventional. If keeping ours, document in the absorption notes.
5. **Inherits the spring fix**: as noted in `_lib-springs.md`, decide between framer-motion duration/bounce (upstream API) vs. our stiffness/damping. Switch's morph animation is one of the more visible places this differs.

If keeping the minimal version:
- Bump the OFF track to `var(--accent)` instead of `var(--neutral-300)` (matches upstream and is theme-aware).
- Soften the thumb shadow (`rgba(0,0,0,0.05)` instead of `0.2`).
- Document explicitly that the Weekend Switch is a deliberate stylistic fork.
