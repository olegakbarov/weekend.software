"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

import {
  iconMap,
  iconLibraryOrder,
  type IconLibrary,
  type IconName,
  type IconComponent,
} from "./icon-map";

// Re-export types for consumers
export type {
  IconComponent,
  IconComponentProps,
  IconName,
  IconLibrary,
} from "./icon-map";
export { iconLibraryOrder, iconLibraryLabels, registerIconLibrary } from "./icon-map";

/**
 * Compatibility shim — maps the legacy 6 camelCase Weekend icon names to the
 * upstream kebab-case canonical names. Lets the existing call sites
 * (`useIcon("copy")`, `useIcon("chevronDown")`, etc.) keep working until they
 * migrate to the kebab-case names.
 */
const LEGACY_NAME_MAP: Record<string, IconName> = {
  check: "check",
  chevronDown: "chevron-down",
  chevronRight: "chevron-right",
  copy: "copy",
  search: "search",
  x: "x",
};

/** Type alias accepting both the legacy camelCase shim names and canonical kebab-case names. */
export type AnyIconName = IconName | keyof typeof LEGACY_NAME_MAP;

function resolveIconName(name: AnyIconName): IconName {
  const legacy = LEGACY_NAME_MAP[name as keyof typeof LEGACY_NAME_MAP];
  if (legacy) return legacy;
  return name as IconName;
}

interface IconContextValue {
  iconLibrary: IconLibrary;
  setIconLibrary: (lib: IconLibrary) => void;
}

const IconContext = createContext<IconContextValue | null>(null);

/**
 * Returns the current icon library and setter.
 * Throws if used outside IconProvider.
 */
export function useIconLibrary(): IconContextValue {
  const ctx = useContext(IconContext);
  if (!ctx) throw new Error("useIconLibrary must be used within an IconProvider");
  return ctx;
}

/**
 * Returns a single icon component for the given name.
 * Falls back to Lucide if no provider is present.
 *
 * Accepts both upstream-canonical kebab-case names (`"chevron-down"`) and
 * the legacy camelCase aliases (`"chevronDown"`) used in earlier Weekend
 * call sites — see `LEGACY_NAME_MAP` above.
 */
export function useIcon(name: AnyIconName): IconComponent {
  const canonical = resolveIconName(name);
  const ctx = useContext(IconContext);
  if (!ctx) return iconMap.lucide[canonical];
  return iconMap[ctx.iconLibrary][canonical];
}

/**
 * Returns the full icon map for the current library.
 * Falls back to Lucide if no provider is present.
 */
export function useIcons(): Record<IconName, IconComponent> {
  const ctx = useContext(IconContext);
  const lib = ctx?.iconLibrary ?? "lucide";
  return useMemo(() => iconMap[lib], [lib]);
}

export function IconProvider({
  children,
  defaultLibrary = "lucide",
}: {
  children: ReactNode;
  defaultLibrary?: IconLibrary;
}): React.JSX.Element {
  const [iconLibrary, setIconLibraryState] = useState<IconLibrary>(defaultLibrary);

  const setIconLibrary = useCallback((next: IconLibrary) => {
    setIconLibraryState(next);
  }, []);

  // Global keyboard shortcut: I to cycle icon library
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "i" && e.key !== "I") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      setIconLibraryState((prev) => {
        const idx = iconLibraryOrder.indexOf(prev);
        return iconLibraryOrder[(idx + 1) % iconLibraryOrder.length] ?? "lucide";
      });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <IconContext.Provider value={{ iconLibrary, setIconLibrary }}>
      {children}
    </IconContext.Provider>
  );
}
