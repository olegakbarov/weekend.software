/**
 * Re-export the canonical IconComponent type from icon-map. Kept as a public
 * entry point because `@weekend/design` exposes `IconComponent` from its root
 * `index.ts` for consumers building their own icon-driven primitives.
 */
export type { IconComponent, IconComponentProps } from "./icon-map";
