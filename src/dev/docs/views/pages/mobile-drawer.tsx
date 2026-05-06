import { useState } from "react";
import { MobileDrawer } from "@weekend/design/registry";
import { CodeBlock, CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageMobileDrawer(): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Mobile Drawer</h1>
        <p className="lede">
          Slide-in panel anchored to the left edge. Locks body scroll, traps Tab focus inside,
          restores focus to the trigger on close, exits faster than it enters.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setOpen(true)}
              style={{ position: "relative", isolation: "isolate" }}
            >
              <span className="btn-bg" />
              Open drawer
            </button>
            <MobileDrawer open={open} onClose={() => setOpen(false)}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    fontSize: 14,
                    fontVariationSettings: "var(--fw-semibold)",
                    color: "var(--foreground)",
                    background: "transparent",
                    border: 0,
                    padding: "10px 12px",
                    borderRadius: 12,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
                <a
                  href="#/colors"
                  onClick={() => setOpen(false)}
                  style={{
                    fontSize: 13,
                    color: "var(--muted-foreground)",
                    padding: "8px 12px",
                  }}
                >
                  Colors
                </a>
                <a
                  href="#/typography"
                  onClick={() => setOpen(false)}
                  style={{
                    fontSize: 13,
                    color: "var(--muted-foreground)",
                    padding: "8px 12px",
                  }}
                >
                  Typography
                </a>
                <a
                  href="#/spacing"
                  onClick={() => setOpen(false)}
                  style={{
                    fontSize: 13,
                    color: "var(--muted-foreground)",
                    padding: "8px 12px",
                  }}
                >
                  Spacing
                </a>
              </div>
            </MobileDrawer>
          </div>
          <div className="example-meta">
            <span style={{ fontFamily: "var(--font-mono)" }}>
              springs.moderate · Esc to close
            </span>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <p>
          Pass <CodeInline>open</CodeInline> + <CodeInline>onClose</CodeInline>. The drawer
          handles overlay click, Esc key, and Tab trap on its own. Optional{" "}
          <CodeInline>triggerRef</CodeInline> restores focus to a specific element on close.
        </p>
        <CodeBlock lang="tsx">{`const [open, setOpen] = useState(false);

<button onClick={() => setOpen(true)}>Menu</button>
<MobileDrawer open={open} onClose={() => setOpen(false)}>
  <nav>
    <a href="/about">About</a>
    <a href="/pricing">Pricing</a>
  </nav>
</MobileDrawer>`}</CodeBlock>
      </div>
    </>
  );
}
