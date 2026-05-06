# Audit: Badge

**Status**: minor-drift

**Upstream source**: `registry/default/badge.tsx` (commit `d850ecf`, 112 lines)
**Our source**: `packages/design/src/registry/badge.tsx` (84 lines)

Same color palette (17 named colors), same two variants (`solid` / `dot`),
same three sizes. Implementation pattern differs: upstream uses `cva` +
`forwardRef` with a `className` override; ours is a plain function
component with a hand-rolled size switch and no ref forwarding.

## API drift

- **No `forwardRef`**: upstream `forwardRef<HTMLSpanElement, BadgeProps>`;
  ours is a plain `function Badge(...)` returning `React.JSX.Element`.
  Consumers cannot attach a ref or use `asChild` patterns above it.
- **No spread of HTML attrs**: upstream `BadgeProps extends
  Omit<HTMLAttributes<HTMLSpanElement>, "color">` and spreads `...props`,
  preserving `id`, `data-*`, `aria-*`, `onClick`, `style`, etc. Ours
  declares only `{ color, variant, size, children, className }` —
  consumers cannot pass arbitrary HTML attrs.
- **No `style` prop**: upstream merges caller `style` with computed
  `colorStyle`; we silently drop any caller-supplied style.
- **Exports**: upstream exports `{ Badge, badgeVariants, badgeColors }` and
  types `BadgeProps`, `BadgeColor`. We export `{ Badge, BADGE_HEX }` plus
  `BadgeColor`, `BadgeVariant`, `BadgeSize` types — **`badgeVariants`
  (the cva fn) is missing**, and `badgeColors` is renamed `BADGE_HEX`.
- Color palette values are the same hex codes but **case differs** (ours
  upper-case `#A3A3A3`, upstream lower-case `#a3a3a3`). Cosmetic.

## Visual drift

- **Radius**: upstream applies `shape.item` (varies via shape context —
  pill or rounded-square depending on `[data-shape]`); ours hard-codes
  `rounded-full`. Under `data-shape="square"` the two will visibly
  diverge — upstream becomes a rounded-square pill, ours stays a circle.
- **Sizing constants are not equivalent**:
  | Size | Upstream | Ours |
  |---|---|---|
  | `sm` | `h-5 px-2 text-[11px] gap-1` | `h-[18px] px-1.5 text-[10px]` (no gap class) |
  | `md` | `h-6 px-2.5 text-[12px] gap-1.5` | `h-[22px] px-2 text-[11px]` |
  | `lg` | `h-7 px-3 text-[13px] gap-1.5` | `h-[26px] px-3 text-[12px]` |

  Heights differ across the board (h-5/6/7 = 20/24/28 vs 18/22/26), font
  sizes are all one step smaller, and our gap is fixed `gap-1` from the
  base `cn` rather than per-size.
- **Dot size**: upstream `dotSize` is `6/7/8` keyed off size; ours is
  hard-coded `1.5 × 1.5` (Tailwind `w-1.5 h-1.5` = 6×6) regardless of size.
- **Solid bg base color**: upstream non-gray solid mixes `15%` of color
  into `var(--background)`; ours mixes into `var(--card)`. With our
  Weekend-paper theme where card and background diverge, this changes the
  apparent saturation of every colored badge.
- **Font weight**: upstream applies `font-medium` (Tailwind utility);
  ours sets `fontVariationSettings: fontWeights.medium` via inline style.
  Both target weight 500, but our path bypasses Tailwind class precedence
  and overrides any consumer `font-*` class.

## Behavioral drift

- No interaction state — Badge is presentational; both implementations
  are visually static. No keyboard or focus considerations.
- One regression note: because we omit ref + props spread, the badge
  cannot be wrapped in `<Tooltip asChild>` or composed under `motion`.

## Severity

**medium** — visually close at default `data-shape`, but the
`rounded-full` hard-code defeats `useShape` in non-default shape contexts,
and the `card` vs `background` mix-base swap is a real per-theme color
shift. The missing forwardRef + props spread is a contract regression for
any consumer outside the desktop app.

## Recommended fix

Re-port with `cva` + `forwardRef` + full HTML-attrs spread. Switch to
`shape.item` for the radius. Replace our custom `h-[18px]/22px/26px` with
upstream's `h-5/6/7` and matching paddings + per-size gap. Restore
`var(--background)` as the mix base. Add `badgeVariants` to exports for
caller composition. Inherits no spring/icon drift (Badge has no animation
or icons).
