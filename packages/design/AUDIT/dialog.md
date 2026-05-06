# Audit: Dialog

**Status**: minor-drift

**Upstream source**: `registry/default/dialog.tsx` (commit `d850ecf`, 169 lines)
**Our source**: `packages/design/src/registry/dialog.tsx` (166 lines)

Near line-for-line port. The mount/unmount choreography (DialogOpenContext +
mounted state + handleExitComplete), spring choices, overlay class, content
positioning, header/footer/title/description shapes are all identical. The
only meaningful divergence is the close-button construction.

## API drift

- Identical exports plus we additionally export `type DialogContentProps`
  (upstream keeps it private). Net positive.
- `DialogContentProps.size` is `"sm" | "lg"` in both.
- Title `fontVariationSettings` quoting differs cosmetically: upstream
  `'wght' 700` (single-quote inside JSX double-quote string); ours
  `'"wght" 700'` (escaped double-quotes). Both produce the valid CSS
  `"wght" 700`. No runtime effect.

## Visual drift

- **Close button is the headline drift.** Upstream renders the close
  affordance via the `Button` component (`variant="ghost" size="icon-sm"`
  with `XIcon` child + `sr-only` "Close"). Our copy renders a hand-rolled
  `DialogPrimitive.Close` styled with raw Tailwind:
  `inline-grid place-items-center w-7 h-7 rounded-full text-muted-foreground
  hover:text-foreground hover:bg-hover ... focus-visible:ring-2 ring-[#6B97FF]`
  with `aria-label="Close"`. Net visual differences:
  - **Radius**: upstream uses Button's variant-driven radius (which ties
    to `shape` context — pill on default, soft-rounded on square); ours
    is always `rounded-full`.
  - **Size**: upstream `icon-sm` is 28px square per Weekend's Button
    wrapper; ours fixes 28px (`w-7 h-7`) — coincidentally aligned today,
    but drifts whenever Button's icon-sm metric changes.
  - **Hover/focus**: similar but not identical token usage. Both use
    `hover:bg-hover`, but upstream goes through Button's
    `transition-colors` defaults; ours sets `duration-80` directly.
  - **Icon size**: upstream lets `XIcon` use its provider default; ours
    forces `size={14} strokeWidth={1.5}` inline.
- All other visuals match: overlay opacity (40% light / 80% dark), card
  background, border `border-border/60`, identical shadow strings, content
  container padding `p-6`, `max-w-[400px]/[540px]` per size, identical
  enter/exit motion (`opacity 0→1`, `scale 0.97→1`, `springs.slow` →
  `springs.moderate`), identical header/footer margins, identical title
  size `16px` weight 700 and description `13px text-muted-foreground`.

## Behavioral drift

- Identical mount/unmount logic: both delay unmount until exit animation
  completes by tracking `mounted` state and gating render on it; both
  expose the same controlled/uncontrolled `open` prop forwarding via a
  context.
- Both keep upstream's quirk that `motion.div` `transition` differs by
  direction (`open ? springs.slow : springs.moderate`) — a deliberate
  asymmetry where exits feel snappier than entries.
- Inherits spring shape drift (`_lib-springs.md`): upstream's
  `springs.slow` / `springs.moderate` are `{ type: "spring", duration,
  bounce }`; ours are stiffness/damping. Visual feel of the open/close
  pop will differ.
- Inherits icon-context drift (`_lib-icon-and-icon-context.md`): both
  go through `useIcon("x")`, but our icon system is lucide-only with a
  fixed adapter; upstream offers 4-library swap.

## Severity

**low** — Dialog is otherwise faithful. The close button drift only
matters in the long run (when Button absorbs more variants and our hand-
rolled close drifts further from the design-system idiom). Spring drift
is shared, not Dialog-specific.

## Recommended fix

Replace the hand-rolled `DialogPrimitive.Close` with the canonical pattern:
`<DialogPrimitive.Close asChild><Button variant="ghost"
size="icon-sm">...</Button></DialogPrimitive.Close>`. This requires the
`Button` import from this package, which works since Button is exported
from `@weekend/design`. Inherits spring + icon drifts already tracked in
`_lib-springs.md` / `_lib-icon-and-icon-context.md`.
