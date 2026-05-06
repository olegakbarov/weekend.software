import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function Fixture(props: { defaultValue?: string; disableSecond?: boolean }) {
  const rootProps = props.defaultValue !== undefined ? { defaultValue: props.defaultValue } : {};
  return (
    <Tabs {...rootProps}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="activity" disabled={props.disableSecond ?? false}>
          Activity
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview">overview-panel</TabsContent>
      <TabsContent value="activity">activity-panel</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("renders triggers and shows the default value's content", () => {
    render(<Fixture defaultValue="overview" />);
    expect(screen.getByRole("tab", { name: "Overview" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Activity" })).toBeTruthy();
    expect(screen.getByText("overview-panel")).toBeTruthy();
    expect(screen.queryByText("activity-panel")).toBeNull();
  });

  it("switches the visible panel when another trigger is clicked", () => {
    render(<Fixture defaultValue="overview" />);
    // Radix Tabs activates on mousedown (button 0), not click.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Activity" }), { button: 0 });
    expect(screen.getByText("activity-panel")).toBeTruthy();
    expect(screen.queryByText("overview-panel")).toBeNull();
  });

  it("renders no panel when neither defaultValue nor value is set", () => {
    render(<Fixture />);
    expect(screen.queryByText("overview-panel")).toBeNull();
    expect(screen.queryByText("activity-panel")).toBeNull();
  });

  it("does not switch when a disabled trigger is clicked", () => {
    render(<Fixture defaultValue="overview" disableSecond />);
    const disabled = screen.getByRole("tab", { name: "Activity" }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true);
    fireEvent.mouseDown(disabled, { button: 0 });
    expect(screen.getByText("overview-panel")).toBeTruthy();
    expect(screen.queryByText("activity-panel")).toBeNull();
  });
});
