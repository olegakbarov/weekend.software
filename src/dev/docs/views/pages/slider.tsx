import { useState } from "react";
import { Slider } from "@weekend/design";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageSlider(): React.JSX.Element {
  const [pct, setPct] = useState(40);
  const [cpm, setCpm] = useState(80);
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Slider</h1>
        <p className="lede">
          A pointer-based linear slider. Thumb scales 1.15× on hover and snaps to the configured
          step. Format the readout next to the track however you like.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage" style={{ flexDirection: "column", gap: 24, width: "100%" }}>
            <div style={{ width: "100%", maxWidth: 360 }}>
              <Slider min={0} max={100} value={pct} onChange={setPct} format={(v) => `${v}%`} />
            </div>
            <div style={{ width: "100%", maxWidth: 360 }}>
              <Slider
                min={20}
                max={240}
                step={10}
                value={cpm}
                onChange={setCpm}
                format={(v) => `${v}/min`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`const [v, setV] = useState(50);
<Slider min={0} max={100} value={v} onChange={setV} format={(n) => \`\${n}%\`} />`}</CodeBlock>
      </div>
    </>
  );
}
