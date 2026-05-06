# Audit: Button + IconButton

**Status**: major-drift

**Upstream source**: `registry/default/button.tsx` (commit `d850ecf`)
**Demo-site copy**: `components/ui/button.tsx` (re-export only — `export { Button, buttonVariants } from "@/registry/default/button"`; safe to ignore)
**Visual reference**: `app/docs/button/page.tsx`
**Our source**: `packages/design/src/components/button.tsx` (+ `button.css`)

This is the most divergent component in the batch. **Different rendering primitive, different variant set, different sizing, different prop names.** Wave 2 should treat upstream as the source of truth — Weekend has effectively forked Button.

## API drift

### Variants
| | Upstream | Ours |
|---|---|---|
| Set | `primary` \| `secondary` \| `tertiary` \| `ghost` | `primary` \| `secondary` \| `tertiary` \| `ghost` \| `destructive` \| `success` \| `link` |
| Default | `primary` | `tertiary` |

We added `destructive`, `success`, `link` (Phase 4.4 absorption from Weekend). Upstream's `secondary` is `bg-accent`; ours is `bg-secondary` (a token upstream forbids outside `/compare` route — see INVENTORY note on `--secondary`). Default variant changed from `primary` to `tertiary` — meaningful behavior change for any consumer omitting `variant`.

### Sizes
| | Upstream | Ours |
|---|---|---|
| Text sizes | `sm` (h-7, 12px) \| `md` (h-8, 13px) \| `lg` (h-9, 14px) | `xs` (22px, text-xxs) \| `sm` (26px) \| `md` (32px) \| `lg` (36px) |
| Icon sizes | `icon-sm` (h-8) \| `icon` (h-9) \| `icon-lg` (h-10) | (none — split into separate `IconButton` component) |

Ours added `xs`. Heights drift: upstream `md` = h-8 (32px) ✓ matches; upstream `lg` = h-9 (36px) ✓ matches; upstream `sm` = h-7 (28px) vs ours 26px (drift). Padding/font sizes also differ.

### Props
| | Upstream | Ours |
|---|---|---|
| Leading icon prop | `leadingIcon: IconComponent` | `icon: IconComponent` |
| Trailing icon prop | `trailingIcon: IconComponent` | `trailingIcon: IconComponent` ✓ |
| Loading state | `loading?: boolean` | **missing** |
| `asChild` | yes | yes ✓ |
| Compound padding (icon-side trim) | yes (compoundVariants) | no |

We renamed `leadingIcon → icon` (Phase 4.4). We dropped the loading state entirely — no spinner, no `loading` prop. Upstream's loading state renders a custom infinity-loop SVG with `spinner-move` + `spinner-dash` keyframes from `globals.css`; those keyframes are also missing from our `tokens.css` (see INVENTORY).

### Icon-only API
Upstream: a single `Button` with `size="icon{,-sm,-lg}"` renders icon-only by passing the icon as `children`. Ours: a separate `<IconButton icon={...} label={...} size={...} />` exported alongside Button. IconButton has its own variant axis (none — only sizes `xs`/`sm`/`md`/`lg`) and forces `border-radius: var(--radius-pill)` (round) regardless of shape context — upstream's icon-button shape follows the shape context like everything else.

## Visual drift

- **Implementation primitive**: upstream is **Tailwind/CVA-based** with a `<span aria-hidden className="absolute inset-0 ...bg-..."/>` overlay for the bg color (so hover/active can transition `transform` independently of color). Ours is **plain CSS** in `button.css` with `.btn-bg` doing the same overlay trick. Functionally similar; styling drift is in tokens not architecture.
- **Hover effect**: upstream changes `bg-foreground/90` etc. via Tailwind opacity; ours uses `color-mix(in oklab, var(--foreground), transparent 12%)`. Visually close, not identical (oklab interpolation vs. straight alpha). Worth a side-by-side.
- **Hover stroke-width animation**: upstream animates icon `stroke-width: 1.5 → 2` on hover. Ours has the same intent on `IconButton` (`.btn-icon:hover svg { stroke-width: 2 }`) but **not on the regular `Button`** — the leading/trailing icon never animates stroke width.
- **Hover font-weight**: ours animates `font-variation-settings: medium → semibold` on `.btn:hover`. Upstream **does not** — it leaves font weight alone. This is a Weekend embellishment to make the type read heavier on hover; nice but a documented drift.
- **Active scale**: upstream `group-active:scale-[0.98]` on the bg overlay. Ours `.btn:active .btn-bg { transform: scale(0.98) }`. ✓ matches.
- **Focus ring**: upstream `focus-visible:ring-1 focus-visible:ring-[#6B97FF]` (single 1px ring). Ours `box-shadow: 0 0 0 2px var(--background), 0 0 0 3px var(--focus-ring)` (2px gap + 1px ring). Different ring style across the board (matches our other components like Switch, Select; upstream is more minimal).
- **Border radius**: upstream pulls from `useShape().button` (context). Ours uses `var(--radius-control)` directly (CSS-driven via `[data-shape]`). Class strings differ between the two shape implementations (see `_lib-shape-context.md`).
- **`btn-link` styling**: Weekend-only variant. No upstream parity; underline-on-hover is a sensible link convention and likely doesn't need to be absorbed upstream.
- **`btn-ghost` padding**: ours `padding: 0 var(--space-2_5)` (10px). Upstream ghost uses the same per-size padding as other variants (so a size-md ghost is `px-4`). Drift in horizontal padding for ghost specifically.

## Behavioral drift

- **Loading**: upstream disables the button (`disabled || loading`), renders the spinner overlay, and keeps the leading/trailing icons + label as a hidden ghost for layout stability. Ours has no loading state — consumers must build their own.
- **`asChild` rendering**: upstream uses `Slot` with full inner span structure; ours uses `Slot` but **strips out** the `.btn-bg` overlay and icon slots (Slot only allows a single child). This means `<Button asChild>` loses the hover bg-color overlay animation. This is a deliberate concession documented inline in our source ("Slot requires a single child — asChild is intended for simple wrappers"). Upstream sidesteps this by always rendering the full structure; our version trades some consistency for a simpler asChild contract.
- **Disabled**: both apply `opacity: 0.5; pointer-events: none`. ✓.
- **Spinner keyframes** (upstream `globals.css`): `spinner-move` (rotate) and `spinner-dash` (stroke-dashoffset) — used only by loading state. **Both missing from our `tokens.css`** (per INVENTORY) — currently moot since we don't ship the loading state, but a blocker for porting it back.
- **Shape context**: upstream calls `useShape().button` (provider-driven, can transition with `html.transitioning`). Ours uses CSS variable `--radius-control` (driven by `[data-shape]` on `<html>`). End result similar; mechanism drift inherits from `_lib-shape-context.md`.
- **Icon size scaling**: upstream's `iconSize = sm:14, md:16, lg:20`; ours leaves icon sizing entirely to the consumer's icon component (we call `<Icon />` with no `size` prop). This means icons in our buttons take whatever size the consumer's `<Icon>` defaults to (typically the lucide default of 24, which would be wrong inside a 32px button). Phase 4.4 likely relies on consumers pre-sizing icons — high risk of mis-sized icons in the wild.

## Severity
**high** — Button is the most-used primitive in the system, and we've drifted on:
1. variant set (added 3 + changed default),
2. icon prop name (`leadingIcon → icon` is a breaking rename),
3. dropped loading state entirely,
4. forked icon-only into a separate component (`IconButton`),
5. icons aren't auto-sized in our Button,
6. extra hover font-weight animation that upstream doesn't do.

Any consumer relying on the upstream `Button` API must change code to use ours. The default-variant change is silently breaking.

## Recommended fix

1. **Rename `icon → leadingIcon`** to restore upstream API parity (codemod the few callsites). Keep `icon` as a deprecated alias for one cycle if needed.
2. **Restore default variant to `primary`** to match upstream. Audit Weekend callsites — most that omit `variant` probably want `primary` anyway; the ones that actually want `tertiary` should be made explicit.
3. **Add a `loading` prop + spinner overlay**, ported 1:1 from upstream including the two `@keyframes` (port them into `tokens.css`).
4. **Auto-size leading/trailing icons** by passing `size={iconSize}` to the icon component (matching upstream's per-button-size icon scaling).
5. **Decide on IconButton**: either (a) absorb it into `Button` via `size="icon-{sm,md,lg}"` per upstream and deprecate the standalone `IconButton`, or (b) keep `IconButton` as Weekend-specific and document why (the round-pill shape is the differentiator). Option (a) is more faithful.
6. **Add stroke-width hover animation to leading/trailing icons** in regular `Button` (not just `IconButton`) — `[&_svg]:transition-[stroke-width] hover:[&_svg]:stroke-[2]`.
7. **Reconsider** the hover font-weight bump on `.btn:hover` — it's a real visual signature of Weekend's design language; if we keep it, document as intentional drift in CLAUDE.md.
8. **Reconsider** `--secondary` token usage in `btn-secondary` — upstream lints against this. If we want a secondary variant, follow upstream's `bg-accent` for the secondary visual.
