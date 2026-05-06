# Audit: InputCopy

**Status**: major-drift (behavioral) / minor-drift (visual)

**Upstream source**: `registry/default/input-copy.tsx` (commit `d850ecf`, 276 lines)
**Our source**: `packages/design/src/registry/input-copy.tsx` (216 lines)

The static visual layout matches: same shape, same structure, same align
modes, same font choices, same icon switch, same spring-driven copy/check
swap. The drift is concentrated in tooltip choreography around the copy
event and a missing hover highlight on the displayed value.

## API drift

- Identical public surface: `{ InputCopy, InputCopyProps }` with
  `value | label | onCopy | disabled | variant | align`. Same defaults
  (`variant="icon"`, `align="right"`).
- Upstream additionally exports `default InputCopy`. Ours does not. Minor.

## Visual drift

- **Selection highlight on `<mark>`** is absent in our port. Upstream
  wraps the value in `<mark className="bg-transparent text-foreground
  transition-colors duration-80 group-hover:bg-[#6B97FF]/20
  group-hover:text-foreground">{value}</mark>` so hovering the field
  paints a soft blue selection across the value text — a strong visual
  signal that the whole row is the click target. We render the value as
  a plain `<span>`, so the row never highlights on hover.
- **`button` variant icon-stroke transition**: upstream applies
  `[&_svg]:stroke-[1.5] [&_svg]:transition-[stroke-width] [&_svg]:duration-80
  group-hover:[&_svg]:stroke-[2]` on the `motion.span` wrapping the
  check, so the checkmark thickens on hover. Ours renders the check svg
  with a fixed `strokeWidth={2}`. The copy icon does have the
  hover-stroke transition in both.
- **Copied label width-stability**: upstream uses an `inline-grid` two-
  layer pattern (invisible "Copied" reserves max width, visible layer
  swaps "Copy" → "Copied") so the button doesn't reflow when the label
  changes. Ours just renders `{copied ? "Copied" : "Copy"}` as a plain
  span — visible width jitter when the state flips.
- All other visuals match: shape via `shape.input`, gap, padding `px-1.5
  py-2`, `text-[13px]`, `font-mono` on value, `focus-visible:ring-1
  ring-[#6B97FF]`, identical AnimatePresence transitions on the
  copy/check icon swap.

## Behavioral drift

- **Tooltip choreography on copy is the most consequential drift.**
  Upstream tracks tooltip state as `"idle" | "copied" | "suppressed"`,
  with these rules:
  1. On pointerdown, capture whether the tooltip was visible BEFORE
     Radix's pointerdown autoclose; this lets the post-copy "Copied"
     replacement re-open with `forceOpen={true}` only if the user was
     already hovering.
  2. After copy, transition to `"copied"` (force-open) for 2s, then
     `"suppressed"` (force-close) — this prevents the tooltip from
     immediately re-appearing as "Copy to clipboard" while the icon is
     still on the check state.
  3. On `mouseleave`, transition `"copied" → "suppressed"`; on
     `mouseenter`, transition `"suppressed" → "idle"` so subsequent
     hovers behave normally.

  Ours has none of this. We simply set `content={copied ? "Copied" :
  "Copy to clipboard"}` and rely on the Tooltip's default open/close
  behavior. Concrete consequence: if the user clicks (which closes the
  tooltip via Radix), then mouses out and back in, the tooltip will say
  "Copied" while the icon has reverted to copy — a confusing state. And
  hover-then-click never displays "Copied" at all because click closes
  the tooltip.
- **Pointer-down handler**: upstream wires `onPointerDown` on the button
  to capture pre-close visibility (see above); we don't.
- **Disabled guard**: upstream early-returns on `disabled`; ours
  additionally guards `!navigator.clipboard`. Minor.
- Inherits spring drift (`_lib-springs.md`) on the icon swap and inherits
  icon-context drift (`_lib-icon-and-icon-context.md`) on `useIcon("copy")`.

## Severity

**high** — the tooltip choreography is a meaningful UX feature (the whole
point of "Copy to clipboard / Copied" feedback is that it must follow the
user's intent). The `<mark>` hover highlight is the dominant interactive
signal that the field is clickable. Together these make our copy feel
materially less polished than upstream.

## Recommended fix

Port the three-state tooltip machine and `onPointerDown` capture verbatim;
this requires `Tooltip` to expose `forceOpen` and `onOpenChange` (verify
our Tooltip already has these — upstream uses `forceOpen={…}` and
`onOpenChange={handleTooltipOpenChange}`). Wrap the value in `<mark>` with
the `group-hover:bg-[#6B97FF]/20` highlight and matching transitions.
Restore the inline-grid width-stable label pattern for the `button`
variant. Inherits spring + icon drifts from their respective lib audits.
