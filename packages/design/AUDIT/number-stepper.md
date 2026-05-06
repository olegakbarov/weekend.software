# Audit: NumberStepper

**Status**: not-in-upstream

**Upstream source**: _none_ — this component does not exist in `fluid-functionalism-upstream` (verified in `registry/default/`, `components/ui/`, `app/docs/`).
**Our source**: `packages/design/src/components/number-stepper.tsx` (+ `number-stepper.css`)

## Context

The closest upstream concept is the inline numeric editor inside `Slider`'s `ValueDisplay` (a `<input type="number">` that opens on click), but that's an internal component, not a reusable `NumberStepper`. Upstream relies on plain `Slider` for ranged values; for free-form numeric input it would compose `InputGroup` + an HTML number input.

This is therefore a Weekend addition with no parity expectation. The audit below is a self-consistency check against patterns the rest of the design system uses.

## API drift

N/A — no upstream to compare. For internal consistency:

| Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | `number` | required | controlled-only — no `defaultValue` |
| `onChange` | `(value: number) => void` | required | |
| `min` | `number` | `1` | unusual default — most numeric controls default to `0` |
| `max` | `number` | `9999` | arbitrary |
| `step` | `number` | `1` | ✓ |
| `className` | `string` | — | ✓ |
| `ariaLabel` | `string` | — | applied to both the wrapper `role="group"` AND the `<input>`; usually only the group needs it |

**`min: 1` default** is odd — combined with the implementation's `disabled={value <= min}`, a stepper rendered with no `min` prop refuses to go below 1 silently. The Slider in the same package defaults `min: 0`. Worth aligning to `min: 0` unless this stepper is specifically for "count" semantics (e.g. quantity pickers), in which case the default should be documented inline.

## Visual drift

Self-consistency notes (no upstream baseline):

- Height `32px` matches `.btn` and `.ds-select-trigger` (`h-8`). ✓
- Border + `var(--radius-control)` matches form-control pattern. ✓
- Buttons use `−` and `+` text glyphs, **not icons**. Other Weekend controls use lucide icons (`ChevronDown` for select, etc.). Inconsistent — should probably use `Minus` / `Plus` icons from lucide for visual rhythm.
- Inner buttons are `28px` wide with no min hit-target — borderline tappable on touch.
- Buttons use `border-right` / `border-left` separators rather than `gap`. Upstream-style is gapless inset-borders for grouped controls (see `InputGroup`). Acceptable.
- **No focus-visible styling on the input or buttons.** Other Weekend controls use the `box-shadow: 0 0 0 2px var(--background), 0 0 0 3px var(--focus-ring)` ring. The `<input>` is keyboard-focusable but invisibly so on focus.
- **No press / active state** — buttons just hover. Compare with `.btn` which scales the bg to 0.98 on active.
- Numeric input uses `font-feature-settings: "tnum"` ✓ (good, tabular alignment).

## Behavioral drift

- **Hold-to-step**: not implemented. Pressing and holding `+` / `−` does nothing — only single click increments. Most steppers (HTML5 `input[type=number]` spinner buttons, iOS UIStepper) auto-repeat on hold. Optional polish.
- **Wheel / arrow-key step**: native `<input type="number">` arrow keys + scroll wheel work for free, but the `−` / `+` buttons don't expose the same affordance to keyboard users for the wrapper. Acceptable.
- **Validation**: `onInput` parses with `parseInt(..., 10)` — silently rejects non-integer steps even though `step` accepts a number. If `step={0.1}` is passed, fractional input is dropped on every keystroke.
- **`Number.NaN` handling**: empty string → `parseInt` → `NaN` → no `onChange` fires, value stays. The displayed input value goes empty visually but the underlying state is unchanged. Acceptable for a controlled input.
- **No spring/icon dependencies** — pure CSS, no framer-motion, no `useShape`, no icon. Doesn't inherit from `_lib-springs.md` or `_lib-icon-and-icon-context.md`.

## Severity
**low** — works, no upstream to drift from. The two notable issues are (1) odd `min: 1` default and (2) integer-only step despite `step: number` type.

## Recommended fix

1. **Change default `min` from `1` to `0`** for consistency with Slider and to avoid the silent floor.
2. **Use `parseFloat` instead of `parseInt`** so non-integer `step` values work, or document that NumberStepper is integer-only and constrain `step?: number` to `1 | 5 | 10` etc.
3. **Add focus-visible ring** to match the rest of the control suite (`box-shadow: 0 0 0 2px var(--background), 0 0 0 3px var(--focus-ring)` on the input and buttons).
4. **Replace `−` / `+` text with lucide `Minus` / `Plus`** so icon stroke-width matches other components.
5. (Optional) Add hold-to-step using `setInterval` after a 300ms delay on `pointerdown`.
