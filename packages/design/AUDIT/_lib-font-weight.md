# Audit: lib/font-weight (variable-font weight axes)

**Status**: identical (string-quoting cosmetic difference + extra type export)

**Upstream source**: `registry/default/lib/font-weight.ts` (commit `d850ecf`)
**Our source**: `packages/design/src/lib/font-weight.ts`

## API drift

Both files export an object literal `fontWeights` mapping a semantic name
to a `font-variation-settings` string for the `wght` axis.

| Aspect | Upstream | Ours |
|---|---|---|
| Export | `fontWeights` | `fontWeights` |
| Keys | `normal`, `medium`, `semibold`, `bold` | identical |
| Values (numeric weight) | `400`, `450`, `550`, `700` | identical |
| Quoting style | single-quoted axis (`"'wght' 400"`) | double-quoted axis (`'"wght" 400'`) |
| `as const` | yes | yes |
| Extra exports | none | `export type FontWeightName = keyof typeof fontWeights` |
| JSDoc | none | one-line summary |

Side-by-side:

```ts
// upstream
export const fontWeights = {
  normal:   "'wght' 400",
  medium:   "'wght' 450",
  semibold: "'wght' 550",
  bold:     "'wght' 700",
} as const;
```

```ts
// ours
/** Variable-font weight axes used as `fontVariationSettings` values. */
export const fontWeights = {
  normal:   '"wght" 400',
  medium:   '"wght" 450',
  semibold: '"wght" 550',
  bold:     '"wght" 700',
} as const;
export type FontWeightName = keyof typeof fontWeights;
```

The numeric values match exactly: 400 / 450 / 550 / 700. These are
deliberately lighter than the typical `normal=400 / medium=500 /
semibold=600 / bold=700` because the upstream design uses an Inter
variable font with custom axes that read more confidently at lower
weights — a `medium` of 450 keeps UI labels feeling refined rather than
heavy, and `bold` of 700 is reserved for hover/active state transitions.

## Visual drift
None. Both `'wght' 400` and `"wght" 400` are valid CSS values for the
`font-variation-settings` property. The CSS Values spec accepts either
single- or double-quoted axis tags. Browsers parse them identically.

## Behavioral drift
None. Identical resolved CSS values.

The extra `FontWeightName` type export in ours adds a small public-API
surface: callers can type a prop as `FontWeightName` rather than
`keyof typeof fontWeights`. Backwards-compatible — upstream consumers
just don't see it.

## Severity
**low** — cosmetic only.

The CSS-token side of this also exists (`--fw-normal/medium/semibold/bold`
in `tokens.css`). Those are a Weekend extra, not a drift — upstream
doesn't expose CSS variables for these.

## Recommended fix
Optionally align the quoting style to upstream (single-quoted axis tags)
for byte-level fidelity. No functional change; trivial diff. Not blocking.
