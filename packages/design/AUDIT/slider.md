# Audit: Slider

**Status**: major-drift

**Upstream source**: `registry/default/slider.tsx` (commit `d850ecf`) — exports both `Slider` and `SliderComfortable`. ~1570 lines. Heavy framer-motion + Radix + proximity-aware interaction model.
**Visual reference**: `app/docs/slider/page.tsx`
**Our source**: `packages/design/src/components/slider.tsx` (+ `slider.css`) — 73 lines. Plain CSS thumb, no Radix, no springs, no range, no tooltip, no step dots.

This is the second-largest fork in the batch (after `Button`'s loading state). Weekend essentially shipped a placeholder Slider.

## API drift

| | Upstream `Slider` | Ours |
|---|---|---|
| Value | `value: number \| [number, number]` (single + range) | `value: number` (single only) |
| Change | `onChange: (v: SliderValue) => void` | `onChange: (v: number) => void` |
| `min` | `0` default | required |
| `max` | `100` default | required |
| `step` | `1` default | `1` default ✓ |
| `showSteps` | `boolean` | _missing_ |
| `showValue` | `boolean` | implicit (always shown via `format`) |
| `valuePosition` | `"left" \| "right" \| "top" \| "bottom" \| "tooltip"` | _missing_ — value is always to the right |
| `formatValue` | `(v: number) => string` | `format?: (v: number) => string` (renamed) |
| `label` | `string` | _missing_ |
| `disabled` | `boolean` | _missing_ |
| Track / fill class & style overrides | `trackClassName/Style/fillClassName/Style/hideFill` | _missing_ |
| Thumb override | `thumbColor`, `thumbBorderColor` | _missing_ |
| Component split | `Slider` (precise, range-capable) + `SliderComfortable` (chunky pip / scrubber variants) | _just_ `Slider` |

Ours is "minimum viable Slider": single value, single style. Upstream provides:
- Range (two thumbs).
- Step dots / pips.
- Tooltip-positioned value with hover preview.
- Editable inline numeric input (click value → edit).
- Keyboard accessibility via `Radix Slider`.
- Hover preview track-fill that "fills toward cursor" before click.
- A second component (`SliderComfortable`) for thicker pill-style sliders with `pips` or `scrubber` variants.

## Visual drift

- **Track height**: ours `4px`. Upstream `TRACK_BG_HEIGHT = 18px`. **4px is a thin minimal slider; 18px is a chunky modern pill.** Completely different visual language.
- **Track radius**: ours `var(--radius-pill)`. Upstream `rounded-full` ✓ same.
- **Track background**: ours `var(--muted)`. Upstream `bg-transparent` (just a border) — the muted track is filled by the alpha `bg-selected/50 dark:bg-accent/40` fill.
- **Fill**: ours fills with `var(--foreground)` (high-contrast). Upstream fills with `bg-selected/50 dark:bg-accent/40` (alpha tint). Different entirely.
- **Thumb**: ours `14px` square (1.5px border, white bg, foreground border). Upstream `THUMB_SIZE = 20px` rendered, `THUMB_SIZE_REST = 16px` resting, animates between states (springs.fast). Bigger, springier.
- **Thumb hover**: ours `transform: scale(1.15)` on `track:hover`. Upstream changes `width/height` between rest and active values via framer-motion springs. Different mechanism, similar outcome.
- **Thumb focus ring**: ours has none (the `tabIndex={0}` track gets browser-default outline). Upstream renders an animated `border border-[#6B97FF]` focus ring on the thumb sized `THUMB_SIZE + 4`. Accessibility regression.
- **Value display**: ours `<div class="ds-slider-value">` to the right, plain text, `font-variation-settings: var(--fw-semibold)`. Upstream has a full `ValueDisplay` subcomponent with click-to-edit, inline `<input type="number">`, ghost-for-layout-stability, font-weight transition on interaction, and 5 position modes (`left/right/top/bottom/tooltip`).
- **No step dots**: ours can't render step markers along the track. Upstream renders them and hides them on the filled side via a `WebkitMaskImage` linear-gradient — neat trick.
- **No hover preview** (the "ghost fill" that animates toward the cursor before click). Upstream shows a soft alpha-blended preview rect inside the track + a tooltip with the snapped value at the cursor position.
- **No tooltip** (`valuePosition: "tooltip"`). Upstream has a tooltip-floating value that springs in on hover/press and follows the active thumb.

## Behavioral drift

- **Range support**: missing. Ours can't do `[start, end]` two-thumb sliders.
- **Keyboard accessibility**: ours uses `tabIndex={0}` on the track div + `role="slider"` + `aria-valuemin/max/now`. **No keyboard handlers** — ArrowUp/Down/Left/Right, Home/End, PageUp/Down do nothing. The slider is announced as a slider but can't be operated by keyboard. Major a11y bug.
- **Pointer capture**: ours uses `window.addEventListener("pointermove"/"pointerup")`. Upstream uses `setPointerCapture` on the element. Both work; the capture approach is more robust (handles pointer cancellation, doesn't leak on unmount).
- **Touch handling**: ours doesn't `e.preventDefault()` on `pointerdown` consistently — actually it does (line 43). Upstream adds `touch-none` Tailwind class to lock touch scrolling. Ours doesn't, so iOS Safari may scroll the page while dragging.
- **Disabled state**: not modeled.
- **Snapping**: ours `Math.round(raw / step) * step` — but **doesn't account for `min` offset**. If `min=10, step=5, value=14`, raw=14 → round/5*5 = 15. With min offset: should be `Math.round((raw - min) / step) * step + min` (upstream's formula). For min=0 it's identical; for min!=0 our snap is subtly wrong. Bug.
- **Click-to-edit**: missing. Upstream lets users click the value text to type a precise number.
- **Hover delay tooltip**: upstream has 100ms delay before showing the hover tooltip; ours has none (no tooltip).
- **`ResizeObserver` reflow**: upstream re-syncs thumb position on track resize. Ours uses % positioning + CSS, so it adapts naturally without observer — for the simple Slider this is fine.
- **`onAnimationStart` / `onDrag*` `Omit` from HTMLAttributes**: upstream needs to omit these because they collide with framer-motion. Ours doesn't have any of those concerns.
- **Inherits drift from `_lib-springs.md`**: all upstream animation goes through `springs.fast` / `springs.moderate`; the math API differs (duration/bounce vs. stiffness/damping). Ours doesn't use springs at all.

## Severity
**high** — but not because the existing implementation is broken (it works for trivial single-value sliders); because **we're shipping a token-of-a-Slider** vs. upstream's full one. The keyboard accessibility hole (`tabIndex` without arrow handlers) is the most concrete bug. The `min`-offset snapping bug is a second concrete bug. Everything else is "missing features."

## Recommended fix

Decide whether Weekend wants to ship a real Slider or keep this as a placeholder.

**If shipping real**:
1. Replace this implementation with a port of `registry/default/slider.tsx` (and probably `SliderComfortable` too if any Weekend page needs the chunky variant). Adapt to our `cn`/`springs`/`shape-context`/`icon` lib paths.
2. This pulls in `@radix-ui/react-slider` + `framer-motion` as deps (likely already present).
3. Verify shape-context: upstream calls `useShape()` for thumb/tooltip backgrounds.

**If keeping the placeholder**:
1. **Fix the snapping bug**: change `Math.round(raw / step) * step` to `Math.round((raw - min) / step) * step + min`.
2. **Add keyboard handlers**: ArrowLeft/Down → `value - step`, ArrowRight/Up → `value + step`, Home → `min`, End → `max`, PageDown/Up → `± step * 10`. Both clamped.
3. **Add `disabled?: boolean`**.
4. **Add `touch-none` / `touch-action: none`** to the track for iOS scroll lock.
5. **Add focus-visible ring** on the thumb.
6. **Document explicitly** in CLAUDE.md that this is a Weekend-lite Slider and consumers needing range/dots/tooltip/click-to-edit must consume the registry version (which we should then also port).
