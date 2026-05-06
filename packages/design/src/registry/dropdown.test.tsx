import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Star, Mail, Bell, Shield, Settings } from "lucide-react";
import {
  Dropdown,
  DropdownLabel,
  DropdownSeparator,
} from "./dropdown";
import { MenuItem } from "./menu-item";

const ITEMS = [
  { icon: Star, label: "Favorites" },
  { icon: Mail, label: "Email" },
  { icon: Bell, label: "Notifications" },
  { icon: Shield, label: "Privacy" },
  { icon: Settings, label: "Settings" },
];

function Fixture(props: { checkedIndex?: number | null; onSelect?: (i: number) => void }) {
  const [selected, setSelected] = useState<number | null>(
    props.checkedIndex ?? null,
  );
  return (
    <Dropdown {...(selected != null ? { checkedIndex: selected } : {})}>
      {ITEMS.map((item, i) => (
        <MenuItem
          key={item.label}
          index={i}
          icon={item.icon}
          label={item.label}
          checked={selected === i}
          onSelect={() => {
            setSelected((cur) => (cur === i ? null : i));
            props.onSelect?.(i);
          }}
        />
      ))}
    </Dropdown>
  );
}

describe("Dropdown — root", () => {
  it("renders with role=menu", () => {
    render(<Fixture />);
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("renders all menu items as menuitemradio", () => {
    render(<Fixture />);
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(ITEMS.length);
  });

  it("forwards a ref to the container", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <Dropdown ref={ref}>
        <MenuItem index={0} icon={Star} label="Star" />
      </Dropdown>,
    );
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });

  it("merges a className onto the container", () => {
    render(
      <Dropdown className="dropdown-extra">
        <MenuItem index={0} icon={Star} label="Star" />
      </Dropdown>,
    );
    expect(screen.getByRole("menu").className).toContain("dropdown-extra");
  });
});

describe("Dropdown — selection", () => {
  it("calls onSelect with the chosen index when an item is clicked", () => {
    const onSelect = vi.fn();
    render(<Fixture onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Email" }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("commits onSelect via Enter on a focused item", () => {
    const onSelect = vi.fn();
    render(<Fixture onSelect={onSelect} />);
    const item = screen.getByRole("menuitemradio", { name: "Notifications" });
    item.focus();
    fireEvent.keyDown(item, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("commits onSelect via Space on a focused item", () => {
    const onSelect = vi.fn();
    render(<Fixture onSelect={onSelect} />);
    const item = screen.getByRole("menuitemradio", { name: "Privacy" });
    item.focus();
    fireEvent.keyDown(item, { key: " " });
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("reflects the checked item via aria-checked=true", () => {
    render(<Fixture checkedIndex={1} />);
    const items = screen.getAllByRole("menuitemradio");
    expect(items[1]?.getAttribute("aria-checked")).toBe("true");
  });

  it("marks unchecked items with aria-checked=false", () => {
    render(<Fixture checkedIndex={1} />);
    const items = screen.getAllByRole("menuitemradio");
    expect(items[0]?.getAttribute("aria-checked")).toBe("false");
    expect(items[2]?.getAttribute("aria-checked")).toBe("false");
  });
});

describe("Dropdown — keyboard navigation", () => {
  it("ArrowDown moves focus to the next item", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("menuitemradio");
    items[0]?.focus();
    fireEvent.keyDown(items[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
  });

  it("ArrowUp moves focus to the previous item", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("menuitemradio");
    items[2]?.focus();
    fireEvent.keyDown(items[2]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[1]);
  });

  it("ArrowDown wraps from last to first", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("menuitemradio");
    const last = items[items.length - 1]!;
    last.focus();
    fireEvent.keyDown(last, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("ArrowUp wraps from first to last", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("menuitemradio");
    items[0]?.focus();
    fireEvent.keyDown(items[0]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it("Home jumps to the first item", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("menuitemradio");
    items[3]?.focus();
    fireEvent.keyDown(items[3]!, { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("End jumps to the last item", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("menuitemradio");
    items[0]?.focus();
    fireEvent.keyDown(items[0]!, { key: "End" });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it("ArrowRight behaves like ArrowDown", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("menuitemradio");
    items[0]?.focus();
    fireEvent.keyDown(items[0]!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(items[1]);
  });

  it("ArrowLeft behaves like ArrowUp", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("menuitemradio");
    items[1]?.focus();
    fireEvent.keyDown(items[1]!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(items[0]);
  });
});

describe("Dropdown — roving tabindex", () => {
  it("makes the checked item the only tab stop when checkedIndex is set", () => {
    render(<Fixture checkedIndex={2} />);
    const items = screen.getAllByRole("menuitemradio");
    expect(items[2]?.getAttribute("tabindex")).toBe("0");
    expect(items[0]?.getAttribute("tabindex")).toBe("-1");
    expect(items[1]?.getAttribute("tabindex")).toBe("-1");
  });

  it("falls back to the first item being the tab stop when no checkedIndex", () => {
    render(
      <Dropdown>
        <MenuItem index={0} icon={Star} label="A" />
        <MenuItem index={1} icon={Mail} label="B" />
      </Dropdown>,
    );
    const items = screen.getAllByRole("menuitemradio");
    expect(items[0]?.getAttribute("tabindex")).toBe("0");
    expect(items[1]?.getAttribute("tabindex")).toBe("-1");
  });
});

describe("Dropdown — labels & separators", () => {
  it("renders DropdownLabel content", () => {
    render(
      <Dropdown>
        <DropdownLabel>Account</DropdownLabel>
        <MenuItem index={0} icon={Mail} label="Email" />
      </Dropdown>,
    );
    expect(screen.getByText("Account")).toBeTruthy();
  });

  it("renders DropdownSeparator with role=separator", () => {
    render(
      <Dropdown>
        <MenuItem index={0} icon={Mail} label="Email" />
        <DropdownSeparator />
        <MenuItem index={1} icon={Bell} label="Notifications" />
      </Dropdown>,
    );
    expect(screen.getByRole("separator")).toBeTruthy();
  });

  it("merges className into DropdownLabel", () => {
    render(
      <Dropdown>
        <DropdownLabel className="label-extra">Account</DropdownLabel>
        <MenuItem index={0} icon={Mail} label="Email" />
      </Dropdown>,
    );
    expect(screen.getByText("Account").className).toContain("label-extra");
  });

  it("merges className into DropdownSeparator", () => {
    render(
      <Dropdown>
        <MenuItem index={0} icon={Mail} label="Email" />
        <DropdownSeparator className="sep-extra" />
        <MenuItem index={1} icon={Bell} label="Notifications" />
      </Dropdown>,
    );
    expect(screen.getByRole("separator").className).toContain("sep-extra");
  });
});

describe("MenuItem — composition", () => {
  it("annotates each item with data-proximity-index", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("menuitemradio");
    items.forEach((item, i) => {
      expect(item.getAttribute("data-proximity-index")).toBe(String(i));
    });
  });

  it("uses the label as the accessible name", () => {
    render(<Fixture />);
    const item = screen.getByRole("menuitemradio", { name: "Favorites" });
    expect(item).toBeTruthy();
  });

  it("renders the supplied icon", () => {
    render(<Fixture />);
    const items = screen.getAllByRole("menuitemradio");
    // Each item renders its icon as an svg child (lucide outputs svg).
    expect(items[0]?.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("renders the animated check svg next to the checked item only", () => {
    render(<Fixture checkedIndex={0} />);
    const items = screen.getAllByRole("menuitemradio");
    // The icon itself is one svg; checked items get an extra svg for the
    // animated check stroke.
    expect(items[0]!.querySelectorAll("svg").length).toBeGreaterThan(
      items[1]!.querySelectorAll("svg").length,
    );
  });

  it("throws if used outside a Dropdown", () => {
    const original = console.error;
    console.error = () => {};
    try {
      expect(() =>
        render(<MenuItem index={0} icon={Star} label="Orphan" />),
      ).toThrow();
    } finally {
      console.error = original;
    }
  });
});
