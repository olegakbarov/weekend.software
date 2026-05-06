# Audit: NavItem

**Status**: minor-drift (Wave 1 mis-classified as `not-in-upstream`)

**Upstream source**: `registry/default/nav-item.tsx` (commit `d850ecf`)
(re-exported through `components/ui/nav-item.tsx`)
**Our source**: `packages/design/src/registry/nav-item.tsx`

> Wave 1 listed this as EXTRA ("Weekend addition (sidebar pattern)"). That
> was incorrect. Upstream ships `registry/default/nav-item.tsx` and uses it
> in the demo sidebar (`app/components/sidebar.tsx`). It is **not in
> `registry.json`** and has **no `app/docs/nav-item/page.tsx`** reference,
> so it's a "canonical-but-unregistered" upstream component, in the same
> bucket as MobileDrawer and NavMenu.

## API drift
Identical public API:
- Props: `label: string`, `href: string`, `index: number`,
  `icon?: IconComponent`, `isNew?: boolean`, plus
  `Omit<HTMLAttributes<HTMLAnchorElement>, "href">`.
- `forwardRef<HTMLAnchorElement, NavItemProps>`.
- Both export named `NavItem`. Upstream additionally exports `default
  NavItem`; we don't. Ours additionally exports `type { NavItemProps }`
  publicly; upstream keeps the interface module-private.

## Visual drift
None functionally. Both produce:
- Container: `relative z-10 flex items-center ${shape.item} px-3 py-1.5
  cursor-pointer outline-none` (shape comes from `useShape()`, identical
  source-of-truth — though our `shape-context` impl drifts from upstream's
  Context provider; see Wave 1 lib drift).
- Icon: `size={16}`, `strokeWidth={isActive ? 2 : 1.5}`, classes
  `shrink-0 mr-2 transition-[color,stroke-width] duration-80` with
  active-state color swap (`text-foreground` vs `text-muted-foreground`).
- Label uses the upstream "ghost-bold-row" trick — render an invisible
  semibold copy in row 1 col 1 to reserve width, overlay the live label so
  weight changes don't reflow. Identical implementation.
- Bold-state transition `transition-[color,font-variation-settings]
  duration-80`, `font-variation-settings` switches `fontWeights.normal` ↔
  `fontWeights.semibold`.
- "isNew" dot: `inline-block ml-2 size-1.5 rounded-full bg-blue-500
  align-middle`. Identical.

## Behavioral drift
**One meaningful difference**: anchor element type.
- Upstream: `import Link from "next/link"` and renders `<Link href={...}>`.
  This routes via Next App Router and prefetches.
- Ours: renders a plain `<a href={...}>`. Correct for Weekend (we use
  TanStack hash router, not Next), but worth flagging as a deliberate
  divergence — any consumer expecting `Link`-style prefetch / SPA routing
  will not get it.

Roving tabindex logic is identical:
`isActiveRoute ? 0 : activeRouteExists ? -1 : index === 0 ? 0 : -1`.

`registerItem` / `registerSlug` lifecycle hooks are identical (subscribe on
mount, unsubscribe on unmount, also unsubscribe-on-href-change because
`href` is in the dep array).

Ref-merge logic identical.

## Severity
**low–medium**.
- **Low** for the drift itself — visuals and a11y are perfectly aligned.
- **Medium** in INVENTORY hygiene terms: Wave 1's "EXTRA" claim is
  load-bearing (it implies Weekend authored a sidebar primitive when in fact
  upstream did). Worth re-classifying so future waves don't try to push it
  back upstream.

## Recommended fix
1. **INVENTORY.md**: re-classify NavItem as **EXISTS (drift: routing
   primitive)**, with a note that upstream uses `next/link` and ours uses
   `<a>` because Weekend doesn't ship Next.
2. Consider exposing an optional `as` / `asChild` prop (or a render-prop for
   the anchor) so consumers in non-Next contexts can supply their own
   router-aware Link (e.g. `<Link>` from TanStack Router) without forking
   the file. This would let us fully converge with upstream while giving
   Weekend the ability to inject TanStack's `Link`. If we don't take that
   path, the current `<a>` is fine and the divergence is documented.
3. No visual/CSS changes required.
