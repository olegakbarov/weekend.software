# Audit: InputGroup / InputField

**Status**: identical (modulo lib drift)

**Upstream source**: `registry/default/input-group.tsx` (commit `d850ecf`, 260 lines)
**Our source**: `packages/design/src/registry/input-group.tsx` (229 lines)

Effectively a verbatim port. The 31-line delta is entirely formatting
(condensed blocks, fewer blank lines, slightly more compact callbacks).
Logic, classes, JSX shape, and prop contract are identical.

## API drift

- Exports parity: both export `{ InputGroup, InputField }`. We
  additionally export types `{ InputFieldProps, InputGroupProps }`;
  upstream also `default InputGroup`. Minor and additive.
- `InputFieldProps`:
  - Upstream `extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "index">`.
  - Ours `extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange">`.
  - **Drift**: upstream omits the native HTML `index` (which doesn't
    exist on input anyway, but defends against `...props` spread overlap);
    we keep it. Practically irrelevant since `index` is destructured
    before spread, but theoretically allows a caller to type `index="…"`
    against the rest props slot. Cosmetic only.
- `aria-invalid`: upstream `!!error || undefined`; ours `error ? true :
  undefined`. Identical runtime.

## Visual drift

None observed. Both use:

- `shape.input` for input container radius
- `flex flex-col gap-3 w-72 max-w-full` on the group
- `gap-1`, `cursor-text`, `opacity-50 pointer-events-none` on disabled
- Inline-grid invisible-semibold/visible-normal label width-stability
- Identical bg/ring decision tree:
  | State | bg | ring |
  |---|---|---|
  | disabled | transparent | border |
  | error + focused | card | destructive/50 |
  | error + active (hover) | destructive-light/60 | destructive/50 |
  | error idle | transparent | transparent |
  | focused | card | border |
  | active | muted/50 | border |
  | idle | transparent | transparent |
- Icon `size={16}`, `strokeWidth` flips `1.5` → `2` on label-active,
  `transition-[color,stroke-width] duration-80`
- Input `text-[13px]`, `placeholder:text-muted-foreground`,
  `font-[inherit]`, `fontVariationSettings: fontWeights.normal`
- Error span `text-[12px] text-destructive pl-3` weight medium

## Behavioral drift

- Proximity hover: both use the **inline `getBoundingClientRect` + closest-
  center** loop on `mousemove`, **not** the shared `useProximityHover`
  hook. (Upstream Accordion, Combobox-equivalents use the hook; InputGroup
  predates and re-implements the simpler version inline. Both copies share
  this idiosyncrasy.)
- Active item is purely cursor-driven (no keyboard focus tracking on the
  group level — focus flows through the native input). Identical.
- No stray `useEffect`s or refs that diverge.

## Severity

**low** — module-level parity; the only drift is inherited from shared
libs. Specifically:

- **Spring drift** (`_lib-springs.md`): InputGroup uses **no springs** —
  all transitions are CSS `duration-80`. Spring drift does NOT affect
  this component.
- **Icon-context drift** (`_lib-icon-and-icon-context.md`): InputField
  takes `icon?: IconComponent` from `lib/icon-context`. The type alias
  drift (LucideIcon vs the upstream adapter shape) carries through here
  — callers passing a non-lucide icon component upstream wouldn't
  type-check against ours. Practical impact for the desktop app: zero,
  since we ship lucide only.
- **Shape-context drift** (see `_lib-shape-context.md` if present): both
  read `shape.input`, but upstream's class strings differ slightly from
  ours.

## Recommended fix

No targeted patch needed for this component. Re-validate after the lib-
level fixes (springs, icon-context, shape-context) land; the component
will inherit correct behavior automatically. Optionally tighten the
`Omit<…, "index">` to match upstream for type-contract symmetry. Optionally
migrate the inline proximity loop to the shared `useProximityHover` hook
once that hook's parity work lands — both upstream and ours would benefit
from collapsing to a single implementation.
