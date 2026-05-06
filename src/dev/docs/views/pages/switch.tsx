import { useState } from "react";
import { Switch } from "@weekend/design";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageSwitch(): React.JSX.Element {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Switch</h1>
        <p className="lede">A binary toggle. Slides on a moderate spring; the thumb stays
        round, the track fills with foreground.</p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage" style={{ gap: 18 }}>
            <Switch checked={a} onChange={setA} ariaLabel="Toggle A" />
            <Switch checked={b} onChange={setB} ariaLabel="Toggle B" />
            <Switch checked={false} onChange={() => {}} disabled ariaLabel="Disabled" />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`const [on, setOn] = useState(false);
<Switch checked={on} onChange={setOn} ariaLabel="Notifications" />`}</CodeBlock>
      </div>
    </>
  );
}
