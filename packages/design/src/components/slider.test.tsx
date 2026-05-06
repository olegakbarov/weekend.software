import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Slider, SliderComfortable } from "./slider";

function ControlledSlider(props: {
  initial?: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showSteps?: boolean;
  format?: (v: number) => string;
  formatValue?: (v: number) => string;
  disabled?: boolean;
}) {
  const [v, setV] = useState(props.initial ?? 50);
  // Only forward explicitly-provided keys to Slider so that
  // exactOptionalPropertyTypes doesn't complain.
  const sliderProps: Record<string, unknown> = {
    value: v,
    onChange: (nv: unknown) => setV(nv as number),
    min: props.min ?? 0,
    max: props.max ?? 100,
    step: props.step ?? 1,
  };
  if (props.label !== undefined) sliderProps["label"] = props.label;
  if (props.showSteps !== undefined) sliderProps["showSteps"] = props.showSteps;
  if (props.format !== undefined) sliderProps["format"] = props.format;
  if (props.formatValue !== undefined)
    sliderProps["formatValue"] = props.formatValue;
  if (props.disabled !== undefined) sliderProps["disabled"] = props.disabled;
  return (
    <Slider
      {...(sliderProps as unknown as React.ComponentProps<typeof Slider>)}
    />
  );
}

function ControlledRange(props: {
  initial?: [number, number];
  min?: number;
  max?: number;
  step?: number;
}) {
  const [v, setV] = useState<[number, number]>(props.initial ?? [20, 80]);
  return (
    <Slider
      value={v}
      onChange={(nv) => setV(nv as [number, number])}
      min={props.min ?? 0}
      max={props.max ?? 100}
      step={props.step ?? 1}
    />
  );
}

describe("Slider — ARIA + a11y", () => {
  it("renders a slider role with min/max/now via Radix", () => {
    render(<ControlledSlider initial={40} />);
    const sliders = screen.getAllByRole("slider");
    expect(sliders.length).toBeGreaterThan(0);
    const s = sliders[0]!;
    expect(s.getAttribute("aria-valuemin")).toBe("0");
    expect(s.getAttribute("aria-valuemax")).toBe("100");
    expect(s.getAttribute("aria-valuenow")).toBe("40");
  });

  it("forwards `label` as aria-label on the slider thumb", () => {
    render(<ControlledSlider initial={10} label="Volume" />);
    const thumb = screen.getAllByRole("slider")[0]!;
    expect(thumb.getAttribute("aria-label")).toBe("Volume");
  });

  it("renders two slider roles when value is a tuple (range)", () => {
    render(<ControlledRange initial={[10, 90]} />);
    const sliders = screen.getAllByRole("slider");
    expect(sliders.length).toBe(2);
    expect(sliders[0]!.getAttribute("aria-valuenow")).toBe("10");
    expect(sliders[1]!.getAttribute("aria-valuenow")).toBe("90");
  });

  it("respects disabled — slider thumb is disabled", () => {
    render(<ControlledSlider initial={50} disabled />);
    const s = screen.getAllByRole("slider")[0]!;
    // Radix marks disabled via data-disabled and aria-disabled
    expect(s.getAttribute("data-disabled") !== null || s.getAttribute("aria-disabled") === "true").toBe(true);
  });
});

describe("Slider — keyboard accessibility", () => {
  function renderAndFocus(initial = 40) {
    const utils = render(<ControlledSlider initial={initial} step={1} />);
    const thumb = screen.getAllByRole("slider")[0]!;
    thumb.focus();
    return { ...utils, thumb };
  }

  it("ArrowRight increments by step", async () => {
    const { thumb } = renderAndFocus(40);
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    await waitFor(() => {
      expect(thumb.getAttribute("aria-valuenow")).toBe("41");
    });
  });

  it("ArrowUp increments by step", async () => {
    const { thumb } = renderAndFocus(40);
    fireEvent.keyDown(thumb, { key: "ArrowUp" });
    await waitFor(() => {
      expect(thumb.getAttribute("aria-valuenow")).toBe("41");
    });
  });

  it("ArrowLeft decrements by step", async () => {
    const { thumb } = renderAndFocus(40);
    fireEvent.keyDown(thumb, { key: "ArrowLeft" });
    await waitFor(() => {
      expect(thumb.getAttribute("aria-valuenow")).toBe("39");
    });
  });

  it("ArrowDown decrements by step", async () => {
    const { thumb } = renderAndFocus(40);
    fireEvent.keyDown(thumb, { key: "ArrowDown" });
    await waitFor(() => {
      expect(thumb.getAttribute("aria-valuenow")).toBe("39");
    });
  });

  it("Home jumps to min", async () => {
    const { thumb } = renderAndFocus(40);
    fireEvent.keyDown(thumb, { key: "Home" });
    await waitFor(() => {
      expect(thumb.getAttribute("aria-valuenow")).toBe("0");
    });
  });

  it("End jumps to max", async () => {
    const { thumb } = renderAndFocus(40);
    fireEvent.keyDown(thumb, { key: "End" });
    await waitFor(() => {
      expect(thumb.getAttribute("aria-valuenow")).toBe("100");
    });
  });

  it("PageUp increments by larger step", async () => {
    const { thumb } = renderAndFocus(40);
    fireEvent.keyDown(thumb, { key: "PageUp" });
    await waitFor(() => {
      const v = parseInt(thumb.getAttribute("aria-valuenow") ?? "0", 10);
      expect(v).toBeGreaterThan(40);
    });
  });

  it("PageDown decrements by larger step", async () => {
    const { thumb } = renderAndFocus(40);
    fireEvent.keyDown(thumb, { key: "PageDown" });
    await waitFor(() => {
      const v = parseInt(thumb.getAttribute("aria-valuenow") ?? "0", 10);
      expect(v).toBeLessThan(40);
    });
  });

  it("does not change on arrow keys when disabled", async () => {
    const onChange = vi.fn();
    render(
      <Slider value={40} onChange={onChange} min={0} max={100} disabled />,
    );
    const thumb = screen.getAllByRole("slider")[0]!;
    thumb.focus();
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    fireEvent.keyDown(thumb, { key: "Home" });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Slider — snapping with non-zero min (regression)", () => {
  // The placeholder slider had `Math.round(raw / step) * step` which is wrong
  // for non-zero min. The upstream port uses `round((raw - min) / step) * step + min`.
  it("respects step grid when min is non-zero", async () => {
    let lastVal = 14;
    const onChange = vi.fn((v: unknown) => {
      lastVal = v as number;
    });
    render(
      <Slider
        value={lastVal}
        onChange={onChange}
        min={10}
        max={100}
        step={5}
      />,
    );
    const thumb = screen.getAllByRole("slider")[0]!;
    thumb.focus();
    // Step from 14: ArrowRight should land on the next grid point (15 or 20),
    // never an off-grid value relative to (min, step).
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
    const v = onChange.mock.calls[0]![0] as number;
    // Must lie on the (min, step) grid: (v - 10) % 5 === 0
    expect((v - 10) % 5).toBe(0);
  });

  it("clamps Home/End within [min, max]", async () => {
    const onChange = vi.fn();
    render(
      <Slider
        value={50}
        onChange={onChange}
        min={10}
        max={90}
        step={5}
      />,
    );
    const thumb = screen.getAllByRole("slider")[0]!;
    thumb.focus();
    fireEvent.keyDown(thumb, { key: "Home" });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(10);
    });
    fireEvent.keyDown(thumb, { key: "End" });
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(90);
    });
  });
});

describe("Slider — formatting (legacy `format` + upstream `formatValue`)", () => {
  it("renders the raw value when no formatter is supplied", () => {
    render(<ControlledSlider initial={42} />);
    // The visible value should appear somewhere in the rendered DOM.
    expect(screen.getAllByText(/42/).length).toBeGreaterThan(0);
  });

  it("supports the legacy `format` prop alias", () => {
    render(
      <ControlledSlider initial={70} format={(v) => `${v}%`} />,
    );
    expect(screen.getAllByText("70%").length).toBeGreaterThan(0);
  });

  it("supports the upstream `formatValue` prop", () => {
    render(
      <ControlledSlider initial={70} formatValue={(v) => `${v}/min`} />,
    );
    expect(screen.getAllByText("70/min").length).toBeGreaterThan(0);
  });
});

describe("Slider — click to edit value", () => {
  it("clicking the value text reveals an editable input", async () => {
    render(<ControlledSlider initial={42} />);
    // Click the visible value (first .ds-slider-value-text node).
    const valueText = document.querySelector<HTMLSpanElement>(
      ".ds-slider-value-text",
    );
    expect(valueText).not.toBeNull();
    fireEvent.click(valueText!);
    await waitFor(() => {
      const input = document.querySelector<HTMLInputElement>(
        ".ds-slider-value-input",
      );
      expect(input).not.toBeNull();
    });
  });

  it("commits a typed value on Enter", async () => {
    let last = 42;
    const onChange = vi.fn((v: unknown) => {
      last = v as number;
    });
    render(
      <Slider
        value={last}
        onChange={onChange}
        min={0}
        max={100}
        step={1}
      />,
    );
    const valueText = document.querySelector<HTMLSpanElement>(
      ".ds-slider-value-text",
    )!;
    fireEvent.click(valueText);
    const input = await waitFor(() => {
      const i = document.querySelector<HTMLInputElement>(
        ".ds-slider-value-input",
      );
      expect(i).not.toBeNull();
      return i!;
    });
    fireEvent.change(input, { target: { value: "73" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(73);
    });
  });

  it("cancels edit on Escape without firing onChange", async () => {
    const onChange = vi.fn();
    render(
      <Slider value={42} onChange={onChange} min={0} max={100} step={1} />,
    );
    const valueText = document.querySelector<HTMLSpanElement>(
      ".ds-slider-value-text",
    )!;
    fireEvent.click(valueText);
    const input = await waitFor(() => {
      const i = document.querySelector<HTMLInputElement>(
        ".ds-slider-value-input",
      );
      expect(i).not.toBeNull();
      return i!;
    });
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Slider — step dots", () => {
  it("does not render step dots by default", () => {
    const { container } = render(<ControlledSlider initial={50} step={10} />);
    expect(container.querySelectorAll(".ds-slider-dot").length).toBe(0);
  });

  it("renders step dots when showSteps is enabled", () => {
    const { container } = render(
      <ControlledSlider initial={50} step={10} showSteps />,
    );
    // (max - min) / step + 1 dots → (100 - 0) / 10 + 1 = 11
    expect(container.querySelectorAll(".ds-slider-dot").length).toBe(11);
  });
});

describe("Slider — range crossing prevention", () => {
  it("does not let the start thumb move past the end thumb via keyboard", async () => {
    let last: [number, number] = [40, 50];
    const onChange = vi.fn((v: unknown) => {
      last = v as [number, number];
    });
    render(
      <Slider
        value={last}
        onChange={onChange}
        min={0}
        max={100}
        step={1}
      />,
    );
    const sliders = screen.getAllByRole("slider");
    const startThumb = sliders[0]!;
    startThumb.focus();
    // Spam right; Radix should clamp at end-thumb's position.
    for (let i = 0; i < 20; i++) {
      fireEvent.keyDown(startThumb, { key: "ArrowRight" });
    }
    await waitFor(() => {
      expect(last[0]).toBeLessThanOrEqual(last[1]);
    });
  });
});

describe("Slider — pointer drag (smoke test)", () => {
  it("pointerdown on the track does not throw", () => {
    const onChange = vi.fn();
    const { container } = render(
      <Slider value={50} onChange={onChange} min={0} max={100} step={1} />,
    );
    const track = container.querySelector<HTMLElement>(
      ".ds-slider-track",
    )!;
    expect(() =>
      fireEvent.pointerDown(track, {
        clientX: 100,
        pointerType: "mouse",
        button: 0,
      }),
    ).not.toThrow();
  });
});

describe("SliderComfortable", () => {
  it("renders pips by default", () => {
    const { container } = render(
      <SliderComfortable value={2} onChange={() => {}} min={0} max={5} />,
    );
    expect(container.querySelectorAll(".ds-slider-comfy-pip").length).toBe(6);
  });

  it("renders scrubber variant", () => {
    const { container } = render(
      <SliderComfortable
        value={50}
        onChange={() => {}}
        min={0}
        max={100}
        variant="scrubber"
        label="Vol"
      />,
    );
    const root = container.querySelector<HTMLElement>(".ds-slider-comfy")!;
    expect(root.getAttribute("data-variant")).toBe("scrubber");
  });

  it("supports keyboard nav via Radix", async () => {
    let v = 50;
    const onChange = vi.fn((nv: number) => {
      v = nv;
    });
    render(
      <SliderComfortable
        value={v}
        onChange={onChange}
        min={0}
        max={100}
        step={5}
        variant="scrubber"
      />,
    );
    const thumb = screen.getAllByRole("slider")[0]!;
    thumb.focus();
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
  });

  it("respects disabled", () => {
    render(
      <SliderComfortable value={50} onChange={() => {}} min={0} max={100} disabled />,
    );
    const root = document.querySelector<HTMLElement>(".ds-slider-comfy")!;
    expect(root.getAttribute("data-disabled")).toBe("true");
  });
});
