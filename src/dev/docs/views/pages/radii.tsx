import { CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

interface ShapeCardProps {
  name: string;
  itemR: number;
  containerR: number;
}

function ShapeCard({ name, itemR, containerR }: ShapeCardProps): React.JSX.Element {
  return (
    <div
      style={{
        padding: 24,
        border: "1px solid var(--border)",
        borderRadius: containerR + 8,
        background: "var(--card)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontVariationSettings: "var(--fw-semibold)",
          marginBottom: 16,
        }}
      >
        {name}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ borderRadius: itemR, position: "relative", isolation: "isolate" }}
        >
          <span className="btn-bg" style={{ borderRadius: itemR }} />
          Primary
        </button>
        <button
          type="button"
          className="btn btn-tertiary"
          style={{ borderRadius: itemR, position: "relative", isolation: "isolate" }}
        >
          <span className="btn-bg" style={{ borderRadius: itemR }} />
          Tertiary
        </button>
      </div>
      <div
        style={{
          padding: 12,
          border: "1px solid var(--border)",
          borderRadius: containerR,
          background: "var(--background)",
          fontSize: 12,
          color: "var(--muted-foreground)",
        }}
      >
        item: {itemR}px · container: {containerR}px
      </div>
    </div>
  );
}

const RADIUS_TOKENS: ReadonlyArray<readonly [string, string, string]> = [
  ["--radius-sm", "8px", "Rounded · code blocks, kbd"],
  ["--radius-md", "10px", "Rounded · focus ring"],
  ["--radius-lg", "12px", "Rounded · buttons, inputs"],
  ["--radius-xl", "16px", "Rounded · containers, cards"],
  ["--radius-2xl", "20px", "Pill · buttons, items"],
  ["--radius-3xl", "24px", "Pill · containers, cards"],
  ["--radius-pill", "9999px", "Toggles, dots, avatars"],
];

export function PageRadii(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Tokens</div>
        <h1>Corner radii — Shape Context</h1>
        <p className="lede">
          A runtime-switchable shape variant. Pill (default) or rounded. Press <kbd>R</kbd>{" "}
          anywhere to cycle.
        </p>
      </header>

      <div className="section">
        <p>
          Components consume the active shape via{" "}
          <CodeInline>html[data-shape="pill" | "rounded"]</CodeInline> setting{" "}
          <CodeInline>--radius-control</CodeInline> / <CodeInline>--radius-container</CodeInline>.
          Items always get a tighter radius than their containers.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginTop: 24,
          }}
        >
          <ShapeCard name="Pill (default)" itemR={20} containerR={24} />
          <ShapeCard name="Rounded" itemR={8} containerR={12} />
        </div>
      </div>

      <div className="section">
        <H as="h2" id="tokens">
          Radius tokens
        </H>
        <table className="props-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Value</th>
              <th>Used by</th>
            </tr>
          </thead>
          <tbody>
            {RADIUS_TOKENS.map(([token, value, usedBy]) => (
              <tr key={token}>
                <td className="prop-name">{token}</td>
                <td className="prop-default">{value}</td>
                <td>{usedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
