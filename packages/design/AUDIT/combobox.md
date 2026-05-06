# Audit: Combobox

**Status**: weekend-addition, no upstream analogue. Upstream's `Dropdown` + `MenuItem` is a different primitive (a pure menu, not a combobox).

**Upstream sources**:
- `registry/default/dropdown.tsx` (commit `d850ecf`) — closest sibling, but NOT a combobox
- `registry/default/menu-item.tsx` (commit `d850ecf`) — its child item

**Our source**: `packages/design/src/registry/combobox.tsx` (+ `combobox.test.tsx`)

## What each one is

### Our `Combobox`
- Single-component, prop-driven (NOT compound)
- Trigger button + Radix Popover containing **a free-text `<input>` with filterable preset list**
- Two trigger variants: `default` (form-input shape with border) and `ghost` (borderless, toolbar use)
- `allowFreeText` prop:
  - `true` (default): typing in the input updates `value` directly; consumer reflects in-progress text — true combobox
  - `false`: input only filters; selection requires clicking an item — acts like a Select
- Generic on `T extends string` for literal-union narrowing
- Keyboard: ArrowUp/Down, Enter to commit highlighted item or close on free-text
- Has an `inputPlaceholder` separate from the trigger `placeholder`
- Tested in `combobox.test.tsx`
- Built from `@radix-ui/react-popover` + a plain `<input>` + a `<ul role="listbox">`

### Upstream `Dropdown` + `MenuItem`
- Compound: `<Dropdown checkedIndex={n}><MenuItem index={0} ... /></Dropdown>`
- `role="menu"` container with `role="menuitemradio"` items (single-select menu, NOT a combobox)
- **No input**. No filtering. No free-text. Just a menu of preset options.
- Driven by `useProximityHover` for "hover follows pointer" with animated active background
- `MenuItem` requires `icon` + `label` (string), shows an animated check mark when `checked`
- Inline-grid label rendering (semibold-width pre-allocation) to prevent layout shift
- Standalone — no Popover/Dialog wrapping; consumer is responsible for rendering it inside something positioned (the upstream demo uses it standalone in a card)
- Has `DropdownLabel` and `DropdownSeparator` siblings

## Comparison

| Concern | Our `Combobox` | Upstream `Dropdown` |
|---|---|---|
| Free-text input | yes (default) | no |
| Filtering | yes (substring match on label) | n/a |
| Selection model | single string `value` | `checkedIndex` (numeric, via parent state) |
| Multi-select capable | no | no (use `CheckboxGroup` for that) |
| Trigger | own button + Popover | none — caller positions/triggers |
| Animated hover | no (pure CSS `hover:bg-hover`) | yes (proximity hover, animated rect) |
| Animated check | no (`Check` icon fades opacity) | yes (path-length pen-stroke animation) |
| Keyboard | own ArrowUp/Down/Enter | own ArrowUp/Down/Home/End/Space/Enter |
| Underlying primitive | `@radix-ui/react-popover` + `<input>` + `<ul>` | plain `<div role="menu">` with `useProximityHover` |
| ARIA role | `role="combobox"` on trigger, `role="listbox"` on list | `role="menu"` / `role="menuitemradio"` |
| Shape system | uses `shape.input` / `shape.container` | uses `shape.container` / `shape.item` / `shape.bg` / `shape.focusRing` |

## Where they overlap

Both let the user pick one of N options. That's the only conceptual overlap. From a UX taxonomy:

- `Combobox` = "type or pick" (free-text + filtering). Closest spec is the WAI-ARIA combobox pattern.
- `Dropdown` (upstream) = "pick from preset menu". Closest spec is the WAI-ARIA menu pattern, with single-select via `menuitemradio`.

These are categorically different patterns and **should not be unified**.

## Severity

**low** — our Combobox solves a real Weekend need (the AgentCommandPicker, the only non-trivial consumer in the desktop app, needs free-text + filtering). Upstream simply doesn't ship this pattern. The "MISSING — Dropdown" entry in INVENTORY.md is a separate gap, addressed by `_orphan-files-classification.md`.

## Recommendation

1. **Keep `Combobox` as-is**. It's a Weekend addition that fills a UX gap upstream doesn't address. Document in JSDoc that it is **not** an analogue of upstream's `Dropdown`.
2. **Separately consider absorbing `Dropdown` + `MenuItem`** as a new primitive in `@weekend/design` (single-select menu pattern). It's used in upstream demos for sort/filter pickers and has no current Weekend analogue. Prerequisite: upstream-aligned `useProximityHover`, `springs`, and `shape-context`. Not blocking — only do this when a Weekend feature wants it.
3. If we ever need a free-text combobox WITHIN a menu (rare), the right composition is `Dropdown` containing an InputField + `MenuItem`s, not extending `Combobox`.

## API drift recommendations (if we keep Combobox)

- The `popoverWidth: number` prop is rigid. Consider `popoverWidth?: number | "trigger"` so the popover can match trigger width by default (common UX expectation).
- `inputPlaceholder ?? placeholder` is the only place a consumer can hint that "the popover is for searching, not selecting" — fine, but worth documenting.
