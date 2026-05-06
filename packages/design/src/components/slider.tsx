"use client";

import {
  forwardRef,
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
  type MotionValue,
} from "framer-motion";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "../lib/cn";
import { springs } from "../lib/springs";
import "./slider.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SliderValue = number | [number, number];
export type SliderValuePosition = "left" | "right" | "top" | "bottom" | "tooltip";

export interface SliderProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  value: SliderValue;
  onChange: (value: SliderValue) => void;
  min?: number;
  max?: number;
  step?: number;
  showSteps?: boolean;
  showValue?: boolean;
  valuePosition?: SliderValuePosition;
  /** Format the readout. Upstream-aligned name. */
  formatValue?: (v: number) => string;
  /** Backwards-compatible alias for `formatValue`. Deprecated — prefer `formatValue`. */
  format?: (v: number) => string;
  label?: string;
  disabled?: boolean;
  trackClassName?: string;
  trackStyle?: CSSProperties;
  fillClassName?: string;
  fillStyle?: CSSProperties;
  hideFill?: boolean;
  thumbColor?: string;
  thumbBorderColor?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THUMB_SIZE = 20;
const TRACK_BG_HEIGHT = 18;
const PIP_SIZE = 5;
// Inset track BG so its rounded-end centers align with thumb centers at min/max.
const TRACK_INSET = (THUMB_SIZE - TRACK_BG_HEIGHT) / 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function valueToPixel(
  v: number,
  min: number,
  max: number,
  trackWidth: number,
): number {
  if (max === min) return 0;
  const usable = trackWidth - THUMB_SIZE;
  return ((v - min) / (max - min)) * usable;
}

function pixelToValue(
  px: number,
  min: number,
  max: number,
  step: number,
  trackWidth: number,
): number {
  const usable = trackWidth - THUMB_SIZE;
  if (usable <= 0) return min;
  const raw = (px / usable) * (max - min) + min;
  // Snap with min-offset so non-zero `min` plus arbitrary `step` lands on
  // grid lines. Bug fixed vs. old placeholder which used `round(raw / step)`.
  const snapped = Math.round((raw - min) / step) * step + min;
  return Math.max(min, Math.min(max, snapped));
}

function toRadixValue(value: SliderValue): number[] {
  return Array.isArray(value) ? value : [value];
}

// ---------------------------------------------------------------------------
// ValueDisplay (internal)
// ---------------------------------------------------------------------------

interface ValueDisplayProps {
  values: number[];
  editingIndex: number | null;
  onStartEdit: (index: number) => void;
  onCommitEdit: (index: number, v: number) => void;
  onCancelEdit: () => void;
  min: number;
  max: number;
  step: number;
  formatValue: (v: number) => string;
  label: string | undefined;
  isRange: boolean;
  isInteracting: boolean;
}

function ValueDisplay({
  values,
  editingIndex,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  min,
  max,
  step,
  formatValue,
  label,
  isRange,
  isInteracting,
}: ValueDisplayProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingIndex !== null) {
      setInputValue(String(values[editingIndex]));
      requestAnimationFrame(() => inputRef.current?.select());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingIndex]);

  const commitEdit = useCallback(
    (index: number) => {
      const parsed = parseFloat(inputValue);
      if (!Number.isNaN(parsed)) {
        const clamped = Math.max(min, Math.min(max, parsed));
        const snapped = Math.round((clamped - min) / step) * step + min;
        onCommitEdit(index, snapped);
      } else {
        onCancelEdit();
      }
    },
    [inputValue, min, max, step, onCommitEdit, onCancelEdit],
  );

  const renderValue = (index: number) => {
    if (editingIndex === index) {
      return (
        <span className="ds-slider-value" data-interacting="true">
          {/* Ghost for layout stability — widest possible value */}
          <span className="ds-slider-value-ghost" aria-hidden="true">
            {label ? `${label}: ` : ""}
            {formatValue(max)}
          </span>
          <span className="ds-slider-value-real">
            {label && <span className="ds-slider-value-label">{label}:</span>}
            <input
              ref={inputRef}
              type="number"
              value={inputValue}
              min={min}
              max={max}
              step={step}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={() => commitEdit(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit(index);
                if (e.key === "Escape") onCancelEdit();
              }}
              aria-label={`Edit slider value${
                isRange ? (index === 0 ? " (start)" : " (end)") : ""
              }`}
              className="ds-slider-value-input"
            />
          </span>
        </span>
      );
    }

    return (
      <span
        className="ds-slider-value-text"
        onClick={() => onStartEdit(index)}
      >
        {formatValue(values[index] ?? 0)}
      </span>
    );
  };

  const widestValue = isRange
    ? `${label ? `${label}: ` : ""}${formatValue(max)} — ${formatValue(max)}`
    : `${label ? `${label}: ` : ""}${formatValue(max)}`;

  return (
    <span
      className="ds-slider-value"
      data-interacting={isInteracting ? "true" : undefined}
    >
      {/* Invisible ghost — reserves width of widest possible value */}
      <span className="ds-slider-value-ghost" aria-hidden="true">
        {widestValue}
      </span>
      <span className="ds-slider-value-real">
        {label && editingIndex === null && (
          <span className="ds-slider-value-label">{label}: </span>
        )}
        {isRange ? (
          <>
            {renderValue(0)}
            <span className="ds-slider-value-sep">—</span>
            {renderValue(1)}
          </>
        ) : (
          renderValue(0)
        )}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// TooltipValue (internal) — value follows active thumb
// ---------------------------------------------------------------------------

interface TooltipValueProps {
  value: number;
  formatValue: (v: number) => string;
  motionX: MotionValue<number>;
}

function TooltipValue({ value, formatValue, motionX }: TooltipValueProps) {
  const tooltipX = useTransform(motionX, (x) => x + THUMB_SIZE / 2);
  return (
    <motion.div
      className="ds-slider-tooltip"
      style={{ x: tooltipX }}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4, transition: { duration: 0.1 } }}
      transition={springs.fast}
    >
      {formatValue(value)}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------

export const Slider = forwardRef<HTMLDivElement, SliderProps>(function Slider(
  {
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    showSteps = false,
    showValue = true,
    valuePosition = "left",
    formatValue,
    format,
    label,
    disabled = false,
    trackClassName,
    trackStyle,
    fillClassName,
    fillStyle,
    hideFill = false,
    thumbColor,
    thumbBorderColor,
    className,
    ...props
  },
  ref,
) {
  // Resolve format function — accept both `formatValue` (upstream) and `format` (legacy alias).
  const fmt = formatValue ?? format ?? ((v: number) => String(v));
  const isRange = Array.isArray(value);
  const values = toRadixValue(value);

  // --- Refs ---
  const trackRef = useRef<HTMLDivElement>(null);
  const trackWidthRef = useRef(0);
  const dragging = useRef(false);
  const activeDragThumb = useRef<number>(0);
  const valuesRef = useRef(values);
  const minRef = useRef(min);
  const maxRef = useRef(max);
  valuesRef.current = values;
  minRef.current = min;
  maxRef.current = max;

  // --- State ---
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{
    left: number;
    width: number;
    snappedValue: number;
    cursorX: number;
  } | null>(null);
  const [focusedThumb, setFocusedThumb] = useState<number | null>(null);
  const [showHoverTooltip, setShowHoverTooltip] = useState(false);
  const hoverDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show hover tooltip after a small delay, mirroring upstream.
  useEffect(() => {
    if (isHovered) {
      hoverDelayRef.current = setTimeout(() => setShowHoverTooltip(true), 100);
    } else {
      if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current);
      setShowHoverTooltip(false);
    }
    return () => {
      if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current);
    };
  }, [isHovered]);

  // --- Motion values ---
  const motionX0 = useMotionValue(0);
  const motionX1 = useMotionValue(0);

  // --- Derived motion values for fill ---
  const fillLeft = useTransform(motionX0, (x) =>
    isRange ? x + THUMB_SIZE / 2 - TRACK_INSET : 0,
  );
  const fillWidthSingle = useTransform(
    motionX0,
    (x) => x + THUMB_SIZE / 2 - TRACK_INSET,
  );
  const fillWidthRange = useTransform(
    [motionX0, motionX1] as MotionValue<number>[],
    ([x0, x1]) => (x1 as number) - (x0 as number),
  );
  const fillWidth = isRange ? fillWidthRange : fillWidthSingle;

  // --- Step dots mask (hides dots on filled side) ---
  const stepDotsMaskSingle = useTransform(motionX0, (x) => {
    const edge = x + THUMB_SIZE / 2;
    return `linear-gradient(to right, transparent ${edge}px, black ${edge + 2}px)`;
  });
  const stepDotsMaskRange = useTransform(
    [motionX0, motionX1] as MotionValue<number>[],
    ([x0, x1]) => {
      const left = (x0 as number) + THUMB_SIZE / 2;
      const right = (x1 as number) + THUMB_SIZE / 2;
      return `linear-gradient(to right, black ${left - 2}px, transparent ${left}px, transparent ${right}px, black ${right + 2}px)`;
    },
  );
  const stepDotsMask = isRange ? stepDotsMaskRange : stepDotsMaskSingle;

  // --- Hover preview computation ---
  const computeHoverPreview = useCallback(
    (cursorX: number, trackWidth: number) => {
      const usable = trackWidth - THUMB_SIZE;
      const rawPx = cursorX - THUMB_SIZE / 2;
      const clampedPx = Math.max(0, Math.min(usable, rawPx));
      const rawVal =
        usable > 0 ? (clampedPx / usable) * (max - min) + min : min;
      const snappedVal = Math.max(
        min,
        Math.min(max, Math.round((rawVal - min) / step) * step + min),
      );
      const snappedPercent =
        max === min ? 0 : (snappedVal - min) / (max - min);
      const snappedX = THUMB_SIZE / 2 + snappedPercent * usable;

      // Find nearest thumb center
      const c0 = motionX0.get() + THUMB_SIZE / 2;
      const c1 = motionX1.get() + THUMB_SIZE / 2;
      const nearestIdx = isRange
        ? Math.abs(snappedX - c0) <= Math.abs(snappedX - c1)
          ? 0
          : 1
        : 0;
      const nearest = nearestIdx === 0 ? c0 : c1;

      const edgeX =
        snappedVal === min ? 0 : snappedVal === max ? trackWidth : snappedX;
      const left = Math.min(nearest, edgeX);
      const width = Math.abs(edgeX - nearest);
      setHoverPreview({
        left,
        width,
        snappedValue: snappedVal,
        cursorX: snappedX,
      });
    },
    [min, max, step, isRange, motionX0, motionX1],
  );

  // --- Initial sync (before paint) ---
  const initialSyncDone = useRef(false);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el || initialSyncDone.current) return;
    const w = el.offsetWidth;
    trackWidthRef.current = w;
    const px0 = valueToPixel(values[0] ?? min, min, max, w);
    motionX0.set(px0);
    if (isRange && values[1] !== undefined) {
      const px1 = valueToPixel(values[1], min, max, w);
      motionX1.set(px1);
    }
    initialSyncDone.current = true;
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Track width measurement (resize only) ---
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const w = entry.contentRect.width;
      trackWidthRef.current = w;
      if (!dragging.current && initialSyncDone.current) {
        const v = valuesRef.current;
        const mn = minRef.current;
        const mx = maxRef.current;
        const px0 = valueToPixel(v[0] ?? mn, mn, mx, w);
        animate(motionX0, px0, springs.moderate);
        if (isRange && v[1] !== undefined) {
          const px1 = valueToPixel(v[1], mn, mx, w);
          animate(motionX1, px1, springs.moderate);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isRange, motionX0, motionX1]);

  // --- Sync motion values on value change (keyboard, programmatic) ---
  useEffect(() => {
    if (!initialSyncDone.current) return;
    if (dragging.current) return;
    const tw = trackWidthRef.current;
    if (tw <= 0) return;
    const px0 = valueToPixel(values[0] ?? min, min, max, tw);
    animate(motionX0, px0, springs.moderate);
    if (isRange && values[1] !== undefined) {
      const px1 = valueToPixel(values[1], min, max, tw);
      animate(motionX1, px1, springs.moderate);
    }
  }, [values, min, max, isRange, motionX0, motionX1]);

  // --- Range crossing prevention ---
  const clampForRange = useCallback(
    (px: number, thumbIndex: number): number => {
      if (!isRange) return px;
      if (thumbIndex === 0) {
        return Math.min(px, motionX1.get() - THUMB_SIZE * 0.5);
      }
      return Math.max(px, motionX0.get() + THUMB_SIZE * 0.5);
    },
    [isRange, motionX0, motionX1],
  );

  // --- Emit value change ---
  const emitChange = useCallback(
    (thumbIndex: number, newValue: number) => {
      if (isRange) {
        const newValues: [number, number] = [
          ...(values as [number, number]),
        ];
        newValues[thumbIndex] = newValue;
        onChange(newValues);
      } else {
        onChange(newValue);
      }
    },
    [isRange, values, onChange],
  );

  // --- Pointer handlers on track ---
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const trackEl = trackRef.current;
      if (!trackEl) return;
      const trackRect = trackEl.getBoundingClientRect();
      const layoutWidth = trackEl.offsetWidth;
      if (layoutWidth <= 0 || trackRect.width <= 0) return;
      const scale = trackRect.width / layoutWidth;
      const localX = (e.clientX - trackRect.left) / scale - THUMB_SIZE / 2;
      const clamped = Math.max(
        0,
        Math.min(layoutWidth - THUMB_SIZE, localX),
      );

      if (isRange) {
        const dist0 = Math.abs(clamped - motionX0.get());
        const dist1 = Math.abs(clamped - motionX1.get());
        activeDragThumb.current = dist0 <= dist1 ? 0 : 1;
      } else {
        activeDragThumb.current = 0;
      }

      dragging.current = true;
      setIsPressed(true);

      const motionX = activeDragThumb.current === 0 ? motionX0 : motionX1;

      const snappedValue = pixelToValue(
        clamped,
        min,
        max,
        step,
        layoutWidth,
      );
      const snappedPx = valueToPixel(snappedValue, min, max, layoutWidth);
      const finalPx = clampForRange(snappedPx, activeDragThumb.current);
      animate(motionX, finalPx, springs.moderate);

      const finalValue = pixelToValue(
        finalPx,
        min,
        max,
        step,
        layoutWidth,
      );
      emitChange(activeDragThumb.current, finalValue);

      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* setPointerCapture may throw if pointer id is invalid in jsdom */
      }
    },
    [
      disabled,
      isRange,
      min,
      max,
      step,
      motionX0,
      motionX1,
      clampForRange,
      emitChange,
    ],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      e.stopPropagation();
      const trackEl = trackRef.current;
      if (!trackEl) return;
      const trackRect = trackEl.getBoundingClientRect();
      const layoutWidth = trackEl.offsetWidth;
      if (layoutWidth <= 0 || trackRect.width <= 0) return;
      const scale = trackRect.width / layoutWidth;
      const localX = (e.clientX - trackRect.left) / scale - THUMB_SIZE / 2;
      const clamped = Math.max(
        0,
        Math.min(layoutWidth - THUMB_SIZE, localX),
      );

      const motionX = activeDragThumb.current === 0 ? motionX0 : motionX1;

      const snappedValue = pixelToValue(
        clamped,
        min,
        max,
        step,
        layoutWidth,
      );
      const snappedPx = valueToPixel(snappedValue, min, max, layoutWidth);
      const finalPx = clampForRange(snappedPx, activeDragThumb.current);
      motionX.set(finalPx);

      const finalValue = pixelToValue(
        finalPx,
        min,
        max,
        step,
        layoutWidth,
      );
      emitChange(activeDragThumb.current, finalValue);
    },
    [min, max, step, motionX0, motionX1, clampForRange, emitChange],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsPressed(false);
    setHoverPreview(null);

    const tw = trackWidthRef.current;
    const motionX = activeDragThumb.current === 0 ? motionX0 : motionX1;
    const currentPx = motionX.get();
    const snapped = pixelToValue(currentPx, min, max, step, tw);
    const snappedPx = valueToPixel(snapped, min, max, tw);
    animate(motionX, snappedPx, springs.moderate);
  }, [min, max, step, motionX0, motionX1]);

  // --- Radix keyboard handler ---
  const handleRadixChange = useCallback(
    (newValues: number[]) => {
      if (dragging.current) return;
      if (isRange) {
        onChange(newValues as [number, number]);
      } else {
        onChange(newValues[0] ?? min);
      }
    },
    [isRange, onChange, min],
  );

  // --- Click-to-edit handlers ---
  const handleStartEdit = useCallback((index: number) => {
    setEditingIndex(index);
  }, []);

  const handleCommitEdit = useCallback(
    (index: number, v: number) => {
      emitChange(index, v);
      setEditingIndex(null);
    },
    [emitChange],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  // --- Step dots ---
  const stepDots = useMemo(
    () =>
      showSteps
        ? Array.from(
            { length: Math.round((max - min) / step) + 1 },
            (_, i) => {
              const v = min + i * step;
              const percent = (v - min) / (max - min);
              return { value: v, percent };
            },
          )
        : [],
    [showSteps, min, max, step],
  );

  // --- Interaction state ---
  const isInteracting = isHovered || isPressed;

  // --- Value display component ---
  const valueDisplay = showValue && valuePosition !== "tooltip" && (
    <ValueDisplay
      values={values}
      editingIndex={editingIndex}
      onStartEdit={handleStartEdit}
      onCommitEdit={handleCommitEdit}
      onCancelEdit={handleCancelEdit}
      min={min}
      max={max}
      step={step}
      formatValue={fmt}
      label={label}
      isRange={isRange}
      isInteracting={isInteracting}
    />
  );

  const renderVisualThumb = (index: number) => {
    const motionX = index === 0 ? motionX0 : motionX1;
    return (
      <motion.span
        key={`visual-thumb-${index}`}
        className="ds-slider-thumb"
        data-focused={focusedThumb === index ? "true" : undefined}
        data-active={isPressed && activeDragThumb.current === index ? "true" : undefined}
        style={{ x: motionX }}
        initial={false}
      >
        <span
          className="ds-slider-thumb-dot"
          style={{
            backgroundColor: thumbColor,
            border: thumbBorderColor
              ? `1px solid ${thumbBorderColor}`
              : undefined,
          }}
        />
        <span className="ds-slider-thumb-ring" />
      </motion.span>
    );
  };

  const trackAreaHeight =
    valuePosition === "left" || valuePosition === "right"
      ? THUMB_SIZE + 16
      : THUMB_SIZE + (valuePosition === "tooltip" ? 16 : 0);

  return (
    <div
      ref={ref}
      className={cn("ds-slider-root", className)}
      data-value-position={valuePosition}
      data-disabled={disabled ? "true" : undefined}
      {...props}
    >
      {(valuePosition === "top" || valuePosition === "left") && valueDisplay}

      <div
        className="ds-slider-track-area"
        style={{
          height: trackAreaHeight,
          paddingTop: valuePosition === "tooltip" ? 16 : 0,
        }}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => {
          setIsHovered(false);
          setHoverPreview(null);
        }}
        onMouseMove={(e) => {
          if (dragging.current) return;
          const trackEl = trackRef.current;
          if (!trackEl) return;
          const trackRect = trackEl.getBoundingClientRect();
          const layoutWidth = trackEl.offsetWidth;
          if (layoutWidth <= 0 || trackRect.width <= 0) return;
          const scale = trackRect.width / layoutWidth;
          const layoutX = (e.clientX - trackRect.left) / scale;
          const clamped = Math.max(0, Math.min(layoutWidth, layoutX));
          computeHoverPreview(clamped, layoutWidth);
        }}
      >
        {/* Tooltip values */}
        {showValue && valuePosition === "tooltip" && (
          <AnimatePresence>
            {isInteracting && (
              <TooltipValue
                key="tooltip-0"
                value={values[0] ?? min}
                formatValue={fmt}
                motionX={motionX0}
              />
            )}
            {isInteracting && isRange && values[1] !== undefined && (
              <TooltipValue
                key="tooltip-1"
                value={values[1]}
                formatValue={fmt}
                motionX={motionX1}
              />
            )}
          </AnimatePresence>
        )}

        {/* Radix Slider — invisible, supplies ARIA + keyboard nav */}
        <SliderPrimitive.Root
          value={values}
          onValueChange={handleRadixChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={label}
          className="ds-slider-radix"
          style={{ height: THUMB_SIZE }}
        >
          <SliderPrimitive.Track style={{ width: "100%", height: "100%" }}>
            <SliderPrimitive.Range />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            aria-label={
              label ? (isRange ? `${label} (start)` : label) : undefined
            }
            onFocus={(e) => {
              if (e.currentTarget.matches(":focus-visible")) {
                setFocusedThumb(0);
              }
            }}
            onBlur={() =>
              setFocusedThumb((prev) => (prev === 0 ? null : prev))
            }
          />
          {isRange && (
            <SliderPrimitive.Thumb
              aria-label={label ? `${label} (end)` : undefined}
              onFocus={(e) => {
                if (e.currentTarget.matches(":focus-visible")) {
                  setFocusedThumb(1);
                }
              }}
              onBlur={() =>
                setFocusedThumb((prev) => (prev === 1 ? null : prev))
              }
            />
          )}
        </SliderPrimitive.Root>

        {/* Visual track */}
        <div
          ref={trackRef}
          className="ds-slider-track"
          data-ready={ready ? "true" : "false"}
          style={{ height: THUMB_SIZE + 16 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div
            className="ds-slider-hit"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />

          {/* Hover value tooltip */}
          <AnimatePresence>
            {hoverPreview &&
              showHoverTooltip &&
              !isPressed &&
              valuePosition !== "tooltip" && (
                <motion.div
                  key="hover-tooltip"
                  className="ds-slider-hover-tooltip"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4, transition: { duration: 0.1 } }}
                  transition={springs.fast}
                  style={{ left: hoverPreview.cursorX }}
                >
                  {fmt(hoverPreview.snappedValue)}
                </motion.div>
              )}
          </AnimatePresence>

          {/* Track background */}
          <motion.div
            className={cn("ds-slider-track-bg", trackClassName)}
            initial={false}
            animate={{
              top: 8 + (THUMB_SIZE - TRACK_BG_HEIGHT) / 2,
            }}
            transition={springs.fast}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            style={{
              left: TRACK_INSET,
              right: TRACK_INSET,
              ...(trackStyle as Record<string, unknown> | undefined),
            } as never}
          >
            {!hideFill && (
              <motion.div
                className={cn("ds-slider-fill", fillClassName)}
                style={{
                  left: fillLeft,
                  width: fillWidth,
                  ...(fillStyle as Record<string, unknown> | undefined),
                } as never}
              />
            )}

            <motion.div
              className="ds-slider-hover-preview"
              initial={false}
              animate={{
                opacity: hoverPreview && !isPressed ? 1 : 0,
              }}
              transition={{ opacity: { duration: 0.15 } }}
              style={{
                left: hoverPreview ? hoverPreview.left - TRACK_INSET : 0,
                width: hoverPreview ? hoverPreview.width : 0,
                borderRadius:
                  hoverPreview &&
                  hoverPreview.cursorX > hoverPreview.left
                    ? "0 9999px 9999px 0"
                    : "9999px 0 0 9999px",
              }}
            />
          </motion.div>

          {/* Step dots */}
          {stepDots.length > 0 && (
            <motion.div
              className="ds-slider-dots"
              style={{
                top: 8 + (THUMB_SIZE - TRACK_BG_HEIGHT) / 2,
                WebkitMaskImage: stepDotsMask,
                maskImage: stepDotsMask,
              }}
            >
              {stepDots.map(({ value: v, percent }) => (
                <div
                  key={v}
                  className="ds-slider-dot-cell"
                  style={{
                    left: `calc(${THUMB_SIZE / 2}px + ${percent} * (100% - ${THUMB_SIZE}px))`,
                  }}
                >
                  <span className="ds-slider-dot" />
                </div>
              ))}
            </motion.div>
          )}

          {renderVisualThumb(0)}
          {isRange && renderVisualThumb(1)}
        </div>
      </div>

      {(valuePosition === "bottom" || valuePosition === "right") &&
        valueDisplay}
    </div>
  );
});

Slider.displayName = "Slider";

// ---------------------------------------------------------------------------
// SliderComfortable — chunky pip / scrubber variants
// ---------------------------------------------------------------------------

export interface SliderComfortableProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    | "onChange"
    | "defaultValue"
    | "onDrag"
    | "onDragStart"
    | "onDragEnd"
    | "onDragOver"
    | "onAnimationStart"
  > {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  variant?: "pips" | "scrubber";
  label?: string;
  formatValue?: (v: number) => string;
  /** Backwards-compatible alias for `formatValue`. */
  format?: (v: number) => string;
  disabled?: boolean;
}

export const SliderComfortable = forwardRef<
  HTMLDivElement,
  SliderComfortableProps
>(function SliderComfortable(
  {
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    variant = "pips",
    label,
    formatValue,
    format,
    disabled = false,
    className,
    ...props
  },
  ref,
) {
  const fmt = formatValue ?? format ?? ((v: number) => String(v));
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const handleDragging = useRef(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [hoverPreview, setHoverPreview] = useState<{
    left: number;
    width: number;
    snappedValue: number;
    cursorX: number;
  } | null>(null);
  const [showHoverTooltip, setShowHoverTooltip] = useState(false);
  const hoverDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isHovered) {
      hoverDelayRef.current = setTimeout(() => setShowHoverTooltip(true), 100);
    } else {
      if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current);
      setShowHoverTooltip(false);
    }
    return () => {
      if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current);
    };
  }, [isHovered]);

  const mergedRef = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      if (typeof ref === "function") {
        (ref as React.RefCallback<HTMLDivElement>)(el);
      } else if (ref) {
        (ref as React.RefObject<HTMLDivElement | null>).current = el;
      }
    },
    [ref],
  );

  const pipSteps = useMemo(
    () =>
      Array.from(
        { length: Math.round((max - min) / step) + 1 },
        (_, i) => min + i * step,
      ),
    [min, max, step],
  );
  const pipCount = pipSteps.length;

  const fillPercent = useMotionValue(
    max === min
      ? 0
      : Math.max(0, Math.min(1, (value - min) / (max - min))),
  );
  // Small offset when value is at min so the handle line stays visible.
  const zeroTarget = variant === "pips" ? 8 : 17;
  const zeroOffset = useMotionValue(value === min ? zeroTarget : 0);

  const fillWidthStyle = useTransform(fillPercent, (p) => `${p * 100}%`);
  const handleLeftStyle = useTransform(
    [fillPercent, zeroOffset] as MotionValue<number>[],
    ([p, zo]) =>
      `calc(${(p as number) * 100}% - 8px + ${zo as number}px)`,
  );
  const handleLineLeftStyle = useTransform(
    [fillPercent, zeroOffset] as MotionValue<number>[],
    ([p, zo]) =>
      `calc(${(p as number) * 100}% - 9px + ${zo as number}px)`,
  );
  const pipsFillWidthStyle = useTransform(
    [fillPercent, zeroOffset] as MotionValue<number>[],
    ([p, zo]) =>
      `calc(${(p as number) * 100}% + ${20 - 20 * (p as number) - (zo as number) * 2.5}px)`,
  );
  const pipsHandleLineLeftStyle = useTransform(fillPercent, (p) => {
    return `calc(${p * 100}% + ${11 - 24 * p}px)`;
  });
  const pipsMaskStyle = useTransform(
    [fillPercent, zeroOffset] as MotionValue<number>[],
    ([p, zo]) => {
      const offset = 20 - 20 * (p as number) - (zo as number) * 2.5;
      return `linear-gradient(to right, transparent calc(${(p as number) * 100}% + ${offset}px), black calc(${(p as number) * 100}% + ${offset + 2}px))`;
    },
  );

  const computeHoverPreview = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const w = el.clientWidth;
      if (w <= 0 || rect.width <= 0) return;
      const scale = rect.width / el.offsetWidth;
      const borderLeftLayout = (el.offsetWidth - w) / 2;
      const visualX = clientX - rect.left;
      const layoutX = visualX / scale - borderLeftLayout;
      const clamped = Math.max(0, Math.min(w, layoutX));

      let snappedVal: number;
      if (variant === "pips") {
        if (pipCount <= 1) return;
        const index = Math.max(
          0,
          Math.min(
            pipCount - 1,
            Math.round((clamped / w) * (pipCount - 1)),
          ),
        );
        snappedVal = pipSteps[index] ?? min;
      } else {
        const raw = min + (clamped / w) * (max - min);
        snappedVal = Math.max(
          min,
          Math.min(max, Math.round((raw - min) / step) * step + min),
        );
      }
      const snappedPercent =
        max === min ? 0 : (snappedVal - min) / (max - min);
      const snappedX = snappedPercent * w;

      const currentPercent = fillPercent.get();
      let handleX: number;
      if (variant === "pips") {
        const zo = zeroOffset.get();
        handleX =
          currentPercent * w + (20 - 20 * currentPercent - zo * 2.5);
      } else {
        handleX = currentPercent * w;
      }

      const edgeX =
        snappedVal === min ? 0 : snappedVal === max ? w : snappedX;
      const left = Math.min(handleX, edgeX);
      const width = Math.abs(edgeX - handleX);
      setHoverPreview({
        left,
        width,
        snappedValue: snappedVal,
        cursorX: snappedX,
      });
    },
    [variant, pipSteps, pipCount, min, max, step, fillPercent, zeroOffset],
  );

  useEffect(() => {
    if (dragging.current || handleDragging.current) return;
    const percent =
      max === min
        ? 0
        : Math.max(0, Math.min(1, (value - min) / (max - min)));
    animate(fillPercent, percent, springs.fast);
    animate(
      zeroOffset,
      value === min ? zeroTarget : 0,
      springs.fast,
    );
  }, [value, min, max, variant, fillPercent, zeroOffset, zeroTarget]);

  const getValueFromX = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return min;
      const x = clientX - rect.left;
      const clamped = Math.max(0, Math.min(rect.width, x));
      if (variant === "pips") {
        if (pipCount <= 1) return min;
        const index = Math.max(
          0,
          Math.min(
            pipCount - 1,
            Math.round((clamped / rect.width) * (pipCount - 1)),
          ),
        );
        return pipSteps[index] ?? min;
      }
      const raw = min + (clamped / rect.width) * (max - min);
      const snapped = Math.round((raw - min) / step) * step + min;
      return Math.max(min, Math.min(max, snapped));
    },
    [variant, pipSteps, pipCount, min, max, step],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      dragging.current = true;
      setIsPressed(true);
      const newVal = getValueFromX(e.clientX);
      onChange(newVal);
      const newPercent = Math.max(
        0,
        Math.min(1, (newVal - min) / (max - min)),
      );
      animate(fillPercent, newPercent, springs.fast);
      animate(
        zeroOffset,
        newVal === min ? zeroTarget : 0,
        springs.fast,
      );
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* jsdom */
      }
    },
    [
      disabled,
      getValueFromX,
      onChange,
      fillPercent,
      zeroOffset,
      zeroTarget,
      min,
      max,
    ],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const newVal = getValueFromX(e.clientX);
      onChange(newVal);
      const newPercent = Math.max(
        0,
        Math.min(1, (newVal - min) / (max - min)),
      );
      if (variant === "scrubber") {
        fillPercent.set(newPercent);
      } else {
        animate(fillPercent, newPercent, springs.fast);
      }
      animate(
        zeroOffset,
        newVal === min ? zeroTarget : 0,
        springs.fast,
      );
    },
    [
      getValueFromX,
      onChange,
      variant,
      fillPercent,
      zeroOffset,
      zeroTarget,
      min,
      max,
    ],
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
    setIsPressed(false);
    setHoverPreview(null);
  }, []);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      handleDragging.current = true;
      setIsPressed(true);
      const newVal = getValueFromX(e.clientX);
      onChange(newVal);
      fillPercent.set(
        Math.max(0, Math.min(1, (newVal - min) / (max - min))),
      );
      animate(
        zeroOffset,
        newVal === min ? zeroTarget : 0,
        springs.fast,
      );
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* jsdom */
      }
    },
    [
      disabled,
      getValueFromX,
      onChange,
      fillPercent,
      zeroOffset,
      zeroTarget,
      min,
      max,
    ],
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!handleDragging.current) return;
      const newVal = getValueFromX(e.clientX);
      onChange(newVal);
      fillPercent.set(
        Math.max(0, Math.min(1, (newVal - min) / (max - min))),
      );
      animate(
        zeroOffset,
        newVal === min ? zeroTarget : 0,
        springs.fast,
      );
    },
    [getValueFromX, onChange, fillPercent, zeroOffset, zeroTarget, min, max],
  );

  const handleResizePointerUp = useCallback(() => {
    handleDragging.current = false;
    setIsPressed(false);
    setHoverPreview(null);
  }, []);

  const handleRadixChange = useCallback(
    (newValues: number[]) => {
      onChange(newValues[0] ?? min);
    },
    [onChange, min],
  );

  const isActive = isHovered || isFocused;

  return (
    <div
      className="ds-slider-comfy-wrap"
      onPointerEnter={() => {
        if (!disabled) setIsHovered(true);
      }}
      onPointerLeave={() => {
        if (!disabled) {
          setIsHovered(false);
          setHoverPreview(null);
        }
      }}
      onMouseMove={(e) => {
        if (disabled || dragging.current || handleDragging.current) return;
        computeHoverPreview(e.clientX);
      }}
    >
      <div
        className="ds-slider-hit"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      <AnimatePresence>
        {hoverPreview && showHoverTooltip && !isPressed && (
          <motion.div
            key="hover-tooltip"
            className="ds-slider-hover-tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.1 } }}
            transition={springs.fast}
            style={{ left: hoverPreview.cursorX, top: -30 }}
          >
            {fmt(hoverPreview.snappedValue)}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        ref={mergedRef}
        className={cn("ds-slider-comfy", className)}
        data-variant={variant}
        data-active={isActive ? "true" : undefined}
        data-focused={isFocused ? "true" : undefined}
        data-disabled={disabled ? "true" : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        {...(props as Record<string, unknown>)}
      >
        <SliderPrimitive.Root
          value={[value]}
          onValueChange={handleRadixChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="ds-slider-comfy-radix"
        >
          <SliderPrimitive.Track style={{ width: "100%", height: "100%" }}>
            <SliderPrimitive.Range />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            onFocus={(e) => {
              if (e.currentTarget.matches(":focus-visible")) {
                setIsFocused(true);
              }
            }}
            onBlur={() => setIsFocused(false)}
          />
        </SliderPrimitive.Root>

        <motion.div
          className="ds-slider-hover-preview"
          initial={false}
          animate={{ opacity: hoverPreview && !isPressed ? 1 : 0 }}
          transition={{ opacity: { duration: 0.15 } }}
          style={{
            left: hoverPreview ? hoverPreview.left : 0,
            width: hoverPreview ? hoverPreview.width : 0,
            top: 0,
            bottom: 0,
            height: undefined,
            zIndex: 3,
          }}
        />

        {variant === "pips" && (
          <motion.div
            className="ds-slider-comfy-pips"
            style={{
              WebkitMaskImage: pipsMaskStyle,
              maskImage: pipsMaskStyle,
            }}
          >
            {pipSteps.map((pipValue) => {
              const isActivePip = pipValue === value;
              return (
                <div
                  key={pipValue}
                  className="ds-slider-comfy-pip"
                  data-active={isActivePip ? "true" : undefined}
                  style={{ width: PIP_SIZE, height: PIP_SIZE }}
                >
                  <span className="ds-slider-comfy-pip-dot" />
                </div>
              );
            })}
          </motion.div>
        )}

        {variant === "pips" && (
          <div
            className="ds-slider-comfy-labels"
            data-tier="bg"
            aria-hidden
          >
            {label && (
              <span className="ds-slider-comfy-label">{label}</span>
            )}
            <span
              className="ds-slider-comfy-value"
              style={{ minWidth: `${String(fmt(max)).length}ch` }}
            >
              {fmt(value)}
            </span>
          </div>
        )}

        {variant === "pips" && (
          <motion.div
            className="ds-slider-comfy-fill"
            style={{ width: pipsFillWidthStyle }}
          />
        )}

        {variant === "pips" && (
          <motion.div
            className="ds-slider-comfy-handle-line"
            style={{ left: pipsHandleLineLeftStyle }}
          />
        )}

        {variant === "pips" && (
          <div className="ds-slider-comfy-labels" data-tier="fg">
            {label && (
              <span className="ds-slider-comfy-label">{label}</span>
            )}
            <span
              className="ds-slider-comfy-value"
              style={{ minWidth: `${String(fmt(max)).length}ch` }}
            >
              {fmt(value)}
            </span>
          </div>
        )}

        {variant === "scrubber" && (
          <motion.div
            className="ds-slider-comfy-fill"
            style={{ width: fillWidthStyle }}
          />
        )}

        {variant === "scrubber" && (
          <motion.div
            className="ds-slider-comfy-handle-line"
            style={{ left: handleLineLeftStyle }}
          />
        )}

        {variant === "scrubber" && label && (
          <span className="ds-slider-comfy-scrub-label">{label}</span>
        )}

        {variant === "scrubber" && (
          <>
            <div className="ds-slider-comfy-spacer" />
            <span
              className="ds-slider-comfy-scrub-value"
              style={{ minWidth: `${String(fmt(max)).length}ch` }}
            >
              {fmt(value)}
            </span>
          </>
        )}

        {variant === "scrubber" && (
          <motion.div
            className="ds-slider-comfy-resize-handle"
            style={{ left: handleLeftStyle }}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
          />
        )}
      </motion.div>
    </div>
  );
});

SliderComfortable.displayName = "SliderComfortable";
