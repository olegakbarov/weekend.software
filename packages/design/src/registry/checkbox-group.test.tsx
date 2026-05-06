import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { CheckboxGroup, CheckboxItem } from "./checkbox-group";

function Fixture(props: {
  initial?: number[];
  onChange?: (next: Set<number>) => void;
}) {
  const labels = ["Apples", "Bananas", "Cherries", "Dates"];
  const [checked, setChecked] = useState<Set<number>>(
    new Set(props.initial ?? []),
  );

  function toggle(i: number): void {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      props.onChange?.(next);
      return next;
    });
  }

  return (
    <CheckboxGroup checkedIndices={checked}>
      {labels.map((label, i) => (
        <CheckboxItem
          key={label}
          index={i}
          label={label}
          checked={checked.has(i)}
          onToggle={() => toggle(i)}
        />
      ))}
    </CheckboxGroup>
  );
}

describe("CheckboxGroup — rendering & semantics", () => {
  it("renders the group with role=group", () => {
    render(<Fixture />);
    expect(screen.getByRole("group")).toBeTruthy();
  });

  it("renders one item per child with role=checkbox", () => {
    render(<Fixture />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
  });

  it("propagates label as aria-label on each item", () => {
    render(<Fixture />);
    expect(screen.getByRole("checkbox", { name: "Apples" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Cherries" })).toBeTruthy();
  });

  it("reflects checked state via aria-checked", () => {
    render(<Fixture initial={[1]} />);
    const items = screen.getAllByRole("checkbox");
    expect(items[0]?.getAttribute("aria-checked")).toBe("false");
    expect(items[1]?.getAttribute("aria-checked")).toBe("true");
  });

  it("each item exposes its proximity index via data-proximity-index", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("checkbox");
    expect(items[0]?.getAttribute("data-proximity-index")).toBe("0");
    expect(items[3]?.getAttribute("data-proximity-index")).toBe("3");
  });
});

describe("CheckboxGroup — toggling", () => {
  it("toggles an item on click", () => {
    render(<Fixture />);
    const apples = screen.getByRole("checkbox", { name: "Apples" });
    expect(apples.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(apples);
    expect(apples.getAttribute("aria-checked")).toBe("true");
  });

  it("untoggles when clicked twice", () => {
    render(<Fixture initial={[0]} />);
    const apples = screen.getByRole("checkbox", { name: "Apples" });
    expect(apples.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(apples);
    expect(apples.getAttribute("aria-checked")).toBe("false");
  });

  it("toggles via Space key on a focused item", () => {
    render(<Fixture />);
    const apples = screen.getByRole("checkbox", { name: "Apples" });
    apples.focus();
    fireEvent.keyDown(apples, { key: " " });
    expect(apples.getAttribute("aria-checked")).toBe("true");
  });

  it("toggles via Enter key on a focused item", () => {
    render(<Fixture />);
    const bananas = screen.getByRole("checkbox", { name: "Bananas" });
    bananas.focus();
    fireEvent.keyDown(bananas, { key: "Enter" });
    expect(bananas.getAttribute("aria-checked")).toBe("true");
  });

  it("calls the consumer callback exactly once per toggle", () => {
    const onChange = vi.fn();
    render(<Fixture onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Apples" }));
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe("CheckboxGroup — keyboard navigation", () => {
  it("ArrowDown moves focus to the next item", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("checkbox");
    items[0]?.focus();
    fireEvent.keyDown(items[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
  });

  it("ArrowUp moves focus to the previous item", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("checkbox");
    items[2]?.focus();
    fireEvent.keyDown(items[2]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[1]);
  });

  it("ArrowDown wraps from last to first", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("checkbox");
    items[3]?.focus();
    fireEvent.keyDown(items[3]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("Home jumps to the first item", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("checkbox");
    items[3]?.focus();
    fireEvent.keyDown(items[3]!, { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("End jumps to the last item", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("checkbox");
    items[0]?.focus();
    fireEvent.keyDown(items[0]!, { key: "End" });
    expect(document.activeElement).toBe(items[3]);
  });
});

describe("CheckboxGroup — context guard", () => {
  it("throws if CheckboxItem is used without a CheckboxGroup parent", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <CheckboxItem index={0} label="orphan" checked={false} onToggle={() => {}} />,
      ),
    ).toThrow(/CheckboxGroup/);
    spy.mockRestore();
  });
});
