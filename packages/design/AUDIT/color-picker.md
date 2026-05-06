# Audit: ColorPicker

**Status**: major-drift (functionally a different component)

**Upstream source**: `registry/default/color-picker.tsx` (commit `d850ecf`, 1726 lines)
**Our source**: `packages/design/src/registry/color-picker.tsx` (92 lines)

> **Wave 1 noted** the upstream ships `--checker-a` / `--checker-b` tokens
> we don't ship. Confirmed. Upstream defines them at three places in
> `app/globals.css`:
>
> - `:root` light: `--checker-a: #bbbbbb; --checker-b: #ffffff;`
> - `prefers-color-scheme: dark` block: `--checker-a: #1f1f1f; --checker-b: #2a2a2a;`
> - `.dark` block: same as dark above.
>
> They drive a `conic-gradient(--checker-a, --checker-b)` checkerboard used
> as the alpha-channel backdrop on swatches, the alpha slider track, and
> the small color tile in the popover trigger. Without these tokens, any
> port of the upstream color picker would render a black/transparent
> checkerboard (CSS `var(--checker-a, …)` would resolve to `initial`,
> i.e. `unset`/black depending on consumer Tailwind reset).

## API drift

This is the most divergent component in the package. The two files are
functionally unrelated:

| Aspect | Upstream | Ours |
|---|---|---|
| Purpose | Full-spectrum color picker (HSV square + hue slider + alpha + format dropdown + per-channel inputs + eyedropper + optional swatches) | Constrained-palette radiogroup picking from `BADGE_HEX` (17 design tokens) |
| Canonical exports | `ColorPicker`, `ColorPickerPopover`, `ColorPickerPortalContainer`, `ColorSwatch`, `ColorTile`, `parseColor`, `buildParsed` | `ColorPicker` only |
| Props on `ColorPicker` | `value?: string`, `defaultValue?: string`, `onValueChange?: (string, ParsedColor) => void`, `format?: "hex"\|"rgb"\|"hsl"\|"oklch"`, `defaultFormat?`, `onFormatChange?`, `swatches?: string[]`, `hideEyedropper?: boolean` | `value: BadgeColor`, `onChange: (BadgeColor) => void`, `includeGray?: boolean` |
| Value shape | Free-form CSS color string (`#abc`, `rgb(…)`, `hsl(…)`, `oklch(…)`); ParsedColor object alongside | Constrained `BadgeColor` enum (17 keys) |
| Color math | ~250 lines of HSV ↔ RGB, RGB ↔ HSL, RGB ↔ OKLCH (incl. linear sRGB / OKLab matrices), hex parsing | None — direct hex lookup from `BADGE_HEX` |
| Format switching | OKLCH-aware sticky-hue handling; preserves user's stated H across lossy round-trips | n/a |
| Trigger / popover | `ColorPickerPopover` (separate component with `triggerLabel`, `triggerLabelPosition`, `triggerShowValue`, `triggerShowRemove`, `onTriggerRemove`) | n/a |
| Swatch primitive | `ColorSwatch` (28px button with checker bg + selected ring) | inline `<button>` per palette entry |
| Color tile | `ColorTile` (small swatch with checker behind alpha) | n/a |
| Eyedropper | `EyeDropperButton` using browser `EyeDropper` API | n/a |
| Format dropdown | `FormatDropdown` (custom, uses `Dropdown` + `useDropdown`; portals into popover container) | n/a |
| Channel inputs | `ColorInput` with scrubbable drag, ArrowUp/Down nudge (shift = 10x), wrap mode for hue, percent suffix, decimals, focus-ring | n/a |
| Tooltips | `ChannelTooltip` wraps each channel input | n/a |

The doc comment at the top of our file is candid:

```ts
/**
 * Simplified swatch-grid color picker. The legacy version is a 1700-line custom
 * picker with HSL sliders, hex input, eyedropper, and accent palette. This port
 * exposes the most common use case — choose one of the 17 design-system accent
 * colors. The full picker can be ported later.
 */
```

This is documented intentional drift, not an accident.

## Visual drift

- **No HSV square / saturation gradient.** Upstream renders a 156px-tall
  HSV plane with a hovered hex cursor, focus ring, and animated thumb.
  Ours: 9-column grid of 28px circles.
- **No hue/alpha sliders.** Upstream uses our `Slider` registry component
  with `linear-gradient` + checker-board backgrounds for hue and alpha.
  Ours: none.
- **No checker pattern anywhere.** All upstream color-display surfaces
  (swatch, alpha track, color tile) layer a `conic-gradient(--checker-a 0 25%,
  --checker-b 0 50%, --checker-a 0 75%, --checker-b 0)` at `8px 8px`
  beneath the color so transparency reads correctly. We don't ship this
  pattern OR the underlying tokens.
- **Selected affordance.** Upstream `ColorSwatch` uses
  `inset 0 0 0 1px rgba(127,127,127,0.25), 0 0 0 2px var(--background),
  0 0 0 4px #6B97FF` for selected (a halo with a background-colored gap).
  Ours: simple `border-foreground` swap (no halo).
- **Hover affordance.** Upstream: triple-shadow hover ring with the same
  gap pattern. Ours: `hover:scale-110` transform.
- **Selected check icon.** Upstream has none on the swatch; the user reads
  the selected swatch via the halo. Ours overlays a centered Lucide
  `<Check size={14} strokeWidth={2.5} />` whose color is computed via a
  YIQ luminance helper (`isLight()`).
- **Panel container.** Upstream `ColorPicker` panel is `width: 280px`,
  `flex flex-col gap-2 p-3 bg-card border border-border/60` plus
  `shape.container` shadow. Ours has no panel — the swatch grid is a bare
  `grid grid-cols-9 gap-2 max-w-[280px]`.

## Behavioral drift

Missing capabilities (because the component is fundamentally different):

- Free-form color input.
- Format switching (hex / rgb / hsl / oklch).
- Per-channel scrubbable numeric inputs with ArrowUp/Down nudge and shift-acceleration.
- OKLCH-aware sticky-hue (`oklchHueRef`) preventing drift across the
  RGB round-trip.
- EyeDropper API integration.
- External controlled-value sync (`useEffect` on `value` parses + drives
  internal HSV).
- `parseColor` / `buildParsed` exported helpers (depended on by other
  upstream components and demos).
- Portal-container scaling via `ColorPickerPortalContainerContext`.

Inherited drift:

- Upstream uses `springs.fast` (popover entrance), `springs.moderate`
  (popover entrance/exit), `useShape()` (panel/container/input shapes),
  and `useIcon("chevron-down" | "pipette" | "x")` from the icon-context.
  All four of those lib surfaces drift in our package — see
  `_lib-springs.md` and `_lib-icon-and-icon-context.md`. A future port of
  the full upstream picker requires those libs to reach parity first;
  otherwise the format dropdown's chevron, the eyedropper button's
  pipette, and the popover trigger's x-icon all need lucide-only
  fallbacks.
- Upstream `ColorPicker` composes `Slider` (`registry/default/slider.tsx`),
  `Dropdown` + `useDropdown` (`registry/default/dropdown.tsx`), and
  `Tooltip` (`registry/default/tooltip.tsx`). Our package ships:
  `Slider` (under `components/`, weekend re-skin — drift unknown until
  audited), `Dropdown` (**not exported** per inventory), and `Tooltip`
  (with its own drift, see `tooltip.md`). A re-port requires resolving
  Dropdown's MISSING status first.

## Severity

**high** — Effectively two different components sharing a name. Both are
internally consistent and useful, but a consumer reading
`@weekend/design`'s `ColorPicker` from upstream documentation will hit a
type error on the very first prop (`value: string` vs `value: BadgeColor`)
and find none of the secondary exports. The Wave-1 token concern
(`--checker-a/b` missing) is real but downstream of the bigger structural
gap — until we choose to ship the full picker, the missing tokens have no
consumer.

## Recommended fix

Two options, depending on intent:

1. **Keep the divergence, document it loudly.** Rename our component to
   reflect its actual semantics (e.g. `BadgeColorPicker` or `AccentSwatchPicker`)
   and stop calling it `ColorPicker` — the upstream name strongly implies
   the full picker. Add a `// FIDELITY-DRIFT` comment header pointing at
   this audit. Skip the missing tokens and lib re-ports.
2. **Re-port the upstream `ColorPicker` in full.** Restore `--checker-a/b`
   to `tokens.css` (port the three blocks and add `weekend-dark`/
   `weekend-paper` overrides), port `Dropdown` first (currently MISSING),
   align `Slider` and `Tooltip` (separate audits), align `springs` and
   `useIcon` (lib audits), then port the picker as a sibling component
   keeping our existing `BadgeColor`-grid available under a new name.
   The full picker is ~1700 lines but largely standalone code (color
   math, parsers, channel inputs) — the dependencies on our package
   primitives are limited to `Slider` / `Dropdown` / `Tooltip` / icons /
   shape / springs.

Either way, the inventory's MISSING claim about `--checker-a/b` is correct
and should ship together with the chosen direction (option 2 needs the
tokens; option 1 explicitly does not).
