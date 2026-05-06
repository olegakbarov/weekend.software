import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Combobox, type ComboboxItem } from "./combobox";

const ITEMS: ReadonlyArray<ComboboxItem> = [
  { value: "claude", label: "Claude" },
  { value: "codex", label: "Codex" },
  { value: "gemini", label: "Gemini" },
];

function ControlledFixture(props: {
  initial?: string;
  onSpy?: (next: string) => void;
  allowFreeText?: boolean;
}) {
  const [value, setValue] = useState(props.initial ?? "");
  return (
    <Combobox
      value={value}
      onChange={(next) => {
        setValue(next);
        props.onSpy?.(next);
      }}
      items={ITEMS}
      placeholder="agent command"
      {...(props.allowFreeText !== undefined
        ? { allowFreeText: props.allowFreeText }
        : {})}
    />
  );
}

describe("Combobox", () => {
  it("renders trigger with placeholder when value is empty", () => {
    render(<ControlledFixture />);
    expect(screen.getByText("agent command")).toBeTruthy();
  });

  it("renders trigger with current value when value is non-empty", () => {
    render(<ControlledFixture initial="claude" />);
    // Trigger displays the matching item label.
    expect(screen.getByRole("combobox").textContent).toContain("Claude");
  });

  it("opens popover on trigger click and shows preset items", () => {
    render(<ControlledFixture />);
    fireEvent.click(screen.getByRole("combobox"));
    // Items render in a Radix portal — testing-library searches the whole document.
    expect(screen.getByRole("option", { name: /Claude/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Codex/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Gemini/ })).toBeTruthy();
  });

  it("typing in the input commits via onChange (free-text default)", () => {
    const spy = vi.fn();
    render(<ControlledFixture onSpy={spy} />);
    fireEvent.click(screen.getByRole("combobox"));
    const input = screen.getByPlaceholderText("agent command") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "custom-agent" } });
    expect(spy).toHaveBeenCalledWith("custom-agent");
  });

  it("clicking an item selects it and closes the popover", () => {
    const spy = vi.fn();
    render(<ControlledFixture onSpy={spy} />);
    fireEvent.click(screen.getByRole("combobox"));
    // The clickable target is the <button> nested inside the <li role="option">.
    const codexOption = screen.getByRole("option", { name: /Codex/ });
    const codexButton = codexOption.querySelector("button") as HTMLButtonElement;
    fireEvent.click(codexButton);
    expect(spy).toHaveBeenCalledWith("codex");
    // Listbox unmounts when popover closes.
    expect(screen.queryByRole("option", { name: /Codex/ })).toBeNull();
  });

  it("renders a Check indicator next to the currently selected item", () => {
    render(<ControlledFixture initial="codex" />);
    fireEvent.click(screen.getByRole("combobox"));
    const checks = screen.getAllByTestId("combobox-check-selected");
    expect(checks.length).toBe(1);
    // The marker lives inside the codex option.
    const codexOption = screen.getByRole("option", { name: /Codex/ });
    expect(codexOption.contains(checks[0]!)).toBe(true);
  });
});
