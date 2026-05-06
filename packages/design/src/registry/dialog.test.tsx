import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

function Fixture(props: { open?: boolean; size?: "sm" | "lg" }) {
  const sizeProps = props.size !== undefined ? { size: props.size } : {};
  // Use controlled open so the wrapper's uncontrolled state doesn't override.
  const rootProps = props.open !== undefined ? { open: props.open } : {};
  return (
    <Dialog {...rootProps}>
      <DialogTrigger>open me</DialogTrigger>
      <DialogContent {...sizeProps}>
        <DialogHeader>
          <DialogTitle>Hello world</DialogTitle>
          <DialogDescription>describe me</DialogDescription>
        </DialogHeader>
        <p>body content</p>
        <DialogFooter>
          <button type="button">Cancel</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("does not render content when closed", () => {
    render(<Fixture />);
    expect(screen.queryByText("Hello world")).toBeNull();
    expect(screen.queryByText("body content")).toBeNull();
  });

  it("renders title, description, and body when open=true", () => {
    render(<Fixture open />);
    expect(screen.getByText("Hello world")).toBeTruthy();
    expect(screen.getByText("describe me")).toBeTruthy();
    expect(screen.getByText("body content")).toBeTruthy();
  });

  it("opens when the trigger is clicked", () => {
    render(<Fixture />);
    fireEvent.click(screen.getByText("open me"));
    expect(screen.getByText("Hello world")).toBeTruthy();
  });

  it("renders the canonical close affordance via the design-system Button", () => {
    render(<Fixture open />);
    const closeBtn = screen.getByRole("button", { name: "Close" });
    // Goes through the design-system Button (.btn / .btn-ghost), not raw Tailwind.
    expect(closeBtn.className).toContain("btn");
    expect(closeBtn.className).toContain("btn-ghost");
    // Position + square shape preserved.
    expect(closeBtn.className).toContain("absolute");
    expect(closeBtn.className).toContain("w-7");
    expect(closeBtn.className).toContain("h-7");
  });

  it("close affordance carries the sr-only Close label", () => {
    render(<Fixture open />);
    const closeBtn = screen.getByRole("button", { name: "Close" });
    const sr = closeBtn.querySelector(".sr-only");
    expect(sr?.textContent).toBe("Close");
  });

  it("DialogTitle applies the upstream font-variation cosmetic style", () => {
    render(<Fixture open />);
    const title = screen.getByText("Hello world");
    // jsdom normalizes the inline style — assert via the style attribute.
    const styleAttr = title.getAttribute("style") ?? "";
    expect(styleAttr).toContain("font-variation-settings");
    expect(styleAttr).toContain("wght");
    expect(styleAttr).toContain("700");
  });

  it("DialogTitle merges custom className with built-in classes", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle className="custom-title">T</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const title = screen.getByText("T");
    expect(title.className).toContain("custom-title");
    expect(title.className).toContain("text-foreground");
  });

  it("DialogDescription merges custom className with built-in classes", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>T</DialogTitle>
          <DialogDescription className="custom-desc">D</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const desc = screen.getByText("D");
    expect(desc.className).toContain("custom-desc");
    expect(desc.className).toContain("text-muted-foreground");
  });

  it("DialogHeader and DialogFooter apply layout classes", () => {
    // Dialog renders into a portal — query baseElement, not container.
    const { baseElement } = render(<Fixture open />);
    const header = baseElement.querySelector(".flex.flex-col");
    const footer = baseElement.querySelector(".flex.justify-end");
    expect(header).not.toBeNull();
    expect(footer).not.toBeNull();
  });

  it("applies the small size max-width by default", () => {
    const { baseElement } = render(<Fixture open />);
    const card = baseElement.querySelector(".bg-card");
    expect(card?.className).toContain("max-w-[400px]");
    expect(card?.className).not.toContain("max-w-[540px]");
  });

  it("applies the large size max-width when size=lg", () => {
    const { baseElement } = render(<Fixture open size="lg" />);
    const card = baseElement.querySelector(".bg-card");
    expect(card?.className).toContain("max-w-[540px]");
    expect(card?.className).not.toContain("max-w-[400px]");
  });
});
