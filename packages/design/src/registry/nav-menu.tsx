"use client";

import {
  type HTMLAttributes,
  type ReactNode,
  createContext,
  forwardRef,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../lib/cn";
import { useShape } from "../lib/shape-context";
import { springs } from "../lib/springs";
import { useProximityHover } from "../hooks/use-proximity-hover";

interface NavMenuContextValue {
  registerItem: (index: number, element: HTMLElement | null) => void;
  registerSlug: (index: number, slug: string | null) => void;
  activeIndex: number | null;
  activeSlug: string | null;
}

const NavMenuContext = createContext<NavMenuContextValue | null>(null);

export function useNavMenu(): NavMenuContextValue {
  const ctx = use(NavMenuContext);
  if (!ctx) throw new Error("useNavMenu must be used within a NavMenu");
  return ctx;
}

interface NavMenuProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  activeSlug: string | null;
}

const NavMenu = forwardRef<HTMLElement, NavMenuProps>(
  ({ children, activeSlug, className, ...props }, ref) => {
    const containerRef = useRef<HTMLElement | null>(null);
    const slugToIndexRef = useRef<Map<string, number>>(new Map());
    const {
      activeIndex,
      setActiveIndex,
      itemRects,
      sessionRef,
      handlers,
      registerItem,
      measureItems,
    } = useProximityHover(containerRef);

    useEffect(() => {
      measureItems();
    }, [measureItems, children]);

    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

    const registerSlug = useCallback((index: number, slug: string | null): void => {
      if (slug === null) {
        for (const [s, i] of slugToIndexRef.current) {
          if (i === index) {
            slugToIndexRef.current.delete(s);
            break;
          }
        }
      } else {
        slugToIndexRef.current.set(slug, index);
      }
    }, []);

    const activeRouteIndex =
      activeSlug !== null ? (slugToIndexRef.current.get(activeSlug) ?? null) : null;

    const activeRect = activeIndex !== null ? itemRects[activeIndex] : null;
    const activeRouteRect = activeRouteIndex !== null ? itemRects[activeRouteIndex] : null;
    const focusRect = focusedIndex !== null ? itemRects[focusedIndex] : null;
    const isHoveringOther =
      activeIndex !== null && activeIndex !== activeRouteIndex;
    const shape = useShape();

    return (
      <NavMenuContext.Provider value={{ registerItem, registerSlug, activeIndex, activeSlug }}>
        <nav
          ref={(node) => {
            containerRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;
          }}
          onMouseEnter={handlers.onMouseEnter}
          onMouseMove={handlers.onMouseMove}
          onMouseLeave={handlers.onMouseLeave}
          onFocus={(e) => {
            const indexAttr = (e.target as HTMLElement)
              .closest("[data-nav-index]")
              ?.getAttribute("data-nav-index");
            if (indexAttr != null) {
              const idx = Number(indexAttr);
              setActiveIndex(idx);
              setFocusedIndex((e.target as HTMLElement).matches(":focus-visible") ? idx : null);
            }
          }}
          onBlur={(e) => {
            if (containerRef.current?.contains(e.relatedTarget as Node)) return;
            setFocusedIndex(null);
            setActiveIndex(null);
          }}
          onKeyDown={(e) => {
            const items = Array.from(
              containerRef.current?.querySelectorAll<HTMLElement>("a[data-nav-index]") ?? [],
            );
            const currentIdx = items.indexOf(e.target as HTMLElement);
            if (currentIdx === -1) return;
            if (["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) {
              e.preventDefault();
              const next = ["ArrowDown", "ArrowRight"].includes(e.key)
                ? (currentIdx + 1) % items.length
                : (currentIdx - 1 + items.length) % items.length;
              items[next]?.focus();
            } else if (e.key === "Home") {
              e.preventDefault();
              items[0]?.focus();
            } else if (e.key === "End") {
              e.preventDefault();
              items[items.length - 1]?.focus();
            }
          }}
          className={cn("relative flex flex-col gap-0.5 w-full select-none", className)}
          {...props}
        >
          <AnimatePresence>
            {activeRouteRect && (
              <motion.div
                className={`absolute ${shape.bg} bg-selected/50 dark:bg-accent/40 pointer-events-none`}
                initial={false}
                animate={{
                  top: activeRouteRect.top,
                  left: activeRouteRect.left,
                  width: activeRouteRect.width,
                  height: activeRouteRect.height,
                  opacity: isHoveringOther ? 0.8 : 1,
                }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ ...springs.moderate, opacity: { duration: 0.08 } }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {activeRect && (
              <motion.div
                key={sessionRef.current}
                className={`absolute ${shape.bg} bg-accent/40 dark:bg-accent/25 pointer-events-none`}
                initial={{
                  opacity: 0,
                  top: activeRouteRect?.top ?? activeRect.top,
                  left: activeRouteRect?.left ?? activeRect.left,
                  width: activeRouteRect?.width ?? activeRect.width,
                  height: activeRouteRect?.height ?? activeRect.height,
                }}
                animate={{
                  opacity: 1,
                  top: activeRect.top,
                  left: activeRect.left,
                  width: activeRect.width,
                  height: activeRect.height,
                }}
                exit={{ opacity: 0, transition: { duration: 0.06 } }}
                transition={{ ...springs.fast, opacity: { duration: 0.08 } }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {focusRect && (
              <motion.div
                className={`absolute ${shape.focusRing} pointer-events-none z-20 border border-[#6B97FF]`}
                initial={false}
                animate={{
                  left: focusRect.left,
                  top: focusRect.top,
                  width: focusRect.width,
                  height: focusRect.height,
                }}
                exit={{ opacity: 0, transition: { duration: 0.06 } }}
                transition={{ ...springs.fast, opacity: { duration: 0.08 } }}
              />
            )}
          </AnimatePresence>
          {children}
        </nav>
      </NavMenuContext.Provider>
    );
  },
);
NavMenu.displayName = "NavMenu";

export { NavMenu };
export type { NavMenuProps };
