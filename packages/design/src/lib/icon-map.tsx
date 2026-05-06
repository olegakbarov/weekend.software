"use client";

import type { ComponentType, ReactNode } from "react";

// ── Lucide (always-available default) ───────────────────────
import {
  ChevronRight,
  ChevronDown,
  X,
  Copy,
  Menu,
  Dot,
  Monitor,
  Sun,
  Moon,
  RectangleHorizontal,
  Circle,
  SquareLibrary,
  Clock,
  Star,
  Settings,
  Plus,
  ArrowRight,
  Search,
  Loader,
  Users,
  Lock,
  Mail,
  Bell,
  Shield,
  Palette,
  Lightbulb,
  Rocket,
  Heart,
  Paintbrush,
  Brain,
  Globe,
  User,
  ImageIcon,
  Link,
  Check,
  RotateCcw,
  Play,
  Pause,
  Pipette,
  Home,
  MessageCircle,
  Inbox,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────

export interface IconComponentProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export type IconComponent = ComponentType<IconComponentProps>;

export type IconLibrary = "lucide" | "tabler" | "phosphor" | "hugeicons";

export type IconName =
  | "chevron-right" | "chevron-down" | "x" | "copy" | "menu" | "dot"
  | "monitor" | "sun" | "moon" | "rectangle-horizontal" | "circle"
  | "square-library" | "clock" | "star" | "settings"
  | "plus" | "arrow-right" | "search" | "loader"
  | "users" | "lock" | "mail" | "bell" | "shield" | "palette"
  | "lightbulb" | "rocket" | "heart" | "paintbrush" | "brain"
  | "globe" | "user"
  | "image" | "link" | "check" | "rotate-ccw"
  | "play" | "pause" | "pipette"
  | "home" | "message-circle" | "inbox";

export const iconLibraryOrder: IconLibrary[] = ["lucide", "tabler", "phosphor", "hugeicons"];

export const iconLibraryLabels: Record<IconLibrary, string> = {
  lucide: "Lucide",
  tabler: "Tabler",
  phosphor: "Phosphor",
  hugeicons: "HugeIcons",
};

// ── Lucide map (always installed) ───────────────────────────

const lucideMap: Record<IconName, IconComponent> = {
  "chevron-right": ChevronRight,
  "chevron-down": ChevronDown,
  "pipette": Pipette,
  "x": X,
  "copy": Copy,
  "menu": Menu,
  "dot": Dot,
  "monitor": Monitor,
  "sun": Sun,
  "moon": Moon,
  "rectangle-horizontal": RectangleHorizontal,
  "circle": Circle,
  "square-library": SquareLibrary,
  "clock": Clock,
  "star": Star,
  "settings": Settings,
  "plus": Plus,
  "arrow-right": ArrowRight,
  "search": Search,
  "loader": Loader,
  "users": Users,
  "lock": Lock,
  "mail": Mail,
  "bell": Bell,
  "shield": Shield,
  "palette": Palette,
  "lightbulb": Lightbulb,
  "rocket": Rocket,
  "heart": Heart,
  "paintbrush": Paintbrush,
  "brain": Brain,
  "globe": Globe,
  "user": User,
  "image": ImageIcon,
  "link": Link,
  "check": Check,
  "rotate-ccw": RotateCcw,
  "play": Play,
  "pause": Pause,
  "home": Home,
  "message-circle": MessageCircle,
  "inbox": Inbox,
};

// ── Optional libraries (peer deps) ──────────────────────────
//
// tabler / phosphor / hugeicons are PEER deps in package.json; consumers
// opt-in by installing them. We don't import them statically (would force
// every consumer to install them). Instead we expose a registration API:
// callers wishing to use a non-lucide library install the dep, then call
// `registerIconLibrary("tabler", buildTablerMap())` from app code.
//
// Until registered, requesting a non-lucide library throws a helpful error.

const dynamicMaps: Partial<Record<Exclude<IconLibrary, "lucide">, Record<IconName, IconComponent>>> = {};

/**
 * Register a non-lucide icon library at runtime. Consumers wanting tabler /
 * phosphor / hugeicons install the corresponding peer dep, build the
 * `Record<IconName, IconComponent>` (see upstream `icon-map.tsx` for adapter
 * shapes), and register it here before mounting `<IconProvider>` with that
 * library as default.
 */
export function registerIconLibrary(
  library: Exclude<IconLibrary, "lucide">,
  map: Record<IconName, IconComponent>,
): void {
  dynamicMaps[library] = map;
}

function missingLibraryFallback(library: IconLibrary): Record<IconName, IconComponent> {
  // Build a fallback map that throws a helpful error per icon — defers the
  // crash until the icon is actually rendered, so unrelated UI keeps working.
  const proxy = new Proxy({} as Record<IconName, IconComponent>, {
    get(_, name: string): IconComponent {
      return function MissingIcon(): ReactNode {
        throw new Error(
          `[@weekend/design] Icon library "${library}" was requested but is not installed. ` +
          `Install the corresponding peer dep (e.g. "@tabler/icons-react") and call ` +
          `registerIconLibrary("${library}", ...) before mounting <IconProvider>. ` +
          `Requested icon: "${name}".`,
        );
      };
    },
  });
  return proxy;
}

// ── Unified Map ─────────────────────────────────────────────

export const iconMap: Record<IconLibrary, Record<IconName, IconComponent>> = {
  lucide: lucideMap,
  // For non-lucide libraries we resolve at access time so dynamic
  // registrations land before reads.
  get tabler() {
    return dynamicMaps.tabler ?? missingLibraryFallback("tabler");
  },
  get phosphor() {
    return dynamicMaps.phosphor ?? missingLibraryFallback("phosphor");
  },
  get hugeicons() {
    return dynamicMaps.hugeicons ?? missingLibraryFallback("hugeicons");
  },
};
