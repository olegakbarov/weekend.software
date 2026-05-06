import { useState } from "react";
import { Seg, type SegItem } from "@weekend/design";
import {
  TabItem,
  TabPanel,
  Tabs,
  TabsList,
  useIcon,
} from "@weekend/design/registry";
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
  const [controlled, setControlled] = useState("library");

  const SquareLibrary = useIcon("square-library");
  const Clock = useIcon("clock");
  const Star = useIcon("star");
  const Settings = useIcon("settings");

  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Tabs</h1>
        <p className="lede">
          Tabbed-content control with sliding active indicator, proximity hover,
          and spring animations. Compound API:{" "}
          <code>Tabs / TabsList / TabItem / TabPanel</code>.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="tabs-basic">
          Basic
        </H>
        <p className="lede">
          The active tab is indicated by an animated <code>bg-background</code> pill
          that springs between triggers. Hover and keyboard focus each get their own
          animated overlay rect.
        </p>
        <div className="example">
          <div className="example-stage">
            <Tabs defaultValue="library">
              <TabsList>
                <TabItem value="library" label="Library" />
                <TabItem value="recents" label="Recents" />
                <TabItem value="favorites" label="Favorites" />
                <TabItem value="settings" label="Settings" />
              </TabsList>
              <TabPanel value="library">
                <p style={{ color: "var(--muted-foreground)", fontSize: 13, paddingTop: 12 }}>
                  Library content — your saved items.
                </p>
              </TabPanel>
              <TabPanel value="recents">
                <p style={{ color: "var(--muted-foreground)", fontSize: 13, paddingTop: 12 }}>
                  Recents content — what you opened lately.
                </p>
              </TabPanel>
              <TabPanel value="favorites">
                <p style={{ color: "var(--muted-foreground)", fontSize: 13, paddingTop: 12 }}>
                  Favorites content — pinned highlights.
                </p>
              </TabPanel>
              <TabPanel value="settings">
                <p style={{ color: "var(--muted-foreground)", fontSize: 13, paddingTop: 12 }}>
                  Settings content — preferences for this view.
                </p>
              </TabPanel>
            </Tabs>
          </div>
        </div>

        <H as="h3" id="tabs-usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`import { Tabs, TabsList, TabItem, TabPanel } from "@weekend/design/registry";

<Tabs defaultValue="library">
  <TabsList>
    <TabItem value="library" label="Library" />
    <TabItem value="recents" label="Recents" />
    <TabItem value="favorites" label="Favorites" />
  </TabsList>
  <TabPanel value="library">…</TabPanel>
  <TabPanel value="recents">…</TabPanel>
  <TabPanel value="favorites">…</TabPanel>
</Tabs>`}</CodeBlock>
      </div>

      <div className="section">
        <H as="h2" id="tabs-icons">
          With icons
        </H>
        <p className="lede">
          <code>TabItem</code> accepts an <code>icon</code> prop. The icon&apos;s
          stroke width animates between 1.5 and 2 as the tab activates.
        </p>
        <div className="example">
          <div className="example-stage">
            <Tabs defaultValue="library">
              <TabsList>
                <TabItem value="library" icon={SquareLibrary} label="Library" />
                <TabItem value="recents" icon={Clock} label="Recents" />
                <TabItem value="favorites" icon={Star} label="Favorites" />
                <TabItem value="settings" icon={Settings} label="Settings" />
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="tabs-controlled">
          Controlled
        </H>
        <p className="lede">
          Pass <code>value</code> + <code>onValueChange</code> for controlled
          mode, or <code>selectedIndex</code> + <code>onSelect</code> for the
          index-based equivalent.
        </p>
        <div className="example">
          <div className="example-stage">
            <Tabs value={controlled} onValueChange={setControlled}>
              <TabsList>
                <TabItem value="library" label="Library" />
                <TabItem value="recents" label="Recents" />
                <TabItem value="favorites" label="Favorites" />
              </TabsList>
            </Tabs>
            <p style={{ color: "var(--muted-foreground)", fontSize: 12, marginTop: 12 }}>
              Active: <span style={{ color: "var(--foreground)" }}>{controlled}</span>
            </p>
          </div>
        </div>

      </div>

      <div className="section">
        <H as="h2" id="tabs-api">
          API
        </H>
        <ul>
          <li>
            <code>Tabs</code> — root. Accepts <code>value</code>,{" "}
            <code>onValueChange</code>, <code>selectedIndex</code>,{" "}
            <code>onSelect</code>, <code>defaultValue</code>, plus any prop from
            Radix&apos;s <code>Tabs.Root</code>.
          </li>
          <li>
            <code>TabsList</code> — wraps the items. Mounts the proximity-hover
            tracker, the active-pill, the hover overlay, and the focus ring.
          </li>
          <li>
            <code>TabItem</code> — required <code>value</code> and{" "}
            <code>label</code> (string). Optional <code>icon</code>. Note:{" "}
            <code>label</code> is a string (not children) so the inline-grid
            bold-ghost trick can pre-allocate width.
          </li>
          <li>
            <code>TabPanel</code> — required <code>value</code> matching a{" "}
            <code>TabItem</code>. Only the active panel renders.
          </li>
        </ul>
        <p className="note">
          <code>TabsTrigger</code> and <code>TabsContent</code> remain exported
          as deprecated back-compat aliases. New code should use{" "}
          <code>TabItem</code> and <code>TabPanel</code>.
        </p>
      </div>

      <div className="section">
        <H as="h2" id="seg">
          Segmented control (Seg)
        </H>
        <p className="lede">
          A different but related primitive: a pill-style toggle for filter/mode
          selection. The plate slides on a moderate spring; weight shifts under
          hover before color does.
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
