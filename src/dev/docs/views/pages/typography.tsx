import { CodeBlock, CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

const WEIGHT_AXES: ReadonlyArray<readonly [string, string, string]> = [
  ["--fw-normal", "400", "Body text, paragraphs, descriptions"],
  ["--fw-medium", "450", "UI labels, button text at rest"],
  ["--fw-semibold", "550", "Hover/active state, strong UI"],
  ["--fw-bold", "700", "Headings only"],
];

const SCALE: ReadonlyArray<readonly [string, string, string, string]> = [
  ["h1", "28", "1", "bold"],
  ["h2", "22", "1.1", "bold"],
  ["h3", "18", "1.25", "semibold"],
  ["lg", "15", "1.5", "medium"],
  ["md", "14", "1.5", "normal"],
  ["sm", "13", "1.4", "medium"],
  ["xs", "12", "1.4", "medium"],
  ["xxs", "12", "1.4", "medium"],
];

const HOVER_LINKS = ["Documentation", "Pricing", "Customers", "Changelog", "Contact"];

export function PageTypography(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Tokens</div>
        <h1>Typography</h1>
        <p className="lede">
          One typeface, four custom weight axes, and a hover transition that animates weight
          instead of color. The brand's signature interaction.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="weight-axis">
          Weight axis
        </H>
        <p>
          The trick: between Tailwind's 400 (regular) and 500 (medium), Fluid sits at 450. Between
          500 and 600, it sits at 550. Just enough to feel different without being a different
          weight.
        </p>
        <div className="type-spec" style={{ marginTop: 16 }}>
          {WEIGHT_AXES.map(([token, weight, role]) => (
            <div key={token} className="type-row">
              <div className="type-meta">
                <span
                  style={{
                    fontVariationSettings: "var(--fw-semibold)",
                    color: "var(--foreground)",
                  }}
                >
                  {token}
                </span>
                <span>{weight}</span>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 22,
                    fontVariationSettings: `"wght" ${weight}`,
                    lineHeight: 1.2,
                  }}
                >
                  Refined UI components with satisfying hover.
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
                  {role}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <H as="h2" id="hover-demo">
          The hover transition
        </H>
        <p>
          Hover any text below, weight transitions from 450 to 550 over 80ms. This is the entire
          interaction language for "this is interactive."
        </p>
        <div className="example">
          <div
            className="example-stage example-stage--plain"
            style={{ flexDirection: "column", gap: 14, alignItems: "flex-start" }}
          >
            {HOVER_LINKS.map((t) => (
              <button
                type="button"
                key={t}
                className="fluid-weight"
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--foreground)",
                  cursor: "pointer",
                  fontSize: 17,
                  padding: 0,
                  textAlign: "left",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="example-meta">
            <span style={{ fontFamily: "var(--font-mono)" }}>
              transition: font-variation-settings 80ms
            </span>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="scale">
          Type scale
        </H>
        <div className="type-spec">
          {SCALE.map(([token, px, lh, weight]) => (
            <div key={token} className="type-row">
              <div className="type-meta">
                <span
                  style={{
                    fontVariationSettings: "var(--fw-semibold)",
                    color: "var(--foreground)",
                  }}
                >
                  --text-{token}
                </span>
                <span>
                  {px}px / {lh}
                </span>
              </div>
              <div
                className="type-sample"
                style={{
                  fontSize: `${px}px`,
                  lineHeight: lh,
                  fontVariationSettings: `var(--fw-${weight})`,
                }}
              >
                The quick brown fox
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <H as="h2" id="balance">
          Wrap rules
        </H>
        <p>
          Globally: <CodeInline>text-wrap: balance</CodeInline> on headings,{" "}
          <CodeInline>pretty</CodeInline> on body. Headings get visually-balanced line breaks;
          paragraphs avoid orphans.
        </p>
        <CodeBlock lang="css">{`h1, h2, h3 { text-wrap: balance; }
p          { text-wrap: pretty;  }`}</CodeBlock>
      </div>
    </>
  );
}
