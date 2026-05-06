import { useState } from "react";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageInput(): React.JSX.Element {
  const [v, setV] = useState("");
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
    </>
  );
}
