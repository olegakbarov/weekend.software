import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Select, type SelectItem } from "./select";

const items: ReadonlyArray<SelectItem> = [
  { value: "a", label: "Apple" },
  { value: "b", label: "Banana" },
  { value: "c", label: "Cherry" },
];

describe("Select", () => {
  it("shows the placeholder when no value is set", () => {
    render(<Select value={undefined} onChange={() => {}} items={items} placeholder="Pick one" />);
    expect(screen.getByText("Pick one")).toBeTruthy();
  });

  it("shows the selected label when value matches", () => {
    render(<Select value="b" onChange={() => {}} items={items} />);
    expect(screen.getByText("Banana")).toBeTruthy();
  });

  it("opens on click and renders all options as listbox", () => {
    render(<Select value={undefined} onChange={() => {}} items={items} />);
    fireEvent.click(screen.getByRole("combobox"));
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("calls onChange with the chosen value and closes the menu", () => {
    const onChange = vi.fn();
    render(<Select value={undefined} onChange={onChange} items={items} />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Banana"));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens on ArrowDown and selects highlighted item with Enter", () => {
    const onChange = vi.fn();
    render(<Select value={undefined} onChange={onChange} items={items} />);
    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeTruthy();
    // First Arrow opens at index 0; second moves to index 1
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("closes on Escape without firing onChange", () => {
    const onChange = vi.fn();
    render(<Select value={undefined} onChange={onChange} items={items} />);
    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("respects the disabled prop", () => {
    render(<Select value={undefined} onChange={() => {}} items={items} disabled />);
    const trigger = screen.getByRole("combobox") as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
