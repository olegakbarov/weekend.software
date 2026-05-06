import { Button, Switch } from "@weekend/design";
import { Badge, BADGE_HEX, type BadgeColor } from "@weekend/design/registry";
import { useState } from "react";
import { Package, Sparkles, Zap } from "lucide-react";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

const BADGE_COLORS = Object.keys(BADGE_HEX).slice(0, 12) as BadgeColor[];

export function PageIntroduction(): React.JSX.Element {
  const [on1, setOn1] = useState(false);
  const [on2, setOn2] = useState(true);
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Getting started</div>
        <h1>Fluid Functionalism</h1>
        <p className="lede">
          Refined UI components with satisfying hover. Built on shadcn/ui and Radix primitives —
          every transition exists to make a state change legible.
        </p>
        <div className="meta-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          <Badge color="gray" variant="dot">
            v0.4.2
          </Badge>
          <Badge color="blue">MIT</Badge>
          <Badge color="gray">Tailwind v4</Badge>
          <Badge color="gray">React 18</Badge>
        </div>
      </header>

      <div className="section">
        <p>
          A component library you install via the shadcn registry — drops into your existing
          theme, doesn't override your tokens. The opinionated parts are motion and weight:
          springs replace fixed durations, font weight shifts on hover instead of color.
        </p>

        <div
          className="bento"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridAutoRows: "180px",
            gap: 12,
            marginTop: 24,
          }}
        >
          <BentoCard span={2} name="Buttons">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="primary">Primary</Button>
              <Button variant="tertiary">Tertiary</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
          </BentoCard>
          <BentoCard name="Switch">
            <div style={{ display: "flex", gap: 14 }}>
              <Switch checked={on1} onChange={setOn1} ariaLabel="A" />
              <Switch checked={on2} onChange={setOn2} ariaLabel="B" />
            </div>
          </BentoCard>
          <BentoCard span={2} name="Badges">
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                justifyContent: "center",
                maxWidth: 280,
              }}
            >
              {BADGE_COLORS.map((c) => (
                <Badge key={c} color={c} size="sm">
                  {c}
                </Badge>
              ))}
            </div>
          </BentoCard>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="philosophy">
          Philosophy
        </H>
        <p>Three principles, applied consistently:</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginTop: 16,
          }}
        >
          <Principle
            Icon={Zap}
            title="Motion as information"
            desc="Transitions make state changes legible. Nothing moves for decoration."
          />
          <Principle
            Icon={Sparkles}
            title="Hover as preview"
            desc="Weight shifts before color does. The cursor's path is already a preview of what would happen."
          />
          <Principle
            Icon={Package}
            title="Drop-in compatible"
            desc="Your existing shadcn theme and tokens apply automatically. No fork, no override."
          />
        </div>
      </div>

      <div className="section">
        <H as="h2" id="install">
          Install in 30 seconds
        </H>
        <CodeBlock lang="bash">npx shadcn@latest registry add @weekend</CodeBlock>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 8 }}>
          That's it. Components land in <code className="code-inline">components/ui/</code>, you
          own the source.{" "}
          <a
            href="#/installation"
            style={{ color: "var(--foreground)", borderBottom: "1px solid var(--border)" }}
          >
            See full setup →
          </a>
        </p>
      </div>
    </>
  );
}

function BentoCard({
  name,
  span = 1,
  children,
}: {
  name: string;
  span?: number;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        gridColumn: `span ${span}`,
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--shape-container, 24px)",
        boxShadow: "var(--shadow-card)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontVariationSettings: "var(--fw-semibold)",
          color: "var(--foreground)",
        }}
      >
        {name}
      </div>
      <div style={{ flex: 1, display: "grid", placeItems: "center" }}>{children}</div>
    </div>
  );
}

function Principle({
  Icon,
  title,
  desc,
}: {
  Icon: typeof Zap;
  title: string;
  desc: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: 18,
        border: "1px solid var(--border)",
        borderRadius: "var(--shape-container, 16px)",
        background: "var(--card)",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 9999,
          background: "var(--muted)",
          display: "grid",
          placeItems: "center",
          marginBottom: 12,
        }}
      >
        <Icon size={16} />
      </div>
      <div
        style={{
          fontSize: 14,
          fontVariationSettings: "var(--fw-semibold)",
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
        {desc}
      </div>
    </div>
  );
}
