import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("renders a textarea element with the default class", () => {
    const { container } = render(<Textarea placeholder="Write something" />);
    const ta = container.querySelector("textarea");
    expect(ta).toBeTruthy();
    expect(ta?.className).toContain("ds-textarea");
    expect(ta?.className).not.toContain("ds-textarea-ghost");
  });

  it("forwards ref to the underlying textarea element", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("supports controlled value with onChange", () => {
    function Controlled(): React.JSX.Element {
      const [v, setV] = useState("hello");
      return (
        <Textarea
          aria-label="msg"
          value={v}
          onChange={(e) => setV(e.target.value)}
        />
      );
    }
    render(<Controlled />);
    const ta = screen.getByLabelText("msg") as HTMLTextAreaElement;
    expect(ta.value).toBe("hello");
    fireEvent.change(ta, { target: { value: "world" } });
    expect(ta.value).toBe("world");
  });

  it("applies the ghost variant class", () => {
    const { container } = render(<Textarea variant="ghost" />);
    const ta = container.querySelector("textarea");
    expect(ta?.className).toContain("ds-textarea");
    expect(ta?.className).toContain("ds-textarea-ghost");
  });

  it("respects the disabled prop", () => {
    const { container } = render(<Textarea disabled />);
    const ta = container.querySelector("textarea");
    expect(ta?.disabled).toBe(true);
  });
});
