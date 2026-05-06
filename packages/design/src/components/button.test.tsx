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

  it("default variant is tertiary, default size omits btn-md", () => {
    const { container } = render(<Button>Default</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("btn-tertiary");
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
});

describe("IconButton", () => {
  it("uses label as aria-label and title", () => {
    const Icon = (): React.JSX.Element => <svg data-testid="ic" />;
    render(<IconButton icon={Icon} label="Save" />);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.getAttribute("title")).toBe("Save");
    expect(screen.getByTestId("ic")).toBeTruthy();
  });
});
