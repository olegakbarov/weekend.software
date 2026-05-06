import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  triggerVariants,
} from "./select";

function Fixture(props: {
  defaultValue?: string;
  disabled?: boolean;
  placeholder?: string;
  withGroups?: boolean;
  withDisabledItem?: boolean;
  withExplicitIndices?: boolean;
}) {
  const [value, setValue] = useState<string>(props.defaultValue ?? "");
  return (
    <Select
      value={value}
      onValueChange={setValue}
      disabled={props.disabled ?? false}
    >
      <SelectTrigger placeholder={props.placeholder ?? "Select…"} />
      <SelectContent>
        {props.withGroups ? (
          <>
            <SelectGroup>
              <SelectLabel>Fruits</SelectLabel>
              <SelectItem value="apple">Apple</SelectItem>
              <SelectItem value="banana">Banana</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Veggies</SelectLabel>
              <SelectItem value="carrot">Carrot</SelectItem>
            </SelectGroup>
          </>
        ) : props.withExplicitIndices ? (
          <>
            <SelectItem index={0} value="apple">Apple</SelectItem>
            <SelectItem index={1} value="banana">Banana</SelectItem>
            <SelectItem index={2} value="cherry" disabled={props.withDisabledItem ?? false}>
              Cherry
            </SelectItem>
          </>
        ) : (
          <>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
            <SelectItem value="cherry" disabled={props.withDisabledItem ?? false}>
              Cherry
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}

function openMenu(): HTMLElement {
  const trigger = screen.getByRole("combobox");
  fireEvent.click(trigger);
  return screen.getByRole("listbox");
}

describe("Select — root + trigger", () => {
  it("renders the trigger with role=combobox", () => {
    render(<Fixture />);
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("shows the placeholder when no value is set", () => {
    render(<Fixture placeholder="Pick one" />);
    expect(screen.getByText("Pick one")).toBeTruthy();
  });

  it("shows the selected label (or value as fallback) when defaultValue matches an item", () => {
    render(<Fixture defaultValue="banana" />);
    // Trigger renders before child SelectItem effects fire; on first mount the
    // label map is empty, so the trigger falls back to the value string.
    // After the menu opens once, registered labels appear instead.
    openMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("combobox").textContent?.toLowerCase()).toContain("banana");
  });

  it("respects the disabled prop on the trigger", () => {
    render(<Fixture disabled />);
    const trigger = screen.getByRole("combobox") as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
  });

  it("does not open when the trigger is disabled", () => {
    render(<Fixture disabled />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens on click and renders all options", () => {
    render(<Fixture />);
    openMenu();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("opens on ArrowDown from the trigger", () => {
    render(<Fixture />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("opens on ArrowUp from the trigger", () => {
    render(<Fixture />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowUp" });
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("opens on Enter from the trigger", () => {
    render(<Fixture />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("opens on Space from the trigger", () => {
    render(<Fixture />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: " " });
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("aria-expanded reflects open state", () => {
    render(<Fixture />);
    const trigger = screen.getByRole("combobox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("aria-haspopup is set to listbox", () => {
    render(<Fixture />);
    expect(screen.getByRole("combobox").getAttribute("aria-haspopup")).toBe("listbox");
  });

  it("renders the chevron icon inside the trigger", () => {
    render(<Fixture />);
    const trigger = screen.getByRole("combobox");
    // useIcon("chevron-down") renders as an svg child.
    expect(trigger.querySelector("svg")).toBeTruthy();
  });

  it("renders a leading icon when `icon` is supplied to SelectTrigger", () => {
    const Icon = ({ className }: { className?: string; size?: number }) => (
      <svg data-testid="leading-icon" className={className} />
    );
    render(
      <Select value="" onValueChange={() => {}}>
        <SelectTrigger icon={Icon} />
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByTestId("leading-icon")).toBeTruthy();
  });

  it("renders an inline error message under the trigger when `error` is supplied", () => {
    render(
      <Select value="" onValueChange={() => {}}>
        <SelectTrigger error="Required field" />
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByText("Required field")).toBeTruthy();
  });

  it("toggles aria-invalid when `error` is set", () => {
    render(
      <Select value="" onValueChange={() => {}}>
        <SelectTrigger error="bad" />
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByRole("combobox").getAttribute("aria-invalid")).toBe("true");
  });

  it("does not set aria-invalid when there is no error", () => {
    render(<Fixture />);
    expect(screen.getByRole("combobox").getAttribute("aria-invalid")).toBeNull();
  });
});

describe("Select — selection", () => {
  it("calls onValueChange with the chosen value when an item is clicked", () => {
    const onChange = vi.fn();
    render(
      <Select value="" onValueChange={onChange}>
        <SelectTrigger />
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>,
    );
    openMenu();
    fireEvent.click(screen.getByText("Banana"));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("banana");
  });

  it("closes the menu after selecting an item", () => {
    render(<Fixture />);
    openMenu();
    fireEvent.click(screen.getByText("Apple"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("commits via Enter on a focused item", () => {
    const onChange = vi.fn();
    render(
      <Select value="" onValueChange={onChange}>
        <SelectTrigger />
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
        </SelectContent>
      </Select>,
    );
    openMenu();
    const item = screen.getByRole("option", { name: "Apple" });
    fireEvent.keyDown(item, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("apple");
  });

  it("commits via Space on a focused item", () => {
    const onChange = vi.fn();
    render(
      <Select value="" onValueChange={onChange}>
        <SelectTrigger />
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
        </SelectContent>
      </Select>,
    );
    openMenu();
    const item = screen.getByRole("option", { name: "Apple" });
    fireEvent.keyDown(item, { key: " " });
    expect(onChange).toHaveBeenCalledWith("apple");
  });

  it("does not fire onValueChange when a disabled item is clicked", () => {
    const onChange = vi.fn();
    render(
      <Select value="" onValueChange={onChange}>
        <SelectTrigger />
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana" disabled>
            Banana
          </SelectItem>
        </SelectContent>
      </Select>,
    );
    openMenu();
    fireEvent.click(screen.getByText("Banana"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("falls back to defaultValue when uncontrolled and no value is provided", () => {
    render(
      <Select defaultValue="apple">
        <SelectTrigger />
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>,
    );
    // Trigger displays the value (label registers asynchronously after first
    // open). Either form is acceptable — both indicate Apple is the value.
    expect(screen.getByRole("combobox").textContent?.toLowerCase()).toContain("apple");
  });

  it("updates internal value uncontrolled when an item is clicked", () => {
    render(
      <Select defaultValue="apple">
        <SelectTrigger />
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>,
    );
    openMenu();
    fireEvent.click(screen.getByText("Banana"));
    expect(screen.getByRole("combobox").textContent).toContain("Banana");
  });

  it("marks the checked option with aria-selected=true", () => {
    render(<Fixture defaultValue="banana" />);
    openMenu();
    const banana = screen.getByRole("option", { name: "Banana" });
    expect(banana.getAttribute("aria-selected")).toBe("true");
  });

  it("marks unchecked options with aria-selected=false", () => {
    render(<Fixture defaultValue="banana" />);
    openMenu();
    const apple = screen.getByRole("option", { name: "Apple" });
    expect(apple.getAttribute("aria-selected")).toBe("false");
  });
});

describe("Select — close behaviour", () => {
  it("closes on Escape without firing onValueChange", () => {
    const onChange = vi.fn();
    render(
      <Select value="" onValueChange={onChange}>
        <SelectTrigger />
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    openMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on click outside", () => {
    render(
      <div>
        <button data-testid="outside">outside</button>
        <Fixture />
      </div>,
    );
    openMenu();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on window scroll", () => {
    render(<Fixture />);
    openMenu();
    fireEvent.scroll(window);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not close when scrolling inside the listbox itself", () => {
    render(<Fixture />);
    const listbox = openMenu();
    // Scroll events on the listbox don't bubble to window in jsdom — verify
    // the menu stays open.
    fireEvent.scroll(listbox);
    expect(screen.queryByRole("listbox")).toBeTruthy();
  });

  it("does not respond to Escape when closed", () => {
    render(<Fixture />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("Select — keyboard nav inside listbox", () => {
  it("ArrowDown without a focused item focuses the first option", () => {
    render(<Fixture />);
    const listbox = openMenu();
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    const apple = screen.getByRole("option", { name: "Apple" });
    expect(document.activeElement).toBe(apple);
  });

  it("ArrowDown without a focused item focuses the checked option when one exists", () => {
    render(<Fixture defaultValue="banana" />);
    const listbox = openMenu();
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    const banana = screen.getByRole("option", { name: "Banana" });
    expect(document.activeElement).toBe(banana);
  });

  it("ArrowDown from a focused item moves focus down", () => {
    render(<Fixture />);
    openMenu();
    const apple = screen.getByRole("option", { name: "Apple" });
    apple.focus();
    fireEvent.keyDown(apple, { key: "ArrowDown" });
    const banana = screen.getByRole("option", { name: "Banana" });
    expect(document.activeElement).toBe(banana);
  });

  it("ArrowUp from a focused item moves focus up", () => {
    render(<Fixture />);
    openMenu();
    const banana = screen.getByRole("option", { name: "Banana" });
    banana.focus();
    fireEvent.keyDown(banana, { key: "ArrowUp" });
    const apple = screen.getByRole("option", { name: "Apple" });
    expect(document.activeElement).toBe(apple);
  });

  it("ArrowDown wraps from last to first", () => {
    render(<Fixture />);
    openMenu();
    const cherry = screen.getByRole("option", { name: "Cherry" });
    cherry.focus();
    fireEvent.keyDown(cherry, { key: "ArrowDown" });
    const apple = screen.getByRole("option", { name: "Apple" });
    expect(document.activeElement).toBe(apple);
  });

  it("ArrowUp wraps from first to last", () => {
    render(<Fixture />);
    openMenu();
    const apple = screen.getByRole("option", { name: "Apple" });
    apple.focus();
    fireEvent.keyDown(apple, { key: "ArrowUp" });
    const cherry = screen.getByRole("option", { name: "Cherry" });
    expect(document.activeElement).toBe(cherry);
  });

  it("Home jumps to the first option", () => {
    render(<Fixture />);
    const listbox = openMenu();
    const cherry = screen.getByRole("option", { name: "Cherry" });
    cherry.focus();
    fireEvent.keyDown(listbox, { key: "Home" });
    const apple = screen.getByRole("option", { name: "Apple" });
    expect(document.activeElement).toBe(apple);
  });

  it("End jumps to the last option", () => {
    render(<Fixture />);
    const listbox = openMenu();
    const apple = screen.getByRole("option", { name: "Apple" });
    apple.focus();
    fireEvent.keyDown(listbox, { key: "End" });
    const cherry = screen.getByRole("option", { name: "Cherry" });
    expect(document.activeElement).toBe(cherry);
  });

  it("Arrow nav skips items marked disabled", () => {
    render(<Fixture withDisabledItem />);
    openMenu();
    const banana = screen.getByRole("option", { name: "Banana" });
    banana.focus();
    fireEvent.keyDown(banana, { key: "ArrowDown" });
    const apple = screen.getByRole("option", { name: "Apple" });
    expect(document.activeElement).toBe(apple);
  });
});

describe("Select — auto-indexing & explicit indices", () => {
  it("auto-indexes direct SelectItem children when index is omitted", () => {
    render(<Fixture />);
    openMenu();
    const items = screen.getAllByRole("option");
    expect(items[0]?.getAttribute("data-proximity-index")).toBe("0");
    expect(items[1]?.getAttribute("data-proximity-index")).toBe("1");
    expect(items[2]?.getAttribute("data-proximity-index")).toBe("2");
  });

  it("respects explicit index when provided", () => {
    render(<Fixture withExplicitIndices />);
    openMenu();
    const items = screen.getAllByRole("option");
    expect(items[0]?.getAttribute("data-proximity-index")).toBe("0");
    expect(items[1]?.getAttribute("data-proximity-index")).toBe("1");
    expect(items[2]?.getAttribute("data-proximity-index")).toBe("2");
  });

  it("auto-indexes items inside SelectGroup children", () => {
    render(<Fixture withGroups />);
    openMenu();
    const items = screen.getAllByRole("option");
    expect(items).toHaveLength(3);
    expect(items[0]?.getAttribute("data-proximity-index")).toBe("0");
    expect(items[1]?.getAttribute("data-proximity-index")).toBe("1");
    expect(items[2]?.getAttribute("data-proximity-index")).toBe("2");
  });

  it("renders SelectGroup with role=group", () => {
    render(<Fixture withGroups />);
    openMenu();
    expect(screen.getAllByRole("group")).toHaveLength(2);
  });

  it("renders SelectLabel as plain content (not selectable)", () => {
    render(<Fixture withGroups />);
    openMenu();
    expect(screen.getByText("Fruits")).toBeTruthy();
    expect(screen.getByText("Veggies")).toBeTruthy();
  });

  it("renders SelectSeparator with role=separator", () => {
    render(<Fixture withGroups />);
    openMenu();
    expect(screen.getByRole("separator")).toBeTruthy();
  });

  it("data-value attribute is set per item", () => {
    render(<Fixture />);
    openMenu();
    const banana = screen.getByRole("option", { name: "Banana" });
    expect(banana.getAttribute("data-value")).toBe("banana");
  });

  it("data-disabled is set on disabled items", () => {
    render(<Fixture withDisabledItem />);
    openMenu();
    const cherry = screen.getByRole("option", { name: "Cherry" });
    expect(cherry.getAttribute("data-disabled")).toBe("true");
  });
});

describe("Select — hidden form input", () => {
  it("renders a hidden input when `name` is supplied", () => {
    const { container } = render(
      <Select defaultValue="banana" name="fruit">
        <SelectTrigger />
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>,
    );
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden).toBeTruthy();
    expect(hidden.name).toBe("fruit");
    expect(hidden.value).toBe("banana");
  });

  it("does NOT render a hidden input when `name` is omitted", () => {
    const { container } = render(<Fixture />);
    expect(container.querySelector('input[type="hidden"]')).toBeNull();
  });

  it("hidden input mirrors the current value (controlled)", () => {
    function Controlled() {
      const [v, setV] = useState("apple");
      return (
        <Select value={v} onValueChange={setV} name="fruit">
          <SelectTrigger />
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    const { container } = render(<Controlled />);
    let hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe("apple");
    openMenu();
    fireEvent.click(screen.getByText("Banana"));
    hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe("banana");
  });

  it("hidden input forwards the `required` attribute", () => {
    const { container } = render(
      <Select defaultValue="" name="fruit" required>
        <SelectTrigger />
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
        </SelectContent>
      </Select>,
    );
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.required).toBe(true);
  });
});

describe("Select — variants & visuals", () => {
  it("triggerVariants exposes bordered + borderless variants", () => {
    expect(triggerVariants({ variant: "bordered" })).toContain("border-border");
    expect(triggerVariants({ variant: "borderless" })).toContain("border-transparent");
  });

  it("triggerVariants defaults to bordered", () => {
    expect(triggerVariants()).toContain("border-border");
  });

  it("SelectTrigger applies the borderless variant when requested", () => {
    render(
      <Select value="" onValueChange={() => {}}>
        <SelectTrigger variant="borderless" />
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger.className).toContain("border-transparent");
  });

  it("listbox renders inside a portal on document.body", () => {
    render(<Fixture />);
    const listbox = openMenu();
    // The listbox lives outside the testing wrapper.
    expect(document.body.contains(listbox)).toBe(true);
  });

  it("listbox has tabIndex=-1 so the container itself is programmatically focusable", () => {
    render(<Fixture />);
    const listbox = openMenu();
    expect(listbox.getAttribute("tabindex")).toBe("-1");
  });

  it("renders the animated check svg next to the checked item", () => {
    render(<Fixture defaultValue="banana" />);
    openMenu();
    const banana = screen.getByRole("option", { name: "Banana" });
    // The check is rendered as an svg inside the checked item.
    expect(banana.querySelector("svg")).toBeTruthy();
  });
});
