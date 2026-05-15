import { useState } from "react";
import { NavItem, NavMenu } from "@weekend/design/registry";
import { Book, Hash, List, Palette, Sliders, Type } from "lucide-react";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageNavMenu(): React.JSX.Element {
  const [active, setActive] = useState("#colors");
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Nav Menu</h1>
        <p className="lede">
          Sidebar navigation with proximity-hover background. The active route's pill stays put;
          a softer pill follows the cursor toward the closest item.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage" style={{ alignItems: "stretch" }}>
            <div style={{ width: 220 }}>
              <NavMenu activeSlug={active}>
                {(
                  [
                    ["#intro", "Introduction", Book],
                    ["#colors", "Colors", Palette],
                    ["#typography", "Typography", Type],
                    ["#spacing", "Spacing", Sliders],
                    ["#badges", "Badges", Hash],
                    ["#components", "Components", List],
                  ] as const
                ).map(([slug, label, Icon], i) => (
                  <NavItem
                    key={slug}
                    index={i}
                    href={slug}
                    label={label}
                    icon={Icon}
                    onClick={() => {
                      setActive(slug);
                    }}
                  />
                ))}
              </NavMenu>
              <div
                style={{
                  marginTop: 16,
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                  textAlign: "center",
                }}
              >
                Active:{" "}
                <code style={{ fontFamily: "var(--font-mono)" }}>{active}</code>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<NavMenu activeSlug={pathname}>
  <NavItem index={0} href="/about" label="About" icon={Book} />
  <NavItem index={1} href="/pricing" label="Pricing" icon={Hash} />
</NavMenu>`}</CodeBlock>
      </div>
    </>
  );
}
