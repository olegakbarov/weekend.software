import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { cn } from "../lib/cn";
import { springs } from "../lib/springs";
import "./switch.css";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Required when there's no visible label associated with the switch. */
  ariaLabel?: string;
  className?: string;
}

const TRACK_WIDTH = 34;
const TRACK_HEIGHT = 20;
const THUMB_SIZE = 16;
const THUMB_OFFSET = 2;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET * 2;
const PILL_EXTEND = 2;
const PRESS_EXTEND = 4;
const PRESS_SHRINK = 4;
const DRAG_DEAD_ZONE = 2;

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onChange, disabled = false, ariaLabel, className },
  ref,
) {
  const hasMounted = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Drag refs (refs, not state, to avoid re-renders during drag)
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const pointerStart = useRef<{ clientX: number; originX: number } | null>(null);

  // Motion value for thumb x-axis position
  const motionX = useMotionValue(
    checked ? THUMB_OFFSET + THUMB_TRAVEL : THUMB_OFFSET,
  );

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  // Compute current thumb shape based on hover/press state.
  const thumbWidth = pressed
    ? THUMB_SIZE + PRESS_EXTEND
    : hovered
      ? THUMB_SIZE + PILL_EXTEND
      : THUMB_SIZE;
  const thumbHeight = pressed ? THUMB_SIZE - PRESS_SHRINK : THUMB_SIZE;
  const thumbY = pressed ? THUMB_OFFSET + PRESS_SHRINK / 2 : THUMB_OFFSET;
  const extraWidth = thumbWidth - THUMB_SIZE;
  const restingX = checked
    ? THUMB_OFFSET + THUMB_TRAVEL - extraWidth
    : THUMB_OFFSET;

  // Sync motionX to the resting position whenever hover/press/checked
  // changes — but only when we aren't actively dragging.
  useEffect(() => {
    if (dragging.current) return;
    if (!hasMounted.current) {
      motionX.set(restingX);
    } else {
      animate(motionX, restingX, springs.moderate);
    }
  }, [restingX, motionX]);

  // ── Pointer handlers ─────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      setPressed(true);
      dragging.current = false;
      didDrag.current = false;
      pointerStart.current = {
        clientX: e.clientX,
        originX: motionX.get(),
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture can throw in jsdom; the rest of the flow still
        // works correctly via React's synthetic pointer events.
      }
    },
    [disabled, motionX],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!pointerStart.current) return;
      const delta = e.clientX - pointerStart.current.clientX;

      if (!dragging.current) {
        if (Math.abs(delta) < DRAG_DEAD_ZONE) return;
        dragging.current = true;
      }

      const dragMin = THUMB_OFFSET;
      const pressedThumbWidth = THUMB_SIZE + PRESS_EXTEND;
      const dragMax = TRACK_WIDTH - THUMB_OFFSET - pressedThumbWidth;
      const rawX = pointerStart.current.originX + delta;
      motionX.set(Math.max(dragMin, Math.min(dragMax, rawX)));
    },
    [motionX],
  );

  const handlePointerUp = useCallback(() => {
    if (!pointerStart.current) return;
    setPressed(false);

    if (dragging.current) {
      didDrag.current = true;
      dragging.current = false;

      const currentX = motionX.get();
      const dragMin = THUMB_OFFSET;
      const pressedThumbWidth = THUMB_SIZE + PRESS_EXTEND;
      const dragMax = TRACK_WIDTH - THUMB_OFFSET - pressedThumbWidth;
      const midpoint = (dragMin + dragMax) / 2;
      const shouldBeOn = currentX > midpoint;

      if (shouldBeOn !== checked) {
        onChange(shouldBeOn);
      } else {
        // Snap back to current resting position (un-pressed).
        const snapTarget = checked ? THUMB_OFFSET + THUMB_TRAVEL : THUMB_OFFSET;
        animate(motionX, snapTarget, springs.moderate);
      }

      // Suppress the synthetic click that follows pointerup-after-drag.
      requestAnimationFrame(() => {
        didDrag.current = false;
      });
    }

    pointerStart.current = null;
  }, [checked, onChange, motionX]);

  const handlePointerCancel = useCallback(() => {
    setPressed(false);
    dragging.current = false;
    pointerStart.current = null;
  }, []);

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (didDrag.current) return;
    onChange(!checked);
  }, [checked, disabled, onChange]);

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      data-on={checked ? true : undefined}
      data-hover={hovered ? true : undefined}
      className={cn("ds-switch", className)}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
    >
      <motion.span
        aria-hidden="true"
        className="ds-switch-thumb"
        initial={false}
        style={{ x: motionX }}
        animate={{ y: thumbY, width: thumbWidth, height: thumbHeight }}
        transition={hasMounted.current ? springs.moderate : { duration: 0 }}
      />
    </button>
  );
});
