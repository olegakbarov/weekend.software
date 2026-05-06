import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Badge, BADGE_HEX, badgeColors, badgeVariants } from "./badge";

describe("Badge", () => {
  it("renders children inside a span", () => {
    const { container } = render(<Badge>hello</Badge>);
    const span = container.querySelector("span");
    expect(span).toBeTruthy();
    expect(span?.textContent).toBe("hello");
  });

  it("forwards a ref to the underlying span", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Badge ref={ref}>x</Badge>);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it("spreads HTML attributes (id, data-*, aria-label)", () => {
    const { container } = render(
      <Badge id="b1" data-testid="badge" aria-label="status">
        ok
      </Badge>,
    );
    const span = container.querySelector("span#b1") as HTMLSpanElement;
    expect(span).toBeTruthy();
    expect(span.getAttribute("data-testid")).toBe("badge");
    expect(span.getAttribute("aria-label")).toBe("status");
  });

  it("applies upstream size classes (h-5/6/7)", () => {
    const { rerender, container } = render(<Badge size="sm">a</Badge>);
    let span = container.querySelector("span") as HTMLSpanElement;
    expect(span.className).toContain("h-5");

    rerender(<Badge size="md">a</Badge>);
    span = container.querySelector("span") as HTMLSpanElement;
    expect(span.className).toContain("h-6");

    rerender(<Badge size="lg">a</Badge>);
    span = container.querySelector("span") as HTMLSpanElement;
    expect(span.className).toContain("h-7");
  });

  it("uses shape.item for radius (defaults to pill rounded-[20px])", () => {
    const { container } = render(<Badge>r</Badge>);
    const span = container.querySelector("span") as HTMLSpanElement;
    // No ShapeProvider mounted → falls back to "pill" classes.
    expect(span.className).toContain("rounded-[20px]");
    // And NOT the legacy hardcoded `rounded-full`.
    expect(span.className).not.toContain("rounded-full");
  });

  it("solid non-gray colors mix into --background (not --card)", () => {
    const { container } = render(
      <Badge variant="solid" color="blue">
        b
      </Badge>,
    );
    const span = container.querySelector("span") as HTMLSpanElement;
    expect(span.style.backgroundColor).toContain("var(--background)");
    expect(span.style.backgroundColor).not.toContain("var(--card)");
  });

  it("solid gray uses var(--accent) as background", () => {
    const { container } = render(
      <Badge variant="solid" color="gray">
        g
      </Badge>,
    );
    const span = container.querySelector("span") as HTMLSpanElement;
    expect(span.style.backgroundColor).toBe("var(--accent)");
  });

  it("dot variant renders a sized indicator span", () => {
    const { container } = render(
      <Badge variant="dot" size="lg" color="red">
        d
      </Badge>,
    );
    const span = container.querySelector("span") as HTMLSpanElement;
    const dot = span.querySelector("span") as HTMLSpanElement;
    expect(dot).toBeTruthy();
    // lg → 8px
    expect(dot.style.width).toBe("8px");
    expect(dot.style.height).toBe("8px");
    // jsdom normalises hex (#ef4444) to `rgb(239, 68, 68)` — compare by
    // parsing the rgb tuple and matching against the canonical hex.
    expect(dot.style.backgroundColor).toBe("rgb(239, 68, 68)");
    // And reference BADGE_HEX.red so a future change to the table still
    // surfaces here.
    expect(BADGE_HEX.red).toBe("#ef4444");
  });

  it("merges caller-supplied className", () => {
    const { container } = render(<Badge className="custom-x">y</Badge>);
    const span = container.querySelector("span") as HTMLSpanElement;
    expect(span.className).toContain("custom-x");
  });

  it("merges caller-supplied style", () => {
    const { container } = render(
      <Badge style={{ marginTop: "4px" }}>s</Badge>,
    );
    const span = container.querySelector("span") as HTMLSpanElement;
    expect(span.style.marginTop).toBe("4px");
  });

  it("exports badgeColors as an alias of BADGE_HEX", () => {
    expect(badgeColors).toBe(BADGE_HEX);
  });

  it("badgeVariants returns the expected base classes", () => {
    const cls = badgeVariants({ variant: "solid", size: "md" });
    expect(cls).toContain("inline-flex");
    expect(cls).toContain("h-6");
  });
});
