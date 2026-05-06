# Audit: Select (registry tier)

**Status**: major-drift

**Upstream source**: `registry/default/select.tsx` (commit `d850ecf`, 759 lines)
**Our source**: `packages/design/src/registry/select.tsx` (312 lines)

> Note: this audit covers the registry-tier file (`src/registry/select.tsx`). A
> separate Weekend re-skin lives at `src/components/select.tsx` and is audited
> elsewhere. Upstream uses the SAME name `Select` — there is no rename. Our
> registry copy intentionally drops several upstream features and is documented
> at the top of the file as such ("Compared to the legacy the proximity-hover
> indicator is omitted; selected/active rows still fade with framer-motion.")

## API drift

Missing exports:

- `SelectGroup`, `SelectLabel`, `SelectSeparator`, `triggerVariants` — all
  upstream named exports we do not re-export. Anyone composing labelled
  groups or imitating the trigger style externally cannot.

Missing props on `Select` (root):

- `name?: string` — upstream renders a hidden `<input type="hidden" name=… />`
  for native form participation. Ours has no form-integration.
- `required?: boolean` — paired with `name`; absent for the same reason.

Missing props on `SelectTrigger`:

- `variant: "bordered" | "borderless"` (`cva` `triggerVariants`) — we hard-code
  bordered styles inline. No way to render a borderless trigger.
- `icon?: IconComponent` — upstream renders a leading icon with hover-driven
  stroke-width transition. We have no icon slot.
- `error?: string` — upstream renders an inline error message under the
  trigger and toggles `border-destructive/50` + `aria-invalid`. Missing.
- The trigger also wraps in a `<div className="flex flex-col gap-1">` to host
  the error message — we render a bare `<button>`.

Missing props on `SelectItem`:

- `index: number` — upstream's API REQUIRES the consumer to supply an index
  per item (used by proximity hover). Ours is index-less. **This is an API
  shape divergence**: upstream's signature is incompatible with ours.
- `icon?: IconComponent` — upstream renders a leading icon per item.

Other props/types:

- Upstream typed `IconComponent` from `@/lib/icon-context` (the 4-library
  adapter shape). Ours doesn't expose this on Select at all.

## Visual drift

Missing visual systems on the content panel:

- **Proximity-hover background** — upstream renders a `motion.div` whose
  `top/left/width/height` animate with `springs.fast` to follow the
  proximity-hover indicator across items. We rely on per-item `hover:bg-hover`
  CSS hover states.
- **Animated checked-row background** — upstream renders a separate
  `motion.div` (with `bg-selected/50 dark:bg-accent/40`) anchored to the
  currently checked row, animated with `springs.moderate`. Ours toggles
  `bg-selected/40 dark:bg-accent/40` directly on the item — no animation,
  same color.
- **Animated focus ring** — upstream renders a third `motion.div`
  (`border border-[#6B97FF]`) that follows the focused item. Ours uses
  `focus-visible:ring-1 focus-visible:ring-[#6B97FF]` per item.
- The `relative … overflow-y-auto` container loses the three absolutely-
  positioned siblings, so the panel feels static where upstream feels lively.

Item content drift:

- Upstream item shows an animated check svg with `pathLength` draw-on
  animation (`duration: 0.08, easeOut`). Ours uses a `motion.span` containing
  a Lucide `<Check size={14} />` with `scale 0.8 → 1` + `springs.fast`. Same
  intent, different mechanic — no `pathLength` draw.
- Upstream uses `strokeWidth={isActive || isChecked ? 2 : 1.5}` on item
  icons; we have no item icons at all.
- Upstream item color toggles between `text-muted-foreground` (default) and
  `text-foreground` (active OR checked). Ours toggles only on `isChecked` —
  active rows stay muted because we have no proximity-hover concept.

Trigger drift:

- Upstream renders chevron as inline `<svg>` with explicit `<path d="M6 9l6 6 6-6" />`.
  We import `lucide-react` `<ChevronDown />`. Both 16px / strokeWidth 1.5 —
  visual difference negligible but adds a Lucide dep we wouldn't otherwise
  pull into the registry tier.
- Upstream wraps the trigger in `<div className="flex flex-col gap-1">` so it
  can host an error message; ours renders a bare button.

Shadow on the panel:

- Upstream: `shadow-[0_4px_12px_rgba(0,0,0,0.02)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]`.
- Ours:    `shadow-[0_4px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]`.
  Light shadow alpha is **0.04 vs 0.02** — ours is twice as opaque. Trivial,
  but a real divergence.

## Behavioral drift

Missing behaviors:

- **Proximity hover** — upstream wires `useProximityHover(containerRef)` into
  the content's `onMouseEnter/Move/Leave` handlers and into a `SelectContentContext`
  (`registerItem`, `activeIndex`). Removing this strips the hallmark Fluid
  hover affordance. Note: our `useProximityHover` itself drifts from upstream
  (see `_lib-springs.md` and the inventory note about axis/rAF/hit-test) so a
  re-port will need to decide which proximity-hover to use.
- **Close on scroll** — upstream closes the popover on window scroll. Ours
  does not (only Escape and click-outside).
- **Initial focus on the container** — upstream `containerRef.current?.focus({ preventScroll: true })`
  after a double-rAF; ours never focuses the container. This means our
  keyboard handler on the container `onKeyDown` would never fire — keyboard
  arrows/Home/End from upstream's `handleKeyDown` are entirely missing.
- **Arrow/Home/End keyboard nav inside content** — upstream's container-level
  `handleKeyDown` walks `[role="option"]:not([data-disabled])` siblings,
  cycling on ArrowDown/Up and snapping to first/last on Home/End. We have
  per-item Enter/Space handling only — no arrow nav between items.
- **Initial keyboard target for ArrowDown** — upstream auto-focuses the
  checked item if any, else the first item. Without it (ours), tabbing into
  the open list lands on the first option's native focus, but arrow-key
  cycling does not work.
- **Item registers an `index` for proximity hover** — upstream `SelectItem`
  pulls `SelectContentContext`, registers itself by index, and exposes
  `data-proximity-index` / `data-value` attributes. We omit all three.
- **Hidden form input** — upstream `Select` mounts `<input type="hidden" name=… />`
  when `name` is supplied. Missing.
- **`hideCheck` / activated tabIndex routing** — upstream sets
  `tabIndex={isChecked ? 0 : index === checkedIndex ? 0 : -1}` so the checked
  item is tabbable when no roving-focus is active. Ours uses `tabIndex={disabled ? -1 : 0}`
  on every item, which is simpler but lets every item participate in tab
  order even when they shouldn't.

Inherited drift (do not fix here):

- Both ends import `springs` and `useShape`. Both inherit the documented
  drift in `_lib-springs.md` (`stiffness/damping` vs `duration/bounce`) and
  in `_lib-shape-context.md` (no provider, transition class missing). When
  porting visual fidelity here, those two libs need to be in sync first.
- Upstream `IconComponent` comes from `@/lib/icon-context` — the 4-library
  adapter shape. Ours is `LucideIcon` only. See `_lib-icon-and-icon-context.md`.

## Severity

**high** — The registry Select is conceptually one of the showcase
proximity-hover surfaces in Fluid. We've stripped almost every interactive
and animated layer (proximity bg, checked-row anim, focus ring, keyboard
nav, scroll-close, hidden input, error UX, icon slots, variant). What we
ship is a basic listbox that visually resembles the Fluid trigger but
behaves like a bare Radix-portal composite. Anyone diffing
`/dev/ds/select` against upstream `app/docs/select/page.tsx` will see the
gap immediately.

## Recommended fix

Re-port the registry Select from upstream wholesale, keeping ours as the
target file. Order of operations: (1) fix `_lib-springs.md` and the
proximity-hover hook drift first so the re-port's animations land correctly;
(2) port the three motion overlays (checked-bg, hover-bg, focus-ring) plus
container keyboard nav and scroll-close; (3) restore the API surface
(`name`, `required`, `variant`, `icon`, `error`, `index` per item, item
`icon`, `SelectGroup`/`SelectLabel`/`SelectSeparator`, `triggerVariants`).
The Weekend desktop currently consumes a different file (`components/select.tsx`)
so the registry re-port is safe to do without immediate downstream churn.
