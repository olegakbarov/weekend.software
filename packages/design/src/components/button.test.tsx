import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button, IconButton } from "./button";

describe("Button", () => {
  it("renders children inside a button element", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeTruthy();
  });

  it("applies the variant and size classes", () => {
    const { container } = render(
      <Button variant="primary" size="lg">
        Go
      </Button>,
    );
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("btn");
    expect(btn?.className).toContain("btn-primary");
    expect(btn?.className).toContain("btn-lg");
  });

  it("default variant is primary (upstream parity), default size omits btn-md", () => {
    const { container } = render(<Button>Default</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("btn-primary");
    expect(btn?.className).not.toContain("btn-md");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>X</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        X
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders leading and trailing icons", () => {
    const Lead = (): React.JSX.Element => <svg data-testid="lead" />;
    const Trail = (): React.JSX.Element => <svg data-testid="trail" />;
    render(
      <Button icon={Lead} trailingIcon={Trail}>
        With icons
      </Button>,
    );
    expect(screen.getByTestId("lead")).toBeTruthy();
    expect(screen.getByTestId("trail")).toBeTruthy();
  });

  it("auto-sizes leading/trailing icons via the size prop", () => {
    const sizes: { size: "sm" | "md" | "lg"; expected: number }[] = [
      { size: "sm", expected: 14 },
      { size: "md", expected: 16 },
      { size: "lg", expected: 20 },
    ];
    for (const { size, expected } of sizes) {
      const Lead = vi.fn((props: { size?: number }) => <svg data-size={props.size} />);
      const Trail = vi.fn((props: { size?: number }) => <svg data-size={props.size} />);
      render(
        <Button size={size} icon={Lead} trailingIcon={Trail}>
          {size}
        </Button>,
      );
      expect(Lead).toHaveBeenCalledWith(
        expect.objectContaining({ size: expected, strokeWidth: 1.5 }),
        undefined,
      );
      expect(Trail).toHaveBeenCalledWith(
        expect.objectContaining({ size: expected, strokeWidth: 1.5 }),
        undefined,
      );
    }
  });

  it.each([
    ["secondary", "btn-secondary"],
    ["destructive", "btn-destructive"],
    ["success", "btn-success"],
    ["link", "btn-link"],
  ] as const)("renders the %s variant with the right class", (variant, expected) => {
    const { container } = render(<Button variant={variant}>X</Button>);
    expect(container.querySelector("button")?.className).toContain(expected);
  });

  it("applies btn-xs when size is xs", () => {
    const { container } = render(<Button size="xs">x</Button>);
    expect(container.querySelector("button")?.className).toContain("btn-xs");
  });

  it("renders as the child element when asChild is true", () => {
    const { container } = render(
      <Button asChild variant="primary">
        <a href="/foo" data-testid="link-child">
          Go
        </a>
      </Button>,
    );
    // No <button> rendered.
    expect(container.querySelector("button")).toBeNull();
    const anchor = screen.getByTestId("link-child");
    expect(anchor.tagName).toBe("A");
    expect(anchor.getAttribute("href")).toBe("/foo");
    expect(anchor.className).toContain("btn-primary");
  });

  describe("loading state", () => {
    it("renders a spinner overlay when loading", () => {
      const { container } = render(<Button loading>Saving</Button>);
      expect(container.querySelector(".btn-spinner")).not.toBeNull();
    });

    it("disables the button while loading", () => {
      const { container } = render(<Button loading>Saving</Button>);
      const btn = container.querySelector("button");
      expect(btn?.hasAttribute("disabled")).toBe(true);
      expect(btn?.getAttribute("aria-busy")).toBe("true");
    });

    it("does not call onClick while loading", () => {
      const onClick = vi.fn();
      render(
        <Button onClick={onClick} loading>
          Saving
        </Button>,
      );
      fireEvent.click(screen.getByRole("button"));
      expect(onClick).not.toHaveBeenCalled();
    });

    it("keeps original content as an invisible ghost for layout stability", () => {
      const Lead = (): React.JSX.Element => <svg data-testid="lead" />;
      const { container } = render(
        <Button loading icon={Lead}>
          Saving
        </Button>,
      );
      const ghost = container.querySelector(".btn-loading-ghost");
      expect(ghost).not.toBeNull();
      expect(ghost?.textContent).toContain("Saving");
      // Ghost should be aria-hidden so screen readers ignore it.
      expect(ghost?.getAttribute("aria-hidden")).toBe("true");
    });

    it("does not set aria-busy when not loading", () => {
      const { container } = render(<Button>Idle</Button>);
      expect(container.querySelector("button")?.hasAttribute("aria-busy")).toBe(false);
    });
  });
});

describe("IconButton", () => {
  it("uses label as aria-label and title", () => {
    const Icon = (): React.JSX.Element => <svg data-testid="ic" />;
    render(<IconButton icon={Icon} label="Save" />);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.getAttribute("title")).toBe("Save");
    expect(screen.getByTestId("ic")).toBeTruthy();
  });

  it("defaults to size md (btn-icon-md)", () => {
    const Icon = (): React.JSX.Element => <svg />;
    const { container } = render(<IconButton icon={Icon} label="Save" />);
    expect(container.querySelector("button")?.className).toContain("btn-icon-md");
  });

  it.each(["xs", "sm", "md", "lg"] as const)("applies btn-icon-%s for size=%s", (size) => {
    const Icon = (): React.JSX.Element => <svg />;
    const { container } = render(<IconButton icon={Icon} label="Save" size={size} />);
    expect(container.querySelector("button")?.className).toContain(`btn-icon-${size}`);
  });
});
