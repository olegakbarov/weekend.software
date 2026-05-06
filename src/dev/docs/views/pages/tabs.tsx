import { useState } from "react";
import { Seg, type SegItem } from "@weekend/design";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@weekend/design/registry";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

const SEG_DAY_WEEK: ReadonlyArray<SegItem> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const SEG_VARIANTS: ReadonlyArray<SegItem<"a" | "b" | "c">> = [
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
          Tabbed-content control. Use Tabs when you want panels with content; use Seg for
          filter/mode toggles where each value reveals a different view of the same content.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="tabs">
          Tabs
        </H>
        <p className="lede">
          A Radix Tabs wrapper. Compound API: <code>Tabs / TabsList / TabsTrigger / TabsContent</code>.
          Active trigger draws a 2px underline that overlaps the list&apos;s bottom border.
        </p>
        <div className="example">
          <div className="example-stage">
            <div style={{ width: 360 }}>
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
                    Overview content — a summary of the current view.
                  </p>
                </TabsContent>
                <TabsContent value="activity">
                  <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
                    Activity content — recent events and changes.
                  </p>
                </TabsContent>
                <TabsContent value="settings">
                  <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
                    Settings content — preferences for this view.
                  </p>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        <H as="h3" id="tabs-usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`import { Tabs, TabsList, TabsTrigger, TabsContent } from "@weekend/design/registry";

<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="activity">Activity</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">…</TabsContent>
  <TabsContent value="activity">…</TabsContent>
  <TabsContent value="settings">…</TabsContent>
</Tabs>`}</CodeBlock>

        <H as="h3" id="tabs-api">
          API
        </H>
        <ul>
          <li>
            <code>Tabs</code> — root. Accepts <code>defaultValue</code>, <code>value</code>,{" "}
            <code>onValueChange</code>, <code>orientation</code>, plus any prop from Radix&apos;s{" "}
            <code>Tabs.Root</code>.
          </li>
          <li>
            <code>TabsList</code> — wraps the triggers. Renders a thin row with a bottom border.
          </li>
          <li>
            <code>TabsTrigger</code> — required <code>value</code>. Draws an underline when active.
            Supports <code>disabled</code>.
          </li>
          <li>
            <code>TabsContent</code> — required <code>value</code> matching a trigger. Only the
            active panel renders.
          </li>
        </ul>
      </div>

      <div className="section">
        <H as="h2" id="seg">
          Segmented control (Seg)
        </H>
        <p className="lede">
          A different but related primitive: a pill-style toggle for filter/mode selection. The
          plate slides on a moderate spring; weight shifts under hover before color does.
        </p>

        <H as="h3" id="seg-filled">
          Filled
        </H>
        <div className="example">
          <div className="example-stage">
            <div style={{ width: 280 }}>
              <Seg items={SEG_DAY_WEEK} value={v1} onChange={setV1} />
            </div>
          </div>
        </div>

        <H as="h3" id="seg-subtle">
          Subtle
        </H>
        <div className="example">
          <div className="example-stage">
            <Seg items={SEG_VARIANTS} value={v2} onChange={setV2} variant="subtle" />
          </div>
        </div>

        <H as="h3" id="seg-usage">
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
