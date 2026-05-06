import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  ColorPicker,
  ColorSwatch,
  ColorTile,
  buildParsed,
  parseColor,
} from "./color-picker";

describe("parseColor", () => {
  it("parses 6-digit hex", () => {
    expect(parseColor("#ff0000")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it("parses 3-digit shorthand hex", () => {
    expect(parseColor("#f00")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it("parses 8-digit hex with alpha", () => {
    const out = parseColor("#ff000080")!;
    expect(out.r).toBe(255);
    expect(out.g).toBe(0);
    expect(out.b).toBe(0);
    expect(Math.round(out.a * 255)).toBe(0x80);
  });

  it("parses rgb()", () => {
    expect(parseColor("rgb(10, 20, 30)")).toEqual({ r: 10, g: 20, b: 30, a: 1 });
  });

  it("parses rgba() with alpha", () => {
    const out = parseColor("rgba(10, 20, 30, 0.5)")!;
    expect(out.r).toBe(10);
    expect(out.a).toBeCloseTo(0.5, 3);
  });

  it("parses hsl()", () => {
    const out = parseColor("hsl(0, 100%, 50%)")!;
    expect(Math.round(out.r)).toBe(255);
    expect(Math.round(out.g)).toBe(0);
    expect(Math.round(out.b)).toBe(0);
  });

  it("returns null for invalid input", () => {
    expect(parseColor("not a color")).toBeNull();
    expect(parseColor("")).toBeNull();
  });
});

describe("buildParsed", () => {
  it("round-trips red HSV → hex", () => {
    // h=0, s=1, v=1, a=1 should be pure red
    const parsed = buildParsed(0, 1, 1, 1);
    expect(parsed.hex.toLowerCase()).toBe("#ff0000");
    expect(parsed.r).toBe(255);
    expect(parsed.g).toBe(0);
    expect(parsed.b).toBe(0);
  });

  it("emits rgba string when alpha < 1", () => {
    const parsed = buildParsed(0, 1, 1, 0.5);
    expect(parsed.rgb).toContain("rgba(");
    expect(parsed.rgb).toContain("0.5");
  });

  it("emits oklch string with chroma + hue", () => {
    const parsed = buildParsed(0, 1, 1, 1);
    expect(parsed.oklch).toMatch(/^oklch\(/);
  });

  it("emits hsl with percent", () => {
    const parsed = buildParsed(0, 1, 1, 1);
    expect(parsed.hsl).toMatch(/hsl\(0,\s*100%,\s*50%\)/);
  });
});

describe("ColorPicker", () => {
  it("renders the saturation/brightness application region", () => {
    render(<ColorPicker defaultValue="#ff0000" />);
    expect(screen.getByRole("application", { name: /saturation/i })).toBeTruthy();
  });

  it("renders hue and alpha sliders", () => {
    render(<ColorPicker defaultValue="#ff0000" />);
    const sliders = screen.getAllByRole("slider");
    const labels = sliders.map((s) => s.getAttribute("aria-label"));
    expect(labels).toContain("Hue");
    expect(labels).toContain("Alpha");
  });

  it("calls onValueChange when hue slider is keyboard-stepped", () => {
    const onValueChange = vi.fn();
    render(<ColorPicker defaultValue="#ff0000" onValueChange={onValueChange} />);
    const hue = screen.getAllByRole("slider").find((s) => s.getAttribute("aria-label") === "Hue")!;
    hue.focus();
    fireEvent.keyDown(hue, { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenCalled();
  });

  it("renders the format dropdown trigger labeled HEX by default", () => {
    render(<ColorPicker defaultValue="#ff0000" />);
    expect(screen.getByRole("button", { expanded: false, name: /hex/i })).toBeTruthy();
  });

  it("opens the format dropdown menu and switches format", () => {
    const onFormatChange = vi.fn();
    render(<ColorPicker defaultValue="#ff0000" onFormatChange={onFormatChange} />);
    fireEvent.click(screen.getByRole("button", { name: /hex/i }));
    const rgbItem = screen.getByRole("menuitemradio", { name: /rgb/i });
    fireEvent.click(rgbItem);
    expect(onFormatChange).toHaveBeenCalledWith("rgb");
  });

  it("commits a new value when the hex input is edited and blurred", () => {
    const onValueChange = vi.fn();
    render(<ColorPicker defaultValue="#ff0000" onValueChange={onValueChange} />);
    const hexInput = screen.getByLabelText("Hex value") as HTMLInputElement;
    fireEvent.focus(hexInput);
    fireEvent.change(hexInput, { target: { value: "00ff00" } });
    fireEvent.blur(hexInput);
    // After commit, internal state should have moved to green.
    const lastCall = onValueChange.mock.calls[onValueChange.mock.calls.length - 1];
    expect(lastCall?.[0].toLowerCase()).toBe("#00ff00");
  });

  it("renders swatches and selects one on click", () => {
    const onValueChange = vi.fn();
    render(
      <ColorPicker
        defaultValue="#ff0000"
        onValueChange={onValueChange}
        swatches={["#00ff00", "#0000ff"]}
      />,
    );
    const greenSwatch = screen.getByRole("button", { name: /select color #00ff00/i });
    fireEvent.click(greenSwatch);
    const lastCall = onValueChange.mock.calls[onValueChange.mock.calls.length - 1];
    expect(lastCall?.[0].toLowerCase()).toBe("#00ff00");
  });
});

describe("ColorSwatch", () => {
  it("renders an aria-labeled selectable button", () => {
    const onClick = vi.fn();
    render(<ColorSwatch color="#abcdef" onClick={onClick} />);
    const btn = screen.getByRole("button", { name: /select color #abcdef/i });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });
});

describe("ColorTile", () => {
  it("renders a span with the configured size and the inner color layer", () => {
    const { container } = render(<ColorTile color="#123456" size={32} />);
    const tile = container.querySelector("span") as HTMLElement;
    expect(tile.style.width).toBe("32px");
    expect(tile.style.height).toBe("32px");
    const inner = tile.querySelector("span") as HTMLElement;
    expect(inner.style.backgroundColor).toBeTruthy();
  });
});

describe("EyeDropper integration", () => {
  let originalEyeDropper: unknown;

  beforeEach(() => {
    originalEyeDropper = (window as unknown as Record<string, unknown>).EyeDropper;
  });

  afterEach(() => {
    if (originalEyeDropper === undefined) {
      delete (window as unknown as Record<string, unknown>).EyeDropper;
    } else {
      (window as unknown as Record<string, unknown>).EyeDropper = originalEyeDropper;
    }
  });

  it("does not render the eyedropper button when EyeDropper is unsupported", () => {
    delete (window as unknown as Record<string, unknown>).EyeDropper;
    render(<ColorPicker defaultValue="#ff0000" />);
    expect(screen.queryByRole("button", { name: /pick color from screen/i })).toBeNull();
  });

  it("invokes EyeDropper.open() and applies the picked color", async () => {
    const openSpy = vi.fn(() => Promise.resolve({ sRGBHex: "#00ff00" }));
    class MockEyeDropper {
      open = openSpy;
    }
    (window as unknown as Record<string, unknown>).EyeDropper = MockEyeDropper;

    const onValueChange = vi.fn();
    render(<ColorPicker defaultValue="#ff0000" onValueChange={onValueChange} />);
    const btn = await screen.findByRole("button", { name: /pick color from screen/i });
    fireEvent.click(btn);
    // Wait for the promise microtask
    await Promise.resolve();
    await Promise.resolve();
    expect(openSpy).toHaveBeenCalled();
    const lastCall = onValueChange.mock.calls[onValueChange.mock.calls.length - 1];
    expect(lastCall?.[0].toLowerCase()).toBe("#00ff00");
  });

  it("hides the eyedropper button when hideEyedropper is true", () => {
    class MockEyeDropper {
      open = vi.fn();
    }
    (window as unknown as Record<string, unknown>).EyeDropper = MockEyeDropper;

    render(<ColorPicker defaultValue="#ff0000" hideEyedropper />);
    expect(screen.queryByRole("button", { name: /pick color from screen/i })).toBeNull();
  });
});
