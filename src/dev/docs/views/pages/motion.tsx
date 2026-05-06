import { useState } from "react";
import { CodeBlock, CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

interface SpringSpec {
  readonly name: string;
  readonly ms: number;
  readonly role: string;
}

const SPRINGS: ReadonlyArray<SpringSpec> = [
  { name: "spring-fast", ms: 80, role: "Hover · fade · weight" },
  { name: "spring-moderate", ms: 160, role: "Dropdown · tooltip · toast" },
  { name: "spring-slow", ms: 240, role: "Modal · side panel" },
];

function SpringCard({ name, ms, role }: SpringSpec): React.JSX.Element {
  const [pos, setPos] = useState<"start" | "end">("start");
  return (
    <div className="spring-card">
      <div className="head">
        <div className="name">{name}</div>
        <div className="meta">{ms}ms</div>
      </div>
      <div
        className="stage"
        onClick={() => setPos((p) => (p === "start" ? "end" : "start"))}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setPos((p) => (p === "start" ? "end" : "start"));
          }
        }}
      >
        <div
          className="ball"
          data-pos={pos}
          style={{ transition: `left ${ms}ms var(--ease-out-ui)` }}
        />
      </div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{role}</div>
    </div>
  );
}

export function PageMotion(): React.JSX.Element {
  const [tick, setTick] = useState(0);
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Tokens</div>
        <h1>Motion</h1>
        <p className="lede">
          Three spring tokens, that's the entire vocabulary. Springs adapt to interruption;
          durations don't. Exits are slightly faster than enters — it makes the interface feel
          alive.
        </p>
      </header>

      <div className="section">
        <button
          type="button"
          className="btn btn-tertiary"
          onClick={() => setTick((t) => t + 1)}
          style={{
            marginBottom: 16,
            position: "relative",
            isolation: "isolate",
          }}
        >
          <span className="btn-bg" />
          Replay all
        </button>
        <div className="spring-demo" key={tick}>
          {SPRINGS.map((s) => (
            <SpringCard key={s.name} {...s} />
          ))}
        </div>
      </div>

      <div className="section">
        <H as="h2" id="philosophy">
          Springs, not durations
        </H>
        <p>
          Components use Framer Motion <CodeInline>type: "spring"</CodeInline>. They adapt
          naturally to interruption — if a tooltip is mid-fade and you move away, the exit picks
          up where the enter left off, not from the original anchor.
        </p>
        <CodeBlock>{[
          'import { motion } from "framer-motion";',
          'import { springs } from "@/lib/springs";',
          "",
          "<motion.div",
          "  initial={{ opacity: 0, scale: 0.96 }}",
          "  animate={{ opacity: 1, scale: 1 }}",
          "  exit={{ opacity: 0, scale: 0.96 }}",
          "  transition={springs.moderate}",
          "/>",
        ].join("\n")}</CodeBlock>
      </div>

      <div className="section">
        <H as="h2" id="proximity">
          Proximity hover
        </H>
        <p>
          The marquee interaction. When the cursor enters a group of related items (tabs, radios,
          menu items), an animated background pill follows the <em>closest</em> item — not just
          the one being hovered. The hook is <CodeInline>useProximityHover</CodeInline>.
        </p>
      </div>
    </>
  );
}
