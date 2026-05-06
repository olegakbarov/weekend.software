import type { ReactNode } from "react";

/**
 * Minimal shape of an icon component. Compatible with lucide-react icons and
 * plain function-component icons alike. Defined as a callable signature
 * (rather than `ComponentType<...>`) to avoid React's `propTypes` variance.
 */
export type IconComponent = (props: {
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
}) => ReactNode;
