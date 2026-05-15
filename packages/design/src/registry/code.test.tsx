import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Code, CodeInline } from "./code";

describe("Code", () => {
  it("renders code text inside a streamdown frame", () => {
    const { container } = render(
      <Code language="json">{`{ "ok": true }`}</Code>,
    );
    expect(container.querySelector(".weekend-code")).toBeTruthy();
    expect(container.textContent).toContain(`{ "ok": true }`);
  });

  it("applies feature-flag modifier classes when chrome is disabled", () => {
    const { container } = render(
      <Code
        language="bash"
        showLanguage={false}
        showCopy={false}
        showDownload={false}
      >
        echo hi
      </Code>,
    );
    const root = container.querySelector(".weekend-code");
    expect(root?.classList.contains("weekend-code--no-language")).toBe(true);
    expect(root?.classList.contains("weekend-code--no-copy")).toBe(true);
    expect(root?.classList.contains("weekend-code--no-download")).toBe(true);
  });

  it("merges a caller className with the base class", () => {
    const { container } = render(
      <Code language="ts" className="custom-x">
        const x = 1;
      </Code>,
    );
    const root = container.querySelector(".weekend-code");
    expect(root?.classList.contains("custom-x")).toBe(true);
  });
});

describe("CodeInline", () => {
  it("renders an inline <code> with the design-system class", () => {
    const { container } = render(<CodeInline>weekend.config.json</CodeInline>);
    const el = container.querySelector("code");
    expect(el?.classList.contains("weekend-code-inline")).toBe(true);
    expect(el?.textContent).toBe("weekend.config.json");
  });
});
