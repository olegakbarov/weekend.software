import { useState } from "react";
import { NavItem, NavMenu } from "@weekend/design/registry";
import { Book, Hash, Home, Layers, Palette, Sparkles, Type } from "lucide-react";
import { CodeBlock, CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageSidebar(): React.JSX.Element {
  const [active, setActive] = useState("/colors");
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Sidebar</h1>
        <p className="lede">
          A vertical navigation pattern composed of <CodeInline>NavMenu</CodeInline> +{" "}
          <CodeInline>NavItem</CodeInline>. Section headers, scroll, and an optional collapse
          button on the bottom.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage" style={{ alignItems: "stretch" }}>
            <aside
              style={{
                width: 260,
                padding: 16,
                border: "1px solid var(--border)",
                borderRadius: "var(--shape-container, 16px)",
                background: "var(--card)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--muted-foreground)",
                  fontVariationSettings: "var(--fw-semibold)",
                  padding: "0 12px 8px",
                }}
              >
                Workspace
              </div>
              <NavMenu activeSlug={active}>
                {(
                  [
                    ["/", "Home", Home],
                    ["/colors", "Tokens", Palette],
                    ["/components", "Components", Layers],
                  ] as const
                ).map(([slug, label, Icon], i) => (
                  <NavItem
                    key={slug}
                    index={i}
                    href={slug}
                    label={label}
                    icon={Icon}
                    onClick={(e) => {
                      e.preventDefault();
                      setActive(slug);
                    }}
                  />
                ))}
              </NavMenu>

              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--muted-foreground)",
                  fontVariationSettings: "var(--fw-semibold)",
                  padding: "16px 12px 8px",
                }}
              >
                Reference
              </div>
              <NavMenu activeSlug={active}>
                {(
                  [
                    ["/intro", "Introduction", Book],
                    ["/typography", "Typography", Type],
                    ["/icons", "Iconography", Hash],
                    ["/changelog", "Changelog", Sparkles],
                  ] as const
                ).map(([slug, label, Icon], i) => (
                  <NavItem
                    key={slug}
                    index={i + 100}
                    href={slug}
                    label={label}
                    icon={Icon}
                    onClick={(e) => {
                      e.preventDefault();
                      setActive(slug);
                    }}
                  />
                ))}
              </NavMenu>
            </aside>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<aside className="sidebar">
  <NavMenu activeSlug={pathname}>
    <NavItem index={0} href="/" label="Home" icon={Home} />
    <NavItem index={1} href="/about" label="About" icon={Book} />
  </NavMenu>
</aside>`}</CodeBlock>
      </div>
    </>
  );
}
