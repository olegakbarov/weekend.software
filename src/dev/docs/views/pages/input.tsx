import { useState } from "react";
import { Textarea } from "@weekend/design";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageInput(): React.JSX.Element {
  const [v, setV] = useState("");
  const [ta, setTa] = useState("");
  const [taGhost, setTaGhost] = useState("");
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Input</h1>
        <p className="lede">
          A standard single-line text input with the DS focus ring (1px outline + 3px halo on{" "}
          <code className="code-inline">:focus-visible</code>).
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage">
            <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                className="input"
                placeholder="ada@example.com"
                value={v}
                onChange={(e) => setV(e.target.value)}
              />
              <input className="input" placeholder="Disabled" disabled />
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <p>
          Use the bare <code className="code-inline">.input</code> class to inherit DS styling.
          For grouped fields with proximity-hover behavior, see{" "}
          <a href="#/input-group" style={{ color: "var(--foreground)", borderBottom: "1px solid var(--border)" }}>
            Input Group
          </a>
          .
        </p>
        <CodeBlock lang="tsx">{`<input
  className="input"
  placeholder="ada@example.com"
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>`}</CodeBlock>
      </div>

      <div className="section">
        <H as="h2" id="textarea">
          Textarea
        </H>
        <p>
          Multi-line input with two variants: <code className="code-inline">default</code> (rounded
          border, focus ring) and <code className="code-inline">ghost</code> (no border, transparent).
          Forwards refs and accepts all standard <code className="code-inline">&lt;textarea&gt;</code> props.
        </p>
        <div className="example">
          <div className="example-stage">
            <div style={{ width: 360, display: "flex", flexDirection: "column", gap: 12 }}>
              <Textarea
                placeholder="Write something..."
                value={ta}
                onChange={(e) => setTa(e.target.value)}
              />
              <Textarea
                variant="ghost"
                placeholder="ghost variant"
                value={taGhost}
                onChange={(e) => setTaGhost(e.target.value)}
              />
            </div>
          </div>
        </div>
        <CodeBlock lang="tsx">{`import { Textarea } from "@weekend/design";

<Textarea
  placeholder="Write something..."
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>

<Textarea variant="ghost" placeholder="ghost variant" />`}</CodeBlock>
      </div>
    </>
  );
}
