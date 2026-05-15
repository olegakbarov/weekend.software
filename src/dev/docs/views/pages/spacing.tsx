import { CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

const TOKENS: ReadonlyArray<readonly [string, number, string]> = [
  ["space-0_5", 2, "Hairline gap"],
  ["space-1", 4, "Tight icon-text"],
  ["space-1_5", 6, "Button gap"],
  ["space-2", 8, "Default control gap"],
  ["space-3", 12, "Compact section"],
  ["space-4", 16, "Default section"],
  ["space-6", 24, "Page block"],
  ["space-8", 32, "Page section"],
  ["space-12", 48, "Major break"],
];

export function PageSpacing(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Tokens</div>
        <h1>Spacing</h1>
        <p className="lede">
          Tailwind's 4-pixel grid. Components use micro-gaps inside, never larger than{" "}
          <CodeInline>gap-3</CodeInline> within a control. Layout uses{" "}
          <CodeInline>gap-6</CodeInline> / <CodeInline>gap-8</CodeInline>.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="scale">
          Scale
        </H>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 0,
            marginTop: 16,
            border: "1px solid var(--border)",
            borderRadius: "var(--shape-container, 16px)",
            padding: "12px 16px",
          }}
        >
          {TOKENS.map(([name, px, role]) => (
            <div
              key={name}
              className="space-row"
              style={{ gridTemplateColumns: "100px 50px 1fr 200px" }}
            >
              <div className="name">--{name}</div>
              <div className="val">{px}px</div>
              <div className="vis" style={{ width: `${px * 4}px`, maxWidth: "100%" }} />
              <div className="val" style={{ textAlign: "right" }}>
                {role}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <H as="h2" id="density">
          Density
        </H>
        <p>
          The system was tuned for desktop SaaS. Buttons are 28 / 32 / 36px tall (h-7 / h-8 /
          h-9). Inputs sit at 36px. Default body line-height is 1.5.
        </p>
      </div>
    </>
  );
}
