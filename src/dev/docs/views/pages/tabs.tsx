import { useState } from "react";
import { Seg, type SegItem } from "@weekend/design";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

const TABS: ReadonlyArray<SegItem> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const VARIANTS: ReadonlyArray<SegItem<"a" | "b" | "c">> = [
  { value: "a", label: "Overview" },
  { value: "b", label: "Activity" },
  { value: "c", label: "Settings" },
];

export function PageTabs(): React.JSX.Element {
  const [v1, setV1] = useState("week");
  const [v2, setV2] = useState<"a" | "b" | "c">("a");
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Tabs</h1>
        <p className="lede">
          Segmented control. The plate slides on a moderate spring; weight shifts under hover
          before color does.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="filled">
          Filled
        </H>
        <div className="example">
          <div className="example-stage">
            <div style={{ width: 280 }}>
              <Seg items={TABS} value={v1} onChange={setV1} />
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="subtle">
          Subtle
        </H>
        <div className="example">
          <div className="example-stage">
            <Seg items={VARIANTS} value={v2} onChange={setV2} variant="subtle" />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`const [tab, setTab] = useState("week");
<Seg
  items={[
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
  ]}
  value={tab}
  onChange={setTab}
/>`}</CodeBlock>
      </div>
    </>
  );
}
