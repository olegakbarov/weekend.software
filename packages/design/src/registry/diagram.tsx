import { isValidElement, useId, type ReactNode } from "react";
import { cn } from "../lib/cn";
import "./diagram.css";

export type DiagramAnchorSide = "top" | "bottom" | "left" | "right";

export type DiagramAnchor =
  | `${string}.${DiagramAnchorSide}`
  | {
      node: string;
      side: DiagramAnchorSide;
      /** Shift the anchor point along the node's side, in viewBox units.
       * Positive shifts right (top/bottom) or down (left/right). */
      offset?: number;
    };

export type DiagramNodeTone =
  | "default"
  | "primary"
  | "secondary"
  | "muted";

export type DiagramNode = {
  id: string;
  /** 0-indexed row in the grid */
  row: number;
  /** 0-indexed column in the grid */
  col: number;
  title: string;
  /** Body lines, rendered as a monospace list under a divider */
  items?: ReactNode[];
  tone?: DiagramNodeTone;
  /** Override the cell width in viewBox units */
  width?: number;
  /** Override the cell height in viewBox units */
  height?: number;
};

export type DiagramEdgeShape = "straight" | "curve";

export type DiagramEdge = {
  from: DiagramAnchor;
  to: DiagramAnchor;
  label?: string;
  /** "auto" places the label perpendicular to the edge's primary direction.
   * The cardinal options force a side relative to the path midpoint. */
  labelSide?: "auto" | "above" | "below" | "left" | "right";
  /** Pixel offset applied to the label after labelSide resolution. Wins over
   * labelSide for both axes — use this when a label needs to clear an
   * adjacent path or sit beside (not on) a vertical line. */
  labelOffset?: { dx?: number; dy?: number };
  /** Force a routing shape. By default, axis-aligned anchors render as a
   * straight line and non-aligned anchors render as a curve. */
  shape?: DiagramEdgeShape;
  /** Strength of the curve (0..1). Only applies when shape resolves to curve. */
  curvature?: number;
  /** Render the edge in a dimmer tone. Useful for "background" connections. */
  muted?: boolean;
  /** Stable key when two edges share the same endpoints */
  id?: string;
};

export type DiagramProps = {
  cols: number;
  rows: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  /** Default cell width in viewBox units. Default: 240. */
  cellWidth?: number;
  /** Default cell height in viewBox units. Default: 100. */
  cellHeight?: number;
  /** Horizontal gap between columns. Default: 80. */
  colGap?: number;
  /** Vertical gap between rows. Default: 100. */
  rowGap?: number;
  /** Inner padding around the grid. Default: 40. */
  padding?: number;
  caption?: ReactNode;
  ariaLabel?: string;
  ariaDescription?: string;
  className?: string;
};

function diagramItemKey(nodeId: string, item: ReactNode, index: number): string {
  if (typeof item === "string" || typeof item === "number") {
    return `${nodeId}:${item}`;
  }
  if (isValidElement(item) && item.key != null) {
    return `${nodeId}:${item.key}`;
  }
  return `${nodeId}:item:${index}`;
}

const DEFAULT_CELL_WIDTH = 200;
const DEFAULT_CELL_HEIGHT = 90;
const DEFAULT_COL_GAP = 100;
const DEFAULT_ROW_GAP = 90;
const DEFAULT_PADDING = 40;
const LABEL_PERPENDICULAR_OFFSET = 12;
/** When a vertical edge's label is placed left/right of the path, the path
 * width plus typical text width means 12px will overlap. Use 50px instead so
 * the label clears the line. Authors can still narrow this via labelOffset. */
const LABEL_AXIS_CLEARANCE = 50;
const TITLE_TOP_OFFSET = 20;
const DIVIDER_TOP_OFFSET = 28;
const FIRST_ITEM_OFFSET = 46;
const ITEM_LINE_HEIGHT = 18;
const NODE_MIN_HEIGHT = 50;
const NODE_HEIGHT_BASE = 36;

function autoNodeHeight(itemsCount: number): number {
  return Math.max(NODE_MIN_HEIGHT, NODE_HEIGHT_BASE + itemsCount * ITEM_LINE_HEIGHT);
}

type ResolvedNode = DiagramNode & {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Point = { x: number; y: number };

type ResolvedAnchor = Point & {
  side: DiagramAnchorSide;
  /** Outward unit normal */
  nx: number;
  ny: number;
};

function parseAnchor(anchor: DiagramAnchor): {
  node: string;
  side: DiagramAnchorSide;
  offset: number;
} {
  if (typeof anchor === "string") {
    const dot = anchor.lastIndexOf(".");
    if (dot === -1) {
      throw new Error(
        `Diagram: anchor "${anchor}" must be in the form "<nodeId>.<side>"`,
      );
    }
    const side = anchor.slice(dot + 1) as DiagramAnchorSide;
    return { node: anchor.slice(0, dot), side, offset: 0 };
  }
  return { ...anchor, offset: anchor.offset ?? 0 };
}

function resolveAnchorPoint(
  node: ResolvedNode,
  side: DiagramAnchorSide,
  offset: number,
): ResolvedAnchor {
  switch (side) {
    case "top":
      return {
        x: node.x + node.w / 2 + offset,
        y: node.y,
        side,
        nx: 0,
        ny: -1,
      };
    case "bottom":
      return {
        x: node.x + node.w / 2 + offset,
        y: node.y + node.h,
        side,
        nx: 0,
        ny: 1,
      };
    case "left":
      return {
        x: node.x,
        y: node.y + node.h / 2 + offset,
        side,
        nx: -1,
        ny: 0,
      };
    case "right":
      return {
        x: node.x + node.w,
        y: node.y + node.h / 2 + offset,
        side,
        nx: 1,
        ny: 0,
      };
  }
}

function isAxisAligned(a: ResolvedAnchor, b: ResolvedAnchor): boolean {
  const horizontal =
    (a.side === "right" || a.side === "left") &&
    (b.side === "right" || b.side === "left") &&
    Math.abs(a.y - b.y) < 0.5;
  const vertical =
    (a.side === "top" || a.side === "bottom") &&
    (b.side === "top" || b.side === "bottom") &&
    Math.abs(a.x - b.x) < 0.5;
  return horizontal || vertical;
}

function buildEdgePath(
  a: ResolvedAnchor,
  b: ResolvedAnchor,
  shape: DiagramEdgeShape,
  curvature: number,
): { d: string; mid: Point; tangent: Point } {
  if (shape === "straight") {
    return {
      d: `M${a.x} ${a.y} L${b.x} ${b.y}`,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      tangent: { x: b.x - a.x, y: b.y - a.y },
    };
  }

  // Cubic Bézier: pull control points along each anchor's outward normal,
  // proportional to the chord length × curvature. Produces a smooth swing
  // that respects the side each anchor exits from.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  const pull = chord * Math.max(0, Math.min(1, curvature));
  const c1 = { x: a.x + a.nx * pull, y: a.y + a.ny * pull };
  const c2 = { x: b.x + b.nx * pull, y: b.y + b.ny * pull };

  // Midpoint of a cubic Bézier at t=0.5:
  // P(0.5) = (P0 + 3·C1 + 3·C2 + P3) / 8
  const mid = {
    x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8,
    y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8,
  };
  // Tangent at midpoint: 3·[(C1-P0) + 2·(C2-C1) + (P3-C2)] / 4 — but we only
  // need direction for label orientation, so the chord direction is enough.
  const tangent = { x: dx, y: dy };

  return {
    d: `M${a.x} ${a.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`,
    mid,
    tangent,
  };
}

function placeLabel(
  mid: Point,
  tangent: Point,
  side: DiagramEdge["labelSide"],
  override?: DiagramEdge["labelOffset"],
): Point {
  const horizontal = Math.abs(tangent.x) >= Math.abs(tangent.y);
  const resolvedSide =
    side && side !== "auto"
      ? side
      : horizontal
        ? "above"
        : "right";
  // For left/right placement on a vertical edge, the path occupies the same
  // x as the midpoint — placing the label only 12px to the side would land
  // it on top of the line. Use the wider clearance instead.
  const sideOffset =
    !horizontal && (resolvedSide === "left" || resolvedSide === "right")
      ? LABEL_AXIS_CLEARANCE
      : LABEL_PERPENDICULAR_OFFSET;
  let p: Point;
  switch (resolvedSide) {
    case "above":
      p = { x: mid.x, y: mid.y - LABEL_PERPENDICULAR_OFFSET };
      break;
    case "below":
      p = { x: mid.x, y: mid.y + LABEL_PERPENDICULAR_OFFSET + 4 };
      break;
    case "left":
      p = { x: mid.x - sideOffset, y: mid.y + 4 };
      break;
    case "right":
      p = { x: mid.x + sideOffset, y: mid.y + 4 };
      break;
  }
  return {
    x: p.x + (override?.dx ?? 0),
    y: p.y + (override?.dy ?? 0),
  };
}

export function Diagram({
  cols,
  rows,
  nodes,
  edges,
  cellWidth = DEFAULT_CELL_WIDTH,
  cellHeight = DEFAULT_CELL_HEIGHT,
  colGap = DEFAULT_COL_GAP,
  rowGap = DEFAULT_ROW_GAP,
  padding = DEFAULT_PADDING,
  caption,
  ariaLabel,
  ariaDescription,
  className,
}: DiagramProps) {
  const reactId = useId();
  const arrowId = `weekend-diagram-arrow-${reactId.replace(/[:]/g, "")}`;
  const arrowMutedId = `${arrowId}-muted`;
  const titleId = `${arrowId}-title`;
  const descId = `${arrowId}-desc`;

  const colStride = cellWidth + colGap;
  const rowStride = cellHeight + rowGap;
  const viewWidth = padding * 2 + cols * cellWidth + (cols - 1) * colGap;
  const viewHeight = padding * 2 + rows * cellHeight + (rows - 1) * rowGap;

  const resolved: Record<string, ResolvedNode> = {};
  for (const n of nodes) {
    const w = n.width ?? cellWidth;
    const h = n.height ?? autoNodeHeight(n.items?.length ?? 0);
    const cellX = padding + n.col * colStride;
    const cellY = padding + n.row * rowStride;
    // Top-align within the cell so all node tops in a row line up even when
    // they have different item counts. Cell height acts as the row's slot.
    resolved[n.id] = {
      ...n,
      x: cellX + (cellWidth - w) / 2,
      y: cellY,
      w,
      h,
    };
  }

  return (
    <figure className={cn("weekend-diagram", className)}>
      <svg
        aria-labelledby={
          ariaLabel || ariaDescription
            ? `${titleId} ${descId}`
            : undefined
        }
        role="img"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      >
        {ariaLabel ? (
          <text className="weekend-diagram-sr" id={titleId}>
            {ariaLabel}
          </text>
        ) : null}
        {ariaDescription ? (
          <desc id={descId}>{ariaDescription}</desc>
        ) : null}

        <defs>
          <marker
            id={arrowId}
            markerHeight="8"
            markerWidth="8"
            orient="auto"
            refX="6.5"
            refY="4"
            viewBox="0 0 8 8"
          >
            <path className="weekend-diagram-arrowhead" d="M0 0 L8 4 L0 8 Z" />
          </marker>
          <marker
            id={arrowMutedId}
            markerHeight="8"
            markerWidth="8"
            orient="auto"
            refX="6.5"
            refY="4"
            viewBox="0 0 8 8"
          >
            <path
              className="weekend-diagram-arrowhead weekend-diagram-arrowhead--muted"
              d="M0 0 L8 4 L0 8 Z"
            />
          </marker>
        </defs>

        {edges.map((edge, idx) => {
          const fromRef = parseAnchor(edge.from);
          const toRef = parseAnchor(edge.to);
          const fromNode = resolved[fromRef.node];
          const toNode = resolved[toRef.node];
          if (!fromNode || !toNode) {
            throw new Error(
              `Diagram: edge references unknown node "${
                !fromNode ? fromRef.node : toRef.node
              }"`,
            );
          }
          const a = resolveAnchorPoint(fromNode, fromRef.side, fromRef.offset);
          const b = resolveAnchorPoint(toNode, toRef.side, toRef.offset);
          const resolvedShape: DiagramEdgeShape =
            edge.shape ?? (isAxisAligned(a, b) ? "straight" : "curve");
          const curvature = edge.curvature ?? 0.4;
          const { d, mid, tangent } = buildEdgePath(
            a,
            b,
            resolvedShape,
            curvature,
          );
          const labelPos = edge.label
            ? placeLabel(mid, tangent, edge.labelSide ?? "auto", edge.labelOffset)
            : null;
          const markerEnd = edge.muted
            ? `url(#${arrowMutedId})`
            : `url(#${arrowId})`;
          return (
            <g
              className={cn(
                "weekend-diagram-edge",
                edge.muted && "weekend-diagram-edge--muted",
              )}
              key={edge.id ?? idx}
            >
              <path d={d} markerEnd={markerEnd} />
              {edge.label && labelPos ? (
                <text x={labelPos.x} y={labelPos.y}>
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {nodes.map((n) => {
          const r = resolved[n.id]!;
          return (
            <g
              className={cn(
                "weekend-diagram-node",
                n.tone && `weekend-diagram-node--${n.tone}`,
              )}
              key={n.id}
            >
              <rect height={r.h} rx="12" width={r.w} x={r.x} y={r.y} />
              <text
                className="weekend-diagram-node-title"
                x={r.x + 26}
                y={r.y + TITLE_TOP_OFFSET}
              >
                {n.title}
              </text>
              <line
                className="weekend-diagram-node-divider"
                x1={r.x + 20}
                x2={r.x + r.w - 20}
                y1={r.y + DIVIDER_TOP_OFFSET}
                y2={r.y + DIVIDER_TOP_OFFSET}
              />
              {(n.items ?? []).map((item, i) => (
                <text
                  key={diagramItemKey(n.id, item, i)}
                  x={r.x + 26}
                  y={r.y + FIRST_ITEM_OFFSET + i * ITEM_LINE_HEIGHT}
                >
                  {item}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

// Exposed for testing
export const __diagramInternals = {
  parseAnchor,
  resolveAnchorPoint,
  isAxisAligned,
  buildEdgePath,
  placeLabel,
};
