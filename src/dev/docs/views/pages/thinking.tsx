import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

interface MorphingThinkingProps {
  words: ReadonlyArray<string>;
  size?: number;
  intervalMs?: number;
}

function MorphingThinking({
  words,
  size = 16,
  intervalMs = 1800,
}: MorphingThinkingProps): React.JSX.Element {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setIdx((i) => (i + 1) % words.length), intervalMs);
    return () => window.clearInterval(t);
  }, [words.length, intervalMs]);

  return (
    <span
      className="inline-grid"
      style={{
        fontSize: size,
        fontVariationSettings: "var(--fw-semibold)",
        background:
          "linear-gradient(90deg, var(--muted-foreground) 0%, var(--foreground) 50%, var(--muted-foreground) 100%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        animation: "shimmer 2.4s linear infinite",
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={words[idx]}
          initial={{ y: "80%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-80%", opacity: 0 }}
          transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
          style={{ gridArea: "1 / 1" }}
        >
          {words[idx]}…
        </motion.span>
      </AnimatePresence>
      <style>{`@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }`}</style>
    </span>
  );
}

export function PageThinking(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Thinking indicator</h1>
        <p className="lede">
          A morphing word that swaps in and out on a slow clock. A shimmer gradient runs across
          the text to keep "alive" without spinning.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage">
            <MorphingThinking words={["Thinking", "Reasoning", "Drafting", "Refining"]} size={20} />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<MorphingThinking
  words={["Thinking", "Reasoning", "Drafting"]}
  intervalMs={1800}
/>`}</CodeBlock>
      </div>
    </>
  );
}
