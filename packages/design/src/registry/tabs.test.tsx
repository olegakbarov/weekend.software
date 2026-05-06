import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  TabItem,
  TabPanel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./tabs";

function Fixture(props: { defaultValue?: string; disableSecond?: boolean }) {
  const rootProps = props.defaultValue !== undefined ? { defaultValue: props.defaultValue } : {};
  return (
    <Tabs {...rootProps}>
      <TabsList>
        <TabItem value="overview" label="Overview" />
        <TabItem value="activity" label="Activity" disabled={props.disableSecond ?? false} />
      </TabsList>
      <TabPanel value="overview">overview-panel</TabPanel>
      <TabPanel value="activity">activity-panel</TabPanel>
    </Tabs>
  );
}

function BackCompatFixture() {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">overview-panel</TabsContent>
      <TabsContent value="activity">activity-panel</TabsContent>
    </Tabs>
  );
}

describe("Tabs (compound API)", () => {
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

  it("supports controlled value/onValueChange", () => {
    const calls: string[] = [];
    function Controlled() {
      return (
        <Tabs value="overview" onValueChange={(v) => calls.push(v)}>
          <TabsList>
            <TabItem value="overview" label="Overview" />
            <TabItem value="activity" label="Activity" />
          </TabsList>
          <TabPanel value="overview">overview-panel</TabPanel>
          <TabPanel value="activity">activity-panel</TabPanel>
        </Tabs>
      );
    }
    render(<Controlled />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Activity" }), { button: 0 });
    expect(calls).toEqual(["activity"]);
  });
});

describe("Tabs (back-compat aliases)", () => {
  it("TabsTrigger renders children as label and switches panels", () => {
    render(<BackCompatFixture />);
    expect(screen.getByRole("tab", { name: "Overview" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Activity" })).toBeTruthy();
    expect(screen.getByText("overview-panel")).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Activity" }), { button: 0 });
    expect(screen.getByText("activity-panel")).toBeTruthy();
  });

  it("TabsContent is an alias of TabPanel", () => {
    expect(TabsContent).toBe(TabPanel);
  });
});
