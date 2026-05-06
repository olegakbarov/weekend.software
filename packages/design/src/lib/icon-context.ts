import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  type LucideIcon,
  Search,
  X,
} from "lucide-react";

/** Icons referenced by registry components. Extend as needed. */
const REGISTRY = {
  check: Check,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  copy: Copy,
  search: Search,
  x: X,
} as const;

export type IconName = keyof typeof REGISTRY;

/** All registry icons share the lucide-react component shape. */
export type IconComponent = LucideIcon;

/** Look up a registry icon by name. */
export function useIcon(name: IconName): IconComponent {
  return REGISTRY[name];
}
