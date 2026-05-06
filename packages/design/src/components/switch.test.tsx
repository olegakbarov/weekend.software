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
});
