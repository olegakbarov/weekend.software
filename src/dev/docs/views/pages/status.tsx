import { Badge } from "@weekend/design/registry";
import { CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

/**
 * Snapshot constants, bumped manually during meaningful commits. The point
 * isn't real-time accuracy, it's a one-glance read of the design system's
 * current shape. If you've just shipped a wave of changes, update these.
 */
const SNAPSHOT = {
  commitHash: "cf1d11a",
  commitTitle: "fix: docs Tabs page API section formatting",
  commitDate: "2026-05-06",
  // pnpm --filter @weekend/design test → "Tests 265 passed (265)"
  testCount: 265,
  testFiles: 16,
  // stat -f "%z" packages/design/dist/*  (bytes)
  distIndexJsBytes: 40_921,
  distRegistryJsBytes: 159_934,
  distIndexCssBytes: 19_135,
  // Themes declared in packages/design/src/tokens.css :root[data-theme="..."]
  themeCount: 4,
  // Components exported from index.ts (core/Weekend re-skins) + registry.ts (registry tier).
  // Tracked in INVENTORY.md "Component count summary": 30 exported components.
  componentCountCore: 11,
  componentCountRegistry: 19,
} as const;

const THEMES: ReadonlyArray<readonly [string, string]> = [
  ["fluid", "Light, hover-weight default"],
  ["fluid-dark", "Upstream dark peer"],
  ["weekend-dark", "Mono-blue ON state, Berkeley Mono"],
  ["weekend-paper", "Paper, VCR display font"],
];

function formatKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

interface MetricProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}

function Metric({ label, value, hint }: MetricProps): React.JSX.Element {
  return (
    <div
      style={{
        padding: 18,
        border: "1px solid var(--border)",
        borderRadius: "var(--shape-container, 16px)",
        background: "var(--card)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--muted-foreground)",
          fontVariationSettings: "var(--fw-medium)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontVariationSettings: "var(--fw-semibold)",
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {hint !== undefined ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.4 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function PageStatus(): React.JSX.Element {
  const totalDistKB =
    (SNAPSHOT.distIndexJsBytes + SNAPSHOT.distRegistryJsBytes + SNAPSHOT.distIndexCssBytes) / 1024;
  const totalComponents = SNAPSHOT.componentCountCore + SNAPSHOT.componentCountRegistry;

  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">State</div>
        <h1>Status</h1>
        <p className="lede">
          Top-line metrics for <CodeInline>@weekend/design</CodeInline>. Snapshot values, bumped
          during commits, close enough for a one-glance read of the system's current shape.
        </p>
        <div
          className="meta-row"
          style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}
        >
          <Badge color="green" variant="dot">
            healthy
          </Badge>
          <Badge color="gray">{SNAPSHOT.commitDate}</Badge>
          <Badge color="gray">
            <span style={{ fontFamily: "var(--font-mono)" }}>{SNAPSHOT.commitHash}</span>
          </Badge>
        </div>
      </header>

      <div className="section">
        <H as="h2" id="metrics">
          Metrics
        </H>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginTop: 16,
          }}
        >
          <Metric
            label="Tests"
            value={SNAPSHOT.testCount}
            hint={`${SNAPSHOT.testFiles} files, all passing`}
          />
          <Metric
            label="Components"
            value={totalComponents}
            hint={`${SNAPSHOT.componentCountRegistry} registry · ${SNAPSHOT.componentCountCore} core`}
          />
          <Metric label="Themes" value={SNAPSHOT.themeCount} hint="fluid + 3 variants" />
          <Metric
            label="dist total"
            value={`${totalDistKB.toFixed(1)} KB`}
            hint={
              <>
                {formatKB(SNAPSHOT.distIndexJsBytes)} index · {formatKB(SNAPSHOT.distRegistryJsBytes)}{" "}
                registry · {formatKB(SNAPSHOT.distIndexCssBytes)} css
              </>
            }
          />
          <Metric
            label="Latest commit"
            value={
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 18 }}>
                {SNAPSHOT.commitHash}
              </span>
            }
            hint={SNAPSHOT.commitTitle}
          />
          <Metric
            label="MISSING vs upstream"
            value={0}
            hint={
              <>
                See <a href="#/audit">Audit</a> for per-artifact fidelity
              </>
            }
          />
        </div>
      </div>

      <div className="section">
        <H as="h2" id="themes">
          Themes
        </H>
        <p>
          Tokens for all four themes live in{" "}
          <CodeInline>packages/design/src/tokens.css</CodeInline> as{" "}
          <CodeInline>:root[data-theme="..."]</CodeInline> blocks.
        </p>
        <ul>
          {THEMES.map(([name, blurb]) => (
            <li key={name}>
              <strong style={{ fontFamily: "var(--font-mono)" }}>{name}</strong>, {blurb}
            </li>
          ))}
        </ul>
      </div>

      <div className="section">
        <H as="h2" id="how-this-page-updates">
          How this page updates
        </H>
        <p>
          Values come from a <CodeInline>SNAPSHOT</CodeInline> const at the top of{" "}
          <CodeInline>views/pages/status.tsx</CodeInline>. Bump it when you ship a wave:
          {" "}<CodeInline>git rev-parse --short HEAD</CodeInline>,{" "}
          <CodeInline>pnpm --filter @weekend/design test</CodeInline> for the count,{" "}
          <CodeInline>stat -f "%z" packages/design/dist/*</CodeInline> for the byte sizes.
        </p>
      </div>
    </>
  );
}
