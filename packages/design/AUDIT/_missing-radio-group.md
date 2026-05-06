# Missing: RadioGroup

## Upstream has it
- `registry/default/radio-group.tsx` (commit `d850ecf`) — exports `RadioGroup` (root) + `RadioItem` (child)
- Listed in upstream `registry.json`
- Demo at `app/docs/radio-group/page.tsx`

## What it does

A **stylized single-select list** that internally wraps `@radix-ui/react-radio-group` for accessibility (when `value`/`onValueChange` are provided) and uses `useProximityHover` for visual interaction.

- The radio dot is a custom 8x8 circle that scale-springs in/out (`opacity + scale 0.3 → 1`, fast spring).
- Selected ring border vanishes when checked (border becomes transparent + selected background fills the row), so the visual reads as a "selected pill" rather than a traditional radio button.
- Label uses the inline-grid double-render trick to keep width stable as font weight changes.
- Selected background is a single animated `bg-selected/50` rect that springs between selected items (`springs.moderate`).
- Hover background uses `useProximityHover` — animated `bg-accent/40` rect snaps to the active item.
- Focus ring is an animated `border-[#6B97FF]` rect inflated 2px.
- Keyboard: ArrowUp/Down/Left/Right navigate AND auto-click (so navigating commits selection), Home/End jump and click. `role="radiogroup"` on container, `role="radio"` on items, `aria-checked` reflects state.

### Dual API

The component supports BOTH controlled-by-index and controlled-by-value, with optional Radix wrapping:

```tsx
// Index-based (no Radix wrapper)
<RadioGroup selectedIndex={i}>
  <RadioItem index={0} label="A" onSelect={() => setI(0)} />
  <RadioItem index={1} label="B" onSelect={() => setI(1)} />
</RadioGroup>

// Value-based (wraps in @radix-ui/react-radio-group root)
<RadioGroup value="a" onValueChange={setV}>
  <RadioItem index={0} value="a" label="A" />
  <RadioItem index={1} value="b" label="B" />
</RadioGroup>
```

When `value` + `onValueChange` are passed, upstream wraps the content in `<RadioGroupPrimitive.Root asChild>` and renders a hidden `<RadioGroupPrimitive.Item value={value}>` inside each `RadioItem` for screen reader semantics.

### Public API

- `RadioGroupProps`: `Omit<HTMLAttributes<HTMLDivElement>, "onSelect">` + `selectedIndex?: number`, `value?: string`, `onValueChange?: (value: string) => void`, `children`.
- `RadioItemProps`: `HTMLAttributes<HTMLDivElement>` + `label: string`, `index: number`, `selected?: boolean`, `onSelect?: () => void`, `value?: string`.

## Our gap

- No `RadioGroup` or `RadioItem` exported from `@weekend/design` or `@weekend/design/registry`.
- No standalone `Radio` either.
- Desktop app currently uses `Seg` for any visually-segmented single-select; for vertical lists with one chosen option, it has no design-system option.

## Severity

**low** for current Weekend needs — no current consumer.

**medium** strategically — the same project-export reasoning as `CheckboxGroup`. Settings panels, theme pickers, "default agent" pickers all want this pattern. The `value`-based API is also nicer for type-narrowing consumers (literal-union strings) than the index-based dance the desktop currently does with `Seg`.

## Recommendation

1. **Defer absorption** until needed; flag it for the next settings/preferences UI.
2. When absorbing, port directly. Prerequisites identical to `CheckboxGroup`:
   - Upstream-aligned `useProximityHover`, `springs`, `shape-context`.
   - Add `@radix-ui/react-radio-group` to deps.
3. Update `registry.ts` to export `RadioGroup`, `RadioItem`, and types.
4. Add docs page in `src/dev/docs/views/pages/radio-group.tsx`.
5. Strongly consider absorbing `CheckboxGroup` and `RadioGroup` together since they share infrastructure (proximity hover, shape tokens, label inline-grid pattern, similar keyboard handling) — and absorbing one without the other leaves an inconsistent menu of selection primitives.

Until then, document the gap (already in INVENTORY.md) and don't introduce a Weekend-only radio that would have to be migrated later.
