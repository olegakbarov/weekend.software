import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ShellThemeBridge } from "./shell-theme-bridge";
import { useShellTheme } from "./use-shell-theme";

function Probe() {
  const { theme, isDark } = useShellTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="dark">{String(isDark)}</span>
    </div>
  );
}

describe("useShellTheme", () => {
  beforeEach(() => {
    delete (window as unknown as { __WEEKEND_SHELL_THEME__?: string })
      .__WEEKEND_SHELL_THEME__;
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    delete (window as unknown as { __WEEKEND_SHELL_THEME__?: string })
      .__WEEKEND_SHELL_THEME__;
    document.documentElement.removeAttribute("data-theme");
  });

  it("falls back to DEFAULT_THEME when no shell state is present", () => {
    render(<Probe />);
    expect(screen.getByTestId("theme").textContent).toBe("fluid");
    expect(screen.getByTestId("dark").textContent).toBe("false");
  });

  it("reads the global set by the shell preamble", () => {
    (
      window as unknown as { __WEEKEND_SHELL_THEME__?: string }
    ).__WEEKEND_SHELL_THEME__ = "weekend-dark";
    render(<Probe />);
    expect(screen.getByTestId("theme").textContent).toBe("weekend-dark");
    expect(screen.getByTestId("dark").textContent).toBe("true");
  });

  it("falls back to <html data-theme> when no global is set", () => {
    document.documentElement.dataset.theme = "weekend-paper";
    render(<Probe />);
    expect(screen.getByTestId("theme").textContent).toBe("weekend-paper");
    expect(screen.getByTestId("dark").textContent).toBe("false");
  });

  it("reacts to weekend:theme window events", () => {
    render(<Probe />);
    expect(screen.getByTestId("theme").textContent).toBe("fluid");

    act(() => {
      window.dispatchEvent(
        new CustomEvent("weekend:theme", {
          detail: { theme: "fluid-dark" },
        })
      );
    });

    expect(screen.getByTestId("theme").textContent).toBe("fluid-dark");
    expect(screen.getByTestId("dark").textContent).toBe("true");
  });

  it("ignores invalid theme values from events", () => {
    (
      window as unknown as { __WEEKEND_SHELL_THEME__?: string }
    ).__WEEKEND_SHELL_THEME__ = "fluid";
    render(<Probe />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent("weekend:theme", {
          detail: { theme: "neon-pink" },
        })
      );
    });
    expect(screen.getByTestId("theme").textContent).toBe("fluid");
  });

  it("ShellThemeBridge supplies theme via context", () => {
    (
      window as unknown as { __WEEKEND_SHELL_THEME__?: string }
    ).__WEEKEND_SHELL_THEME__ = "weekend-dark";

    render(
      <ShellThemeBridge>
        <Probe />
      </ShellThemeBridge>
    );

    expect(screen.getByTestId("theme").textContent).toBe("weekend-dark");

    act(() => {
      window.dispatchEvent(
        new CustomEvent("weekend:theme", {
          detail: { theme: "fluid" },
        })
      );
    });

    expect(screen.getByTestId("theme").textContent).toBe("fluid");
  });
});
