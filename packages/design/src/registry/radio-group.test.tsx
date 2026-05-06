import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { RadioGroup, RadioItem } from "./radio-group";

function IndexFixture(props: { initial?: number }) {
  const options = ["Option A", "Option B", "Option C"];
  const [selected, setSelected] = useState<number>(props.initial ?? 0);
  return (
    <RadioGroup selectedIndex={selected}>
      {options.map((label, i) => (
        <RadioItem
          key={label}
          index={i}
          label={label}
          selected={selected === i}
          onSelect={() => setSelected(i)}
        />
      ))}
    </RadioGroup>
  );
}

function ValueFixture(props: { initial?: string; onChange?: (v: string) => void }) {
  const options = ["alpha", "beta", "gamma"];
  const [value, setValue] = useState<string>(props.initial ?? "alpha");
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => {
        setValue(v);
        props.onChange?.(v);
      }}
    >
      {options.map((v, i) => (
        <RadioItem key={v} index={i} label={v} value={v} />
      ))}
    </RadioGroup>
  );
}

describe("RadioGroup — rendering & semantics", () => {
  it("renders the container with role=radiogroup", () => {
    render(<IndexFixture />);
    expect(screen.getByRole("radiogroup")).toBeTruthy();
  });

  it("renders one item per child with role=radio", () => {
    render(<IndexFixture />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("propagates label as aria-label on each item", () => {
    render(<IndexFixture />);
    expect(screen.getByRole("radio", { name: "Option A" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Option C" })).toBeTruthy();
  });

  it("each item exposes its proximity index via data-proximity-index", () => {
    render(<IndexFixture />);
    const items = screen.getAllByRole("radio");
    expect(items[0]?.getAttribute("data-proximity-index")).toBe("0");
    expect(items[2]?.getAttribute("data-proximity-index")).toBe("2");
  });
});

describe("RadioGroup — index-based selection", () => {
  it("marks the initially selected item with aria-checked=true", () => {
    render(<IndexFixture initial={1} />);
    const items = screen.getAllByRole("radio");
    expect(items[0]?.getAttribute("aria-checked")).toBe("false");
    expect(items[1]?.getAttribute("aria-checked")).toBe("true");
  });

  it("selecting an item updates aria-checked", () => {
    render(<IndexFixture initial={0} />);
    fireEvent.click(screen.getByRole("radio", { name: "Option C" }));
    expect(
      screen.getByRole("radio", { name: "Option C" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByRole("radio", { name: "Option A" }).getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("selects via Space on a focused item", () => {
    render(<IndexFixture initial={0} />);
    const second = screen.getByRole("radio", { name: "Option B" });
    second.focus();
    fireEvent.keyDown(second, { key: " " });
    expect(second.getAttribute("aria-checked")).toBe("true");
  });

  it("selects via Enter on a focused item", () => {
    render(<IndexFixture initial={0} />);
    const second = screen.getByRole("radio", { name: "Option B" });
    second.focus();
    fireEvent.keyDown(second, { key: "Enter" });
    expect(second.getAttribute("aria-checked")).toBe("true");
  });

  it("only the selected item has tabIndex=0 (roving tabindex)", () => {
    render(<IndexFixture initial={1} />);
    const items = screen.getAllByRole("radio");
    expect(items[0]?.tabIndex).toBe(-1);
    expect(items[1]?.tabIndex).toBe(0);
    expect(items[2]?.tabIndex).toBe(-1);
  });
});

describe("RadioGroup — value-based selection", () => {
  it("marks the item whose `value` matches as aria-checked=true", () => {
    render(<ValueFixture initial="beta" />);
    expect(screen.getByRole("radio", { name: "beta" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("calls onValueChange with the chosen value when an item is clicked", () => {
    const onChange = vi.fn();
    render(<ValueFixture initial="alpha" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "gamma" }));
    expect(onChange).toHaveBeenCalledWith("gamma");
  });

  it("data-value attribute is set per item", () => {
    render(<ValueFixture />);
    expect(
      screen.getByRole("radio", { name: "beta" }).getAttribute("data-value"),
    ).toBe("beta");
  });
});

describe("RadioGroup — keyboard navigation", () => {
  it("ArrowDown moves focus to the next item and selects it", () => {
    render(<IndexFixture initial={0} />);
    const items = screen.getAllByRole("radio");
    items[0]?.focus();
    fireEvent.keyDown(items[0]!, { key: "ArrowDown" });
    expect(items[1]?.getAttribute("aria-checked")).toBe("true");
  });

  it("ArrowUp wraps from first to last and selects it", () => {
    render(<IndexFixture initial={0} />);
    const items = screen.getAllByRole("radio");
    items[0]?.focus();
    fireEvent.keyDown(items[0]!, { key: "ArrowUp" });
    expect(items[2]?.getAttribute("aria-checked")).toBe("true");
  });

  it("ArrowRight moves selection forward (alias of ArrowDown)", () => {
    render(<IndexFixture initial={0} />);
    const items = screen.getAllByRole("radio");
    items[0]?.focus();
    fireEvent.keyDown(items[0]!, { key: "ArrowRight" });
    expect(items[1]?.getAttribute("aria-checked")).toBe("true");
  });

  it("Home selects the first item", () => {
    render(<IndexFixture initial={2} />);
    const items = screen.getAllByRole("radio");
    items[2]?.focus();
    fireEvent.keyDown(items[2]!, { key: "Home" });
    expect(items[0]?.getAttribute("aria-checked")).toBe("true");
  });

  it("End selects the last item", () => {
    render(<IndexFixture initial={0} />);
    const items = screen.getAllByRole("radio");
    items[0]?.focus();
    fireEvent.keyDown(items[0]!, { key: "End" });
    expect(items[2]?.getAttribute("aria-checked")).toBe("true");
  });
});

describe("RadioGroup — context guard", () => {
  it("throws if RadioItem is used without a RadioGroup parent", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<RadioItem index={0} label="orphan" />)).toThrow(
      /RadioGroup/,
    );
    spy.mockRestore();
  });
});
