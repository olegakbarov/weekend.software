import { useState } from "react";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageCheckboxRadio(): React.JSX.Element {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [pick, setPick] = useState("week");
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Checkbox & Radio</h1>
        <p className="lede">
          Standard form controls. Use checkboxes for independent yes/no states; use radios for
          one-of-N selection where the choice is small and stable.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="checkbox">
          Checkbox
        </H>
        <div className="example">
          <div
            className="example-stage"
            style={{ flexDirection: "column", alignItems: "flex-start", gap: 12 }}
          >
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" checked={a} onChange={(e) => setA(e.target.checked)} />
              <span style={{ color: "var(--foreground)" }}>Receive weekly summary</span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" checked={b} onChange={(e) => setB(e.target.checked)} />
              <span style={{ color: "var(--foreground)" }}>Subscribe to product updates</span>
            </label>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="radio">
          Radio
        </H>
        <div className="example">
          <div
            className="example-stage"
            style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}
          >
            {(["day", "week", "month"] as const).map((p) => (
              <label
                key={p}
                style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}
              >
                <input
                  type="radio"
                  name="cadence"
                  value={p}
                  checked={pick === p}
                  onChange={() => setPick(p)}
                />
                <span style={{ color: "var(--foreground)" }}>{p}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />

<input type="radio" name="cadence" value="week" checked={c === "week"} onChange={() => setC("week")} />`}</CodeBlock>
      </div>
    </>
  );
}
