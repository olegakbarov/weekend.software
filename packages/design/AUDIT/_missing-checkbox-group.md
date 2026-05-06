# Missing: CheckboxGroup

## Upstream has it
- `registry/default/checkbox-group.tsx` (commit `d850ecf`) — exports `CheckboxGroup` (root) + `CheckboxItem` (child)
- Listed in upstream `registry.json`
- Demo at `app/docs/checkbox-group/page.tsx`

## What it does

A **stylized multi-select list** built around `@radix-ui/react-checkbox` for accessibility and `useProximityHover` for the visual idiom. Looks like a vertical list of label rows, each with a Radix checkbox, where:

- The checkbox check mark animates as a path-length pen-stroke (framer-motion `pathLength: 0 → 1`, 80ms easeOut).
- The label uses the inline-grid double-render trick (invisible semibold + visible variable weight) so font-weight changes don't shift layout.
- Hover follows the pointer via `useProximityHover` — an animated `bg-accent/40` rect snaps to the active item with a fast spring.
- **Contiguous checked items merge** their selected backgrounds into a single rounded run via the `mergedBg` shape token. The implementation tracks contiguous "runs" of checked indices and gives each run a stable ID so the merge animation keeps continuity across re-renders.
- Focus ring is an animated `border-[#6B97FF]` rect inflated 2px around the focused item.
- Keyboard: ArrowUp/Down navigates, Home/End jumps, Space/Enter toggles. `role="group"` on the container, `role="checkbox"` on items.

### Public API

```tsx
<CheckboxGroup checkedIndices={selected /* Set<number> */}>
  <CheckboxItem index={0} checked={selected.has(0)} onToggle={() => toggle(0)} label="One" />
  <CheckboxItem index={1} checked={selected.has(1)} onToggle={() => toggle(1)} label="Two" />
</CheckboxGroup>
```

- `CheckboxGroupProps`: extends `HTMLAttributes<HTMLDivElement>`, adds `checkedIndices: Set<number>` and `children`.
- `CheckboxItemProps`: extends `HTMLAttributes<HTMLDivElement>`, adds `label: string`, `index: number`, `checked: boolean`, `onToggle: () => void`.
- The `index` prop is manually assigned by the consumer (no auto-numbering via Children.map).

## Our gap

- No `CheckboxGroup` or `CheckboxItem` exported from `@weekend/design` or `@weekend/design/registry`.
- No standalone `Checkbox` either. Our package has no checkbox primitive at all.
- The desktop app does not currently use a checkbox-list pattern (verified via tree of `src/`).

## Severity

**low** for current Weekend needs — no consumer is reaching for this pattern today, and we have no Weekend-specific Checkbox to wrap.

**medium** strategically — this is the kind of primitive an agent-built project app would expect (settings panels, multi-select filters, "select all that apply" flows). Per CLAUDE.md, the design system is supposed to ship into every project, so multi-select + checkbox is a foreseeable need. Absent it, downstream agents will hand-roll one with shadcn-style flat checkboxes that don't match our visual idiom.

## Recommendation

1. **Defer absorption** until a Weekend feature or downstream project app needs it.
2. When absorbing, port the upstream file directly. Prerequisites:
   - `useProximityHover` must support upstream's `getBoundingClientRect`-only path (currently we have axis option drift — see Wave 1 hooks audit).
   - `springs.fast` / `springs.moderate` must use the framer-motion v12 duration/bounce shape (also Wave 1 drift).
   - `shape-context` must expose `bg`, `mergedBg`, `item`, `focusRing` keys (Wave 1 noted ours has slightly different keys).
   - `@radix-ui/react-checkbox` is not currently in our deps — add it.
3. Update `registry.ts` to export `CheckboxGroup`, `CheckboxItem`, and types.
4. Add the `shimmer-text`/keyframes block to `tokens.css` only if porting it; not used by CheckboxGroup itself but is part of the same adjacent visual family upstream.
5. Add a docs page in `src/dev/docs/views/pages/checkbox-group.tsx` matching upstream's `app/docs/checkbox-group/page.tsx`.

Until then, document the gap in INVENTORY.md (already noted) and don't ship a placeholder Weekend-only checkbox — that would create a parallel API to migrate away from later.
