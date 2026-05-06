# Audit: Tabs (and TabsSubtle)

**Status**: weekend-addition — our `Tabs` is a **simplified Radix wrapper**, not a port of upstream's `Tabs`. Upstream's `Tabs` is a much richer animated component, and `TabsSubtle` is a separate variant we don't ship.

**Upstream sources**:
- `registry/default/tabs.tsx` (commit `d850ecf`) — the rich one
- `registry/default/tabs-subtle.tsx` (commit `d850ecf`) — the subtle/pill one
- `app/docs/tabs/page.tsx` — visual reference

**Our source**: `packages/design/src/registry/tabs.tsx`

## Three components, three different things

Upstream ships TWO tab components and we have ONE plus a separately-named related primitive:

| Component | Upstream | Ours | Visual idiom |
|---|---|---|---|
| `Tabs` (rich) | `registry/default/tabs.tsx` | — | animated background pill on a `bg-muted` container with proximity hover, focus ring, active-segment indicator that springs between triggers |
| `Tabs` (simple) | — | `src/registry/tabs.tsx` | thin row with bottom border, active trigger draws a 2px underline that overlaps the list border |
| `TabsSubtle` | `registry/default/tabs-subtle.tsx` | — | borderless, pill-style (no `bg-muted` container), proximity hover, optional `activeLabel` mode (only selected tab shows its text) |
| `Seg` | — | `src/components/seg.tsx` (Weekend addition) | filled OR subtle pill segmented control; static plate that translates between buttons |

So the situation is a **three-way mismatch**:

1. **Our `Tabs` does NOT match upstream's `Tabs`.** Upstream's is a full Radix-based, framer-motion-animated component with proximity hover, focus rings, optimistic indicator updates, controlled-by-index OR controlled-by-value, and inline-grid label slots that pre-allocate semibold width to prevent layout shift. Ours is ~80 lines: a Radix wrapper with `data-[state=active]:border-foreground` underline styling and no animation logic at all.
2. **Upstream's `Tabs` is closer in idiom to our `Seg` (subtle variant)** than to our `Tabs`. Both animate a single rect between items, both use proximity hover (upstream) / static plate (ours), both sit on a contained `bg-muted` surface.
3. **`TabsSubtle` has no analogue in our package.** Its "borderless pill row + proximity hover + optional activeLabel collapse" is unique. Our `Seg(variant="subtle")` is the closest sibling but doesn't do proximity hover or activeLabel.

## API drift (our Tabs vs upstream Tabs)

Upstream `Tabs`:
```tsx
<Tabs value={v} onValueChange={setV} selectedIndex={i} onSelect={setI}>
  <TabsList>
    <TabItem value="a" icon={Icon} label="A" />
  </TabsList>
  <TabPanel value="a">…</TabPanel>
</Tabs>
```
- Compound: `Tabs / TabsList / TabItem / TabPanel`
- `TabItem` takes `value`, `icon`, `label` (string, NOT children) — the inline-grid label trick lives inside the component
- Supports both value-based and index-based control (`selectedIndex` / `onSelect`)

Ours `Tabs`:
```tsx
<Tabs defaultValue="a">
  <TabsList>
    <TabsTrigger value="a">A</TabsTrigger>
  </TabsList>
  <TabsContent value="a">…</TabsContent>
</Tabs>
```
- Compound: `Tabs / TabsList / TabsTrigger / TabsContent` (Radix-standard names)
- `TabsTrigger` takes `children` — caller handles label rendering
- Pure Radix passthrough — no index control, no icon prop

## Visual drift

| Aspect | Upstream Tabs | Ours |
|---|---|---|
| Container | `bg-muted` + `shape.container` | `border-b border-border/60` |
| Active indicator | animated `bg-background` rect with `shape.bg`, springy moderate transition | static `border-b-2 border-foreground` |
| Hover indicator | animated `bg-accent/40` rect | `hover:text-foreground` color only |
| Focus ring | animated `border border-[#6B97FF]` rect inflated by 2px | `focus-visible:ring-2 ring-[#6B97FF]` |
| Label weight | inline-grid double-render (invisible semibold + visible variable weight) to prevent shift | static `fontWeights.medium` style on trigger |
| Icon support | first-class `icon` prop on `TabItem` with stroke-width animation | none — caller composes |

## Behavioral drift

- Upstream debounces selection via an `optimisticIdx` so the indicator moves on click before Radix re-renders.
- Upstream wires `useProximityHover({ axis: "x" })` for "hover follows pointer" feel; we have plain CSS hover.
- Upstream re-measures on `ResizeObserver`; we don't need to (no animated rect).

## Severity
**medium**. Our Tabs is functional and visually distinct ("tab strip" idiom vs upstream's "pill in a tray" idiom), so this isn't a bug — but the `Tabs` name collision with upstream is misleading. Anyone reading INVENTORY.md and our `tabs.tsx` would assume parity that doesn't exist.

`TabsSubtle` missing is also medium: it's a real, distinct UX pattern (especially with `activeLabel` collapse) that has no equivalent in our package; `Seg` is similar but lacks proximity hover and the activeLabel mode.

## Recommended fix

Three options, in increasing scope:

1. **Document only (cheapest, recommended now)**: keep our simplified Tabs, but rename it in code/docs to clarify the visual idiom (e.g. `TabsUnderline` or just keep `Tabs` but explicitly note in the JSDoc that this is "tab strip" not the upstream "pill" Tabs). Add a note that the upstream pill-style Tabs is approximated by `Seg`.

2. **Absorb upstream Tabs as a new variant**: ship upstream's `tabs.tsx` as `<Tabs variant="pill">` (default) plus our current as `<Tabs variant="underline">`. This requires absorbing `useProximityHover` axis logic, `shape-context`, `springs.moderate`, the optimistic-index dance, and adding `TabItem`/`TabPanel` to the API. Requires touching all current `<Tabs>` consumers in the desktop app.

3. **Add `TabsSubtle` as a separate primitive** (recommended once a second consumer wants the activeLabel pattern). Don't try to fold it into `Seg` — its proximity hover + focus ring system is fundamentally different from `Seg`'s static plate.

If choosing option 2 or 3, the first prerequisite is fixing the upstream-drift in `useProximityHover`, `springs`, and `shape-context` (all noted in Wave 1) — those are dependencies of the upstream Tabs.
