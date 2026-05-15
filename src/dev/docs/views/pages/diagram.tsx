import { Diagram, type DiagramEdge, type DiagramNode } from "@weekend/design/registry";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

const BASIC_NODES: DiagramNode[] = [
  {
    id: "client",
    row: 0,
    col: 0,
    title: "Client",
    items: ["Browser", "Mobile"],
  },
  {
    id: "api",
    row: 0,
    col: 1,
    title: "API",
    tone: "secondary",
    items: ["Auth", "Routing"],
  },
  {
    id: "db",
    row: 0,
    col: 2,
    title: "Database",
    items: ["Postgres", "Replicas"],
  },
];

const BASIC_EDGES: DiagramEdge[] = [
  { from: "client.right", to: "api.left", label: "request" },
  { from: "api.right", to: "db.left", label: "query" },
];

const PARALLEL_EDGES: DiagramEdge[] = [
  { from: "client.right", to: "api.left", label: "request" },
  {
    from: { node: "api", side: "left", offset: 28 },
    to: { node: "client", side: "right", offset: 28 },
    label: "response",
    labelSide: "below",
  },
  { from: "api.right", to: "db.left", label: "query" },
  {
    from: { node: "db", side: "left", offset: 28 },
    to: { node: "api", side: "right", offset: 28 },
    label: "rows",
    labelSide: "below",
  },
];

const CURVE_NODES: DiagramNode[] = [
  { id: "a", row: 0, col: 0, title: "Source", tone: "primary" },
  { id: "b", row: 0, col: 1, title: "Stage" },
  { id: "c", row: 1, col: 0, title: "Worker" },
  { id: "d", row: 1, col: 1, title: "Sink", tone: "secondary" },
];

const CURVE_EDGES: DiagramEdge[] = [
  { from: "a.right", to: "b.left", label: "straight" },
  { from: "c.right", to: "d.left", label: "straight" },
  // Non-aligned: auto promotes to a curve.
  { from: "a.bottom", to: "d.top", label: "auto curve" },
  // Explicit curve override with custom curvature.
  {
    from: "b.bottom",
    to: "c.top",
    shape: "curve",
    curvature: 0.6,
    label: "shape: curve",
    labelSide: "right",
  },
];

const TONE_NODES: DiagramNode[] = [
  { id: "default", row: 0, col: 0, title: "Default" },
  { id: "primary", row: 0, col: 1, title: "Primary", tone: "primary" },
  { id: "secondary", row: 1, col: 0, title: "Secondary", tone: "secondary" },
  { id: "muted", row: 1, col: 1, title: "Muted", tone: "muted" },
];

const TONE_EDGES: DiagramEdge[] = [
  { from: "default.right", to: "primary.left" },
  { from: "secondary.right", to: "muted.left", muted: true },
];

export function PageDiagram(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Diagram</h1>
        <p className="lede">
          Declarative SVG diagrams. Place nodes in a grid by{" "}
          <code>row</code> / <code>col</code>, connect them with anchor strings
          like <code>"shell.right"</code>. Axis-aligned edges render as
          straight lines; non-aligned edges auto-promote to a smooth cubic
          curve.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="anatomy">
          Anatomy
        </H>
        <p className="lede">
          A node lives in a grid cell and renders a uppercase title, divider,
          and a stack of monospace body lines. Edges are arrows between anchor
          points on node sides.
        </p>
        <div className="example">
          <div className="example-stage" style={{ width: "100%" }}>
            <Diagram cols={3} rows={1} nodes={BASIC_NODES} edges={BASIC_EDGES} />
          </div>
        </div>
        <CodeBlock lang="tsx">{`<Diagram
  cols={3}
  rows={1}
  nodes={[
    { id: "client", row: 0, col: 0, title: "Client",
      items: ["Browser", "Mobile"] },
    { id: "api",    row: 0, col: 1, title: "API",
      tone: "secondary", items: ["Auth", "Routing"] },
    { id: "db",     row: 0, col: 2, title: "Database",
      items: ["Postgres", "Replicas"] },
  ]}
  edges={[
    { from: "client.right", to: "api.left", label: "request" },
    { from: "api.right",    to: "db.left",  label: "query" },
  ]}
/>`}</CodeBlock>
      </div>

      <div className="section">
        <H as="h2" id="parallel-edges">
          Parallel edges
        </H>
        <p className="lede">
          Two edges between the same pair of nodes overlap unless you offset
          each anchor along its side. Pass <code>offset</code> on the object
          form of an anchor to displace it.
        </p>
        <div className="example">
          <div className="example-stage" style={{ width: "100%" }}>
            <Diagram
              cols={3}
              rows={1}
              nodes={BASIC_NODES}
              edges={PARALLEL_EDGES}
            />
          </div>
        </div>
        <CodeBlock lang="tsx">{`{ from: "client.right", to: "api.left", label: "request" },
{ from: { node: "api",    side: "left",  offset: 28 },
  to:   { node: "client", side: "right", offset: 28 },
  label: "response", labelSide: "below" },`}</CodeBlock>
      </div>

      <div className="section">
        <H as="h2" id="routing">
          Routing
        </H>
        <p className="lede">
          When the two anchor points share an axis (both on the same row or
          column), the edge renders as a straight line. Otherwise it
          auto-promotes to a cubic Bézier whose control points are pulled
          along each anchor's outward normal, so the arrow exits each node
          perpendicular to its side. Force a curve explicitly with{" "}
          <code>shape: "curve"</code> and tune it with <code>curvature</code>{" "}
          (0–1).
        </p>
        <div className="example">
          <div className="example-stage" style={{ width: "100%" }}>
            <Diagram cols={2} rows={2} nodes={CURVE_NODES} edges={CURVE_EDGES} />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="tones">
          Tones
        </H>
        <p className="lede">
          Each node accepts a <code>tone</code>: <code>default</code>,{" "}
          <code>primary</code>, <code>secondary</code>, or <code>muted</code>.
          Tones mix the active theme's accent colors into the node fill so they
          stay readable across all four shells. Edges accept a{" "}
          <code>muted</code> flag for background connections.
        </p>
        <div className="example">
          <div className="example-stage" style={{ width: "100%" }}>
            <Diagram cols={2} rows={2} nodes={TONE_NODES} edges={TONE_EDGES} />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="api">
          API
        </H>
        <CodeBlock lang="tsx">{`type DiagramAnchor =
  | \`\${string}.\${"top" | "bottom" | "left" | "right"}\`
  | { node: string; side: "top" | "bottom" | "left" | "right"; offset?: number };

type DiagramNode = {
  id: string;
  row: number;
  col: number;
  title: string;
  items?: ReactNode[];
  tone?: "default" | "primary" | "secondary" | "muted";
  width?: number;   // viewBox units, overrides cell width
  height?: number;  // viewBox units, overrides cell height
};

type DiagramEdge = {
  from: DiagramAnchor;
  to:   DiagramAnchor;
  label?: string;
  labelSide?: "auto" | "above" | "below" | "left" | "right";
  // Pixel override applied on top of labelSide. Use when a label needs to
  // clear an adjacent path or sit beside (not on) a vertical line.
  labelOffset?: { dx?: number; dy?: number };
  shape?: "straight" | "curve";
  curvature?: number;  // 0..1, default 0.4
  muted?: boolean;
};

<Diagram
  cols={number}
  rows={number}
  nodes={DiagramNode[]}
  edges={DiagramEdge[]}
  cellWidth={200}
  cellHeight={90}
  colGap={100}
  rowGap={90}
  padding={40}
  caption={ReactNode}
  ariaLabel={string}
  ariaDescription={string}
/>`}</CodeBlock>
      </div>
    </>
  );
}
