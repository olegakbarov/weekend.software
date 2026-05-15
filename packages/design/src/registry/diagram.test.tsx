import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Diagram, __diagramInternals } from "./diagram";

const { parseAnchor, resolveAnchorPoint, isAxisAligned, buildEdgePath } =
  __diagramInternals;

const sampleNode = {
  id: "a",
  row: 0,
  col: 0,
  title: "Alpha",
  x: 100,
  y: 100,
  w: 200,
  h: 80,
};

describe("Diagram anchor parsing", () => {
  it("parses string anchors with dotted side", () => {
    expect(parseAnchor("shell.right")).toEqual({
      node: "shell",
      side: "right",
      offset: 0,
    });
  });

  it("preserves dots in node ids — only the last dot splits the side", () => {
    expect(parseAnchor("ns.shell.bottom")).toEqual({
      node: "ns.shell",
      side: "bottom",
      offset: 0,
    });
  });

  it("accepts object form with offset", () => {
    expect(parseAnchor({ node: "shell", side: "right", offset: 28 })).toEqual({
      node: "shell",
      side: "right",
      offset: 28,
    });
  });

  it("rejects strings without a side", () => {
    expect(() => parseAnchor("shell" as never)).toThrow(/<nodeId>\.<side>/);
  });
});

describe("Diagram anchor → point resolution", () => {
  it("returns side midpoints by default", () => {
    expect(resolveAnchorPoint(sampleNode, "right", 0)).toMatchObject({
      x: 300,
      y: 140,
      nx: 1,
      ny: 0,
    });
    expect(resolveAnchorPoint(sampleNode, "top", 0)).toMatchObject({
      x: 200,
      y: 100,
      nx: 0,
      ny: -1,
    });
  });

  it("applies positive offsets along the side", () => {
    // right anchor + offset shifts down
    expect(resolveAnchorPoint(sampleNode, "right", 28).y).toBe(168);
    // top anchor + offset shifts right
    expect(resolveAnchorPoint(sampleNode, "top", 28).x).toBe(228);
  });
});

describe("Diagram routing", () => {
  const A = resolveAnchorPoint(sampleNode, "right", 0);
  const Bcolinear = resolveAnchorPoint(
    { ...sampleNode, id: "b", x: 400, y: 100 },
    "left",
    0,
  );
  const Boffset = resolveAnchorPoint(
    { ...sampleNode, id: "b", x: 400, y: 200 },
    "left",
    0,
  );

  it("detects axis-alignment for opposite sides on the same axis", () => {
    expect(isAxisAligned(A, Bcolinear)).toBe(true);
    expect(isAxisAligned(A, Boffset)).toBe(false);
  });

  it("builds straight-line paths for axis-aligned anchors", () => {
    const { d, mid } = buildEdgePath(A, Bcolinear, "straight", 0);
    expect(d).toBe("M300 140 L400 140");
    expect(mid).toEqual({ x: 350, y: 140 });
  });

  it("builds cubic Bézier paths with control points along the normals", () => {
    const { d } = buildEdgePath(A, Boffset, "curve", 0.4);
    // M (start) → C c1 c2 (end). Control points pulled along outward normals.
    expect(d).toMatch(/^M300 140 C/);
    expect(d.endsWith("400 240")).toBe(true);
  });
});

describe("Diagram rendering", () => {
  it("renders all nodes and a labeled edge", () => {
    const { container } = render(
      <Diagram
        cols={2}
        rows={1}
        nodes={[
          { id: "a", row: 0, col: 0, title: "Alpha", items: ["one"] },
          { id: "b", row: 0, col: 1, title: "Beta" },
        ]}
        edges={[{ from: "a.right", to: "b.left", label: "ping" }]}
      />,
    );
    const groups = container.querySelectorAll(".weekend-diagram-node");
    expect(groups.length).toBe(2);
    const titles = container.querySelectorAll(".weekend-diagram-node-title");
    expect([...titles].map((t) => t.textContent)).toEqual(["Alpha", "Beta"]);
    const edgeLabel = container.querySelector(".weekend-diagram-edge text");
    expect(edgeLabel?.textContent).toBe("ping");
  });

  it("places the second of two parallel edges using offset anchors", () => {
    const { container } = render(
      <Diagram
        cols={2}
        rows={1}
        nodes={[
          { id: "a", row: 0, col: 0, title: "A" },
          { id: "b", row: 0, col: 1, title: "B" },
        ]}
        edges={[
          { from: "a.right", to: "b.left", label: "out" },
          {
            from: { node: "b", side: "left", offset: 28 },
            to: { node: "a", side: "right", offset: 28 },
            label: "back",
          },
        ]}
      />,
    );
    const paths = container.querySelectorAll(".weekend-diagram-edge path");
    expect(paths.length).toBe(2);
    // Defaults: cellWidth=200, padding=40, no items → auto height=50, top-aligned
    // so the node's right-anchor center sits at y=40+25=65. The second edge
    // offsets both anchors by 28 → y=93.
    const d0 = paths[0]?.getAttribute("d") ?? "";
    const d1 = paths[1]?.getAttribute("d") ?? "";
    expect(d0).toMatch(/L\d+ 65/);
    expect(d1).toMatch(/L\d+ 93/);
  });

  it("applies the muted edge class and routes to the muted arrow marker", () => {
    const { container } = render(
      <Diagram
        cols={2}
        rows={1}
        nodes={[
          { id: "a", row: 0, col: 0, title: "A" },
          { id: "b", row: 0, col: 1, title: "B" },
        ]}
        edges={[{ from: "a.right", to: "b.left", muted: true }]}
      />,
    );
    const edge = container.querySelector(".weekend-diagram-edge");
    // SVG className is an animated string under DOM types; getAttribute is the
    // portable read.
    expect(edge?.getAttribute("class")).toContain("weekend-diagram-edge--muted");
    const marker = edge
      ?.querySelector("path")
      ?.getAttribute("marker-end");
    expect(marker).toMatch(/-muted\)$/);
  });

  it("uses a wider clearance when a vertical edge's label sits beside the path", () => {
    const { container } = render(
      <Diagram
        cols={1}
        rows={2}
        nodes={[
          { id: "a", row: 0, col: 0, title: "A" },
          { id: "b", row: 1, col: 0, title: "B" },
        ]}
        edges={[
          { from: "a.bottom", to: "b.top", label: "down", labelSide: "left" },
        ]}
      />,
    );
    // Path runs vertically at x=140 (40 + 200/2). Midpoint x is 140.
    // labelSide "left" on a vertical edge applies LABEL_AXIS_CLEARANCE (50),
    // not the horizontal 12 — so the label lands at x=90.
    const text = container.querySelector(".weekend-diagram-edge text");
    expect(text?.getAttribute("x")).toBe("90");
  });

  it("applies labelOffset on top of labelSide", () => {
    const { container } = render(
      <Diagram
        cols={2}
        rows={1}
        nodes={[
          { id: "a", row: 0, col: 0, title: "A" },
          { id: "b", row: 0, col: 1, title: "B" },
        ]}
        edges={[
          {
            from: "a.right",
            to: "b.left",
            label: "shift",
            // Horizontal edge default puts label above midpoint by 12.
            // labelOffset pushes it further out.
            labelOffset: { dx: 10, dy: -8 },
          },
        ]}
      />,
    );
    const text = container.querySelector(".weekend-diagram-edge text");
    // Midpoint x: between 240 (a.right) and 340 (b.left) = 290; +10 dx = 300.
    // Default above offset is 12 below the midpoint y=65 → 53; -8 dy = 45.
    expect(text?.getAttribute("x")).toBe("300");
    expect(text?.getAttribute("y")).toBe("45");
  });

  it("falls back to a curve when anchors are not axis-aligned", () => {
    const { container } = render(
      <Diagram
        cols={2}
        rows={2}
        nodes={[
          { id: "a", row: 0, col: 0, title: "A" },
          { id: "b", row: 1, col: 1, title: "B" },
        ]}
        edges={[{ from: "a.bottom", to: "b.top" }]}
      />,
    );
    const d = container
      .querySelector(".weekend-diagram-edge path")
      ?.getAttribute("d");
    expect(d).toMatch(/^M.* C/);
  });

  it("throws a clear error when an edge references an unknown node", () => {
    expect(() =>
      render(
        <Diagram
          cols={1}
          rows={1}
          nodes={[{ id: "a", row: 0, col: 0, title: "A" }]}
          edges={[{ from: "a.right", to: "ghost.left" }]}
        />,
      ),
    ).toThrow(/unknown node "ghost"/);
  });
});
