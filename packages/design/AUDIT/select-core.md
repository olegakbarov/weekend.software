# Audit: Select (core / Tailwind-free)

**Status**: major-drift (intentional fork — Weekend's "lite" Select; both Selects coexist)

**Upstream source**: `registry/default/select.tsx` (commit `d850ecf`) — a richer compound component with proximity-hover, springs, portal, and full keyboard nav.
**Visual reference**: `app/docs/select/page.tsx`
**Our source**: `packages/design/src/components/select.tsx` (+ `select.css`) — a simpler, framer-motion-free, `IconComponent`-free, single-file Select that takes an `items` array.

> Wave 2 has audited **only the core `components/select.tsx`** here. The "registry" Select (`packages/design/src/registry/select.tsx`, which mirrors upstream) is a separate audit — see Wave 2A or open `select-registry.md` if not yet covered. The two Selects ship side-by-side and `index.ts` / `registry.ts` re-export different ones; consumers must choose.

## API drift

The two are almost not the same component. Brief comparison:

| | Upstream (compound) | Ours core (data-driven) |
|---|---|---|
| Composition | `<Select>` `<SelectTrigger>` `<SelectContent>` `<SelectItem>` (compound) | `<Select items={[…]} />` (single component) |
| Value prop | `value?: string` (uncontrolled OK via `defaultValue`) | `value: T \| undefined` (controlled-only; `T extends string`) |
| Change prop | `onValueChange?: (v: string) => void` | `onChange: (v: T) => void` |
| Items | Children (`<SelectItem value="a">A</SelectItem>`) | Array (`{ value, label }[]`) |
| Icons per item | `icon?: IconComponent` per item | _none_ — labels only |
| Trigger icon | `icon?: IconComponent` on `<SelectTrigger>` | _none_ |
| Trigger variants | `bordered` \| `borderless` (`triggerVariants` cva) | _none_ — single style |
| Error state | `error?: string` on trigger | _none_ |
| Form name | `name?: string` + hidden input on root | _none_ |
| Disabled | `disabled?: boolean` | `disabled?: boolean` ✓ |
| Placeholder | `placeholder?: string` on trigger | `placeholder?: string` (default `"Select…"`) ✓ |
| Group / Label / Separator | `SelectGroup`, `SelectLabel`, `SelectSeparator` exports | _none_ — flat list |
| ARIA label | derived from selected `<SelectItem>` text | `ariaLabel?: string` |

This isn't a "drift to fix" — it's a deliberate stripping. Weekend has a parallel "core" Select that does just enough for simple choosers (e.g. theme picker, sort order) without dragging in framer-motion + portals + proximity hover.

## Visual drift

CSS-driven (`.ds-select-*`) vs. Tailwind+framer-motion. Comparison points:

- **Trigger height**: ours `32px` (h-8). Upstream `36px` (h-9). Drift; ours is shorter.
- **Trigger padding**: ours `0 var(--space-2_5) 0 var(--space-3)` (10px right / 12px left, asymmetric to make caret feel right-anchored). Upstream `px-3` (symmetric 12px). Slight visual difference.
- **Border**: ours `1px solid var(--border)` always-on. Upstream `bordered` variant matches; `borderless` variant has transparent border. Our core Select has no equivalent of `borderless`.
- **Background**: ours `var(--card)` (so it pops on `var(--background)`). Upstream `bg-transparent` for `bordered` (lets background show through). Drift — ours feels heavier.
- **Hover**: ours `background: var(--hover)` ✓. Upstream `hover:bg-hover` ✓. Same intent.
- **Focus / open ring**: ours `border-color: var(--focus-ring); box-shadow: 0 0 0 3px color-mix(in oklab, var(--focus-ring), transparent 80%)` — single 3px soft ring + colored border. Upstream `focus-visible:ring-1 ring-[#6B97FF]` — single 1px ring. Quite different.
- **Caret**: ours custom 10×10 SVG path; rotates 180° on open via CSS. Upstream lucide `ChevronDown` rendered at 16px; doesn't rotate.
- **Border radius**: ours `var(--radius-control)` (driven by `[data-shape]`). Upstream `useShape().input` (provider-driven). Same end result if shape contexts are aligned (they're not — see `_lib-shape-context.md`).
- **Menu (open list)**:
  - Ours: `position: absolute; top: calc(100% + 4px); left: 0; right: 0` — pinned to the trigger via DOM ancestry, no portal, follows trigger width.
  - Upstream: `createPortal(..., document.body)` with `position: fixed` and `triggerRect.bottom + 6` offset; doesn't get clipped by `overflow: hidden` ancestors.
  - **Big behavioral implication**: ours will be clipped if any ancestor has `overflow: hidden` (e.g. inside a card, dialog body, etc.). For a desktop chrome where modals/dialogs have their own portal layers, this is a real risk.
- **Menu animation**: ours has a CSS `@keyframes ds-select-in` with `opacity 0→1` + `translateY(-4px → 0)`. Upstream framer-motion `initial={{ opacity: 0, y: -4, scaleY: 0.96 }}` with `springs.fast`. Visually similar; ours uses CSS so no spring.
- **Selected indicator**: ours renders a 12×12 check SVG inline next to the selected option. Upstream renders an animated `motion.path` checkmark with `pathLength: 0 → 1`. Static ✓ vs animated ✓ — perceptible drift.
- **Active/selected backgrounds**: ours uses `[data-active]` (highlighted-by-keyboard) → `var(--hover)`; `[data-selected]` → font-weight bump only (no bg). Upstream uses two animated background motion-divs (selected + hover) that move between items. Significant interaction drift — ours is "static rows with hover", upstream is "rows with magnetic active backgrounds".
- **No max-height match**: ours `max-height: 280px`. Upstream `max-h-[300px]`. ~minor drift.

## Behavioral drift

- **Keyboard nav**: both support ArrowUp/Down, Enter, Escape. Ours adds Tab-to-close. Upstream adds Home/End + ArrowRight/Left (treats them like ArrowDown/Up). Roughly comparable; ours is a hair lighter.
- **Highlight on open**: ours sets highlight to selected option's index ✓. Upstream finds the checked item DOM node and `.focus()`es it directly. Both arrive at "selected is highlighted on open."
- **Outside click**: both close. Ours uses `mousedown` + ancestor `contains` check. Upstream same approach. ✓.
- **Scroll behavior**: ours scrolls highlighted into view on highlight change. Upstream relies on the focused element being naturally scrolled by `.focus()`. Both work.
- **Scroll-to-close**: upstream closes the menu when the page scrolls (deliberate — avoids visual desync from a fixed-position portal). Ours doesn't (its menu is anchored, so it scrolls with the trigger naturally — different mechanism, no need).
- **Disabled items**: not modeled in our core Select (`SelectItem` upstream takes `disabled?: boolean`). Drift; if the consumer wants disabled items, they'd need the registry Select.
- **Generic typing**: ours is `<T extends string>` and threads through correctly. Nice. Upstream is plain `string`.
- **No proximity-hover** — the magnetic active-row effect is missing. (See `_use-proximity-hover.md` if absent — that hook has its own drift.)
- **No `useShape` / `useIcon` / framer-motion / radix** — pure controlled component; doesn't inherit drift from those libs. ✓ portable.

## Severity
**medium** — both Selects coexist, so this is more of a "we have two Selects with diverging APIs" governance issue than a per-component bug. The core Select is missing several upstream affordances (icons, error state, animated check, magnetic hover, portal, scroll-to-close) but works for simple cases.

The biggest concrete risk: **menu clipping inside `overflow: hidden` ancestors**. If a Weekend dialog wraps its body in `overflow-hidden`, the core Select's menu will get cut off. Worth checking real callsites.

## Recommended fix

Decide governance first:

1. **Single Select**: pick the registry Select as canonical, codemod core-Select consumers to compound API, delete `components/select.tsx`. Then `_select-registry.md` is the only audit needed and we're aligned with upstream.
2. **Two Selects, documented**: keep the core Select, name it differently (e.g. `SimpleSelect` or `Picker`), document in CLAUDE.md when to use which. Match the styling tokens (height `36px` to align with Button-md / SelectTrigger-md, focus-ring style, animated check) but keep the data-driven API.

If keeping the core Select:
- **Portal the menu** to `document.body` to fix overflow clipping. Use a fixed-position offset based on `getBoundingClientRect()`.
- **Match focus ring style** to upstream / our other components (1px `--focus-ring`, no soft halo) so the family looks consistent.
- **Bump trigger height to 36px** (`h-9`) for parity with the registry Select / Button-md.
- **Add `disabled` to items** (`SelectItem.disabled`) — easy 4-line change.
- **Animate the checkmark** with `pathLength` if framer-motion is on the table, or simple `clip-path` if not.
- **Consider `error?: string`** for parity with upstream — common form pattern.
