# Audit: Table

**Status**: identical (formatting / cosmetic-only drift)

**Upstream source**: `registry/default/table.tsx` (commit `d850ecf`)
**Reference demo**: `app/docs/table/page.tsx` (registered in `registry.json`
as `registry:ui` "table")
**Our source**: `packages/design/src/registry/table.tsx`

## API drift
None.
- Exports: `Table, TableHeader, TableBody, TableRow, TableHead, TableCell`
  (we export `TableHeader` and `TableBody` in different positional order
  alphabetically — irrelevant for consumers).
- We additionally `export type { TableProps, TableRowProps }` publicly;
  upstream keeps these interfaces module-private. Strict superset, no break.
- Props match exactly:
  - `Table`: `HTMLAttributes<HTMLTableElement> & { children: ReactNode }`.
  - `TableRow`: `HTMLAttributes<HTMLTableRowElement> & { index?: number }`
    (the `index` is the body-row position used by `useProximityHover`).
  - `TableHead`: `ThHTMLAttributes<HTMLTableCellElement>`.
  - `TableCell`: `TdHTMLAttributes<HTMLTableCellElement>`.
  - `TableHeader` / `TableBody`: `HTMLAttributes<HTMLTableSectionElement>`.

JSDoc-only enrichment: we added `/** Body-row index — set this on
<TableRow>s inside <TableBody> for proximity hover. */` on `TableRow.index`.
Upstream has no JSDoc.

## Visual drift
None.
- Table root: `w-full text-[13px] border-collapse`. Identical.
- Hover overlay: `absolute bg-accent/40 pointer-events-none`, springs.fast
  motion with init-from-active-rect → animate-to-active-rect, exit
  duration `0.06s`, opacity tween `0.08s`. Byte-identical.
- Row classnames: `group/row relative z-10 border-b transition-[border-color]
  duration-80` plus the conditional `border-transparent`/`border-accent/40`
  swap and the `is-active` marker class. Identical.
- `hideBorder` boolean (kills row border for active row and the row
  immediately above it, plus the header row when index 0 is active).
  Identical logic.
- Header row uses `fontVariationSettings: fontWeights.semibold`; body rows
  use `fontWeights.normal`. Identical.
- `TableHead`: `px-3 py-2 text-left text-foreground`. Identical.
- `TableCell`: `px-3 py-2 text-muted-foreground transition-colors duration-80
  group-[.is-active]/row:text-foreground`. Identical (we split the class
  string across two strings in the `cn()` call, upstream uses one — visual
  output identical).
- Empty `cn("", className)` calls in upstream `TableHeader`/`TableBody`;
  ours uses `className={className}` directly, dropping the redundant `cn()`.
  Functionally identical, marginal perf win.

## Behavioral drift
None directly. Inherited drift via dependencies (per Wave 1):
- `useProximityHover`: ours has rAF + transform-aware coords + axis option;
  upstream is plainer. Subtle difference in proximity hit-testing.
- `springs`: stiffness/damping vs duration/bounce — perceived spring feel
  differs slightly on the active-row chase.

`registerItem` lifecycle, `TableContext` value, ref-merge — all identical.
`measureItems` is invoked in a `useEffect([measureItems, children])` —
identical re-measure trigger on children change.

## Severity
**low**. Fidelity is essentially perfect at this layer; surface deltas are
cosmetic (formatting, redundant `cn`, public re-export of internal types).

## Recommended fix
1. None required for fidelity.
2. Optional polish: drop the public `TableProps` / `TableRowProps` exports
   if we want the smallest possible API surface and zero deviation from
   upstream. Most consumers won't import these directly.
3. If we ever fix the `useProximityHover` / `springs` drift upstream (Wave
   1's open questions 3 and the hook drift), Table benefits automatically.
