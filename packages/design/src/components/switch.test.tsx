import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Switch } from "./switch";

describe("Switch", () => {
  it("renders with role switch and aria-checked", () => {
    render(<Switch checked={false} onChange={() => {}} ariaLabel="Toggle" />);
    const sw = screen.getByRole("switch");
    expect(sw.getAttribute("aria-checked")).toBe("false");
  });

  it("toggles on click", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} ariaLabel="Toggle" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with the inverted value", () => {
    const onChange = vi.fn();
    render(<Switch checked={true} onChange={onChange} ariaLabel="Toggle" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not call onChange when disabled", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} disabled ariaLabel="Toggle" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reflects checked via data-on", () => {
    const { rerender } = render(
      <Switch checked={false} onChange={() => {}} ariaLabel="Toggle" />,
    );
    expect(screen.getByRole("switch").getAttribute("data-on")).toBeNull();
    rerender(<Switch checked={true} onChange={() => {}} ariaLabel="Toggle" />);
    expect(screen.getByRole("switch").getAttribute("data-on")).toBe("true");
  });

  it("renders an internal thumb element", () => {
    const { container } = render(
      <Switch checked={false} onChange={() => {}} ariaLabel="Toggle" />,
    );
    expect(container.querySelector(".ds-switch-thumb")).not.toBeNull();
  });

  it("sets data-hover when the mouse pointer enters", () => {
    render(<Switch checked={false} onChange={() => {}} ariaLabel="Toggle" />);
    const sw = screen.getByRole("switch");
    fireEvent.pointerEnter(sw, { pointerType: "mouse" });
    expect(sw.getAttribute("data-hover")).toBe("true");
    fireEvent.pointerLeave(sw);
    expect(sw.getAttribute("data-hover")).toBeNull();
  });

  it("ignores pointerEnter from non-mouse pointer types (no sticky hover on touch)", () => {
    render(<Switch checked={false} onChange={() => {}} ariaLabel="Toggle" />);
    const sw = screen.getByRole("switch");
    fireEvent.pointerEnter(sw, { pointerType: "touch" });
    expect(sw.getAttribute("data-hover")).toBeNull();
  });

  it("toggles on (to true) when dragged past the midpoint from off", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} ariaLabel="Toggle" />);
    const sw = screen.getByRole("switch");
    fireEvent.pointerDown(sw, { pointerType: "mouse", button: 0, clientX: 5, pointerId: 1 });
    // Drag well past midpoint (track ~34px wide)
    fireEvent.pointerMove(sw, { clientX: 35, pointerId: 1 });
    fireEvent.pointerUp(sw, { clientX: 35, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles off (to false) when dragged past the midpoint from on", () => {
    const onChange = vi.fn();
    render(<Switch checked={true} onChange={onChange} ariaLabel="Toggle" />);
    const sw = screen.getByRole("switch");
    fireEvent.pointerDown(sw, { pointerType: "mouse", button: 0, clientX: 30, pointerId: 1 });
    fireEvent.pointerMove(sw, { clientX: 0, pointerId: 1 });
    fireEvent.pointerUp(sw, { clientX: 0, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not toggle on click when a drag was just completed", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} ariaLabel="Toggle" />);
    const sw = screen.getByRole("switch");
    fireEvent.pointerDown(sw, { pointerType: "mouse", button: 0, clientX: 5, pointerId: 1 });
    fireEvent.pointerMove(sw, { clientX: 35, pointerId: 1 });
    fireEvent.pointerUp(sw, { clientX: 35, pointerId: 1 });
    // Synthetic click that follows a drag should be suppressed.
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("treats movements smaller than the dead-zone as a click, not a drag", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} ariaLabel="Toggle" />);
    const sw = screen.getByRole("switch");
    fireEvent.pointerDown(sw, { pointerType: "mouse", button: 0, clientX: 5, pointerId: 1 });
    fireEvent.pointerMove(sw, { clientX: 6, pointerId: 1 }); // 1px < DRAG_DEAD_ZONE
    fireEvent.pointerUp(sw, { clientX: 6, pointerId: 1 });
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("ignores non-primary mouse buttons", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} ariaLabel="Toggle" />);
    const sw = screen.getByRole("switch");
    fireEvent.pointerDown(sw, { pointerType: "mouse", button: 2, clientX: 5, pointerId: 1 });
    fireEvent.pointerMove(sw, { clientX: 35, pointerId: 1 });
    fireEvent.pointerUp(sw, { clientX: 35, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
