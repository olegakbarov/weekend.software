import { useState } from "react";
import {
  ToolCall,
  ToolCallList,
  type ToolCallListItem,
  type ToolCallState,
} from "@weekend/design/registry";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

const ALL_STATES: ToolCallState[] = [
  "input-streaming",
  "input-available",
  "output-available",
  "output-error",
];

const SAMPLE_LIST: ToolCallListItem[] = [
  {
    id: "a",
    name: "list_directory",
    state: "output-available",
    input: { path: "src/" },
    output: { entries: 14 },
  },
  {
    id: "b",
    name: "read_file",
    state: "output-available",
    input: { path: "src/index.ts", limit: 80 },
    output: "// 80 lines of source",
  },
  {
    id: "c",
    name: "search",
    state: "output-error",
    input: { query: "TODO" },
    errorText: "Search index unavailable",
  },
  {
    id: "d",
    name: "edit_file",
    state: "input-streaming",
    input: { path: "src/index.ts" },
  },
];

export function PageToolCall(): React.JSX.Element {
  const [growing, setGrowing] = useState<ToolCallListItem[]>(
    SAMPLE_LIST.slice(0, 1),
  );

  const advance = () => {
    setGrowing((prev) => {
      if (prev.length >= SAMPLE_LIST.length) return SAMPLE_LIST.slice(0, 1);
      return SAMPLE_LIST.slice(0, prev.length + 1);
    });
  };

  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Tool Call</h1>
        <p className="lede">
          The canonical card for a single tool invocation in an agent stream.
          State drives the icon and badge, input-streaming, input-available,
          output-available, output-error. Body slots auto-format records or
          accept a custom ReactNode.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="states">
          All states
        </H>
        <div className="example">
          <div className="example-stage flex flex-col gap-2">
            {ALL_STATES.map((state) => (
              <ToolCall
                key={state}
                name={`example_${state.replace("-", "_")}`}
                state={state}
                input={{ path: "src/index.ts" }}
                output={
                  state === "output-available"
                    ? { lines: 80 }
                    : undefined
                }
                errorText={
                  state === "output-error"
                    ? "Permission denied: src/secret.env"
                    : undefined
                }
                callId="call_abc123"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="custom-slot">
          Custom output slot
        </H>
        <p>
          When the body should be syntax-highlighted JSON, a diff, an image, or
          anything other than auto-formatted key:value rows, pass a ReactNode
          to <code>input</code> or <code>output</code>. Plain records are
          rendered with the built-in formatter; ReactNodes pass through.
        </p>
        <div className="example">
          <div className="example-stage">
            <ToolCall
              name="render_chart"
              state="output-available"
              defaultOpen
              input={{ kind: "bar", labels: ["A", "B", "C"], data: [3, 5, 2] }}
              output={
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <svg viewBox="0 0 60 30" className="h-12 w-full">
                    <rect x="2" y="12" width="14" height="18" fill="var(--primary)" />
                    <rect x="22" y="0" width="14" height="30" fill="var(--primary)" />
                    <rect x="42" y="18" width="14" height="12" fill="var(--primary)" />
                  </svg>
                </div>
              }
            />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="list">
          ToolCallList
        </H>
        <p>
          The chat-scrollback pattern: keep the latest call expanded, tuck
          completed prior calls under a single &quot;▸ N/M tool calls&quot;
          summary. Use this when many tools accumulate; drop down to plain{" "}
          <code>&lt;ToolCall&gt;</code> when each call deserves equal weight.
        </p>
        <div className="example">
          <div className="example-stage">
            <ToolCallList items={SAMPLE_LIST} />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="growing">
          Growing list
        </H>
        <p>
          As the stream advances and more tools complete, the latest stays in
          view while older ones collapse. Click <em>advance</em> to add the
          next item.
        </p>
        <div className="example">
          <div className="example-stage flex flex-col gap-3">
            <button
              type="button"
              onClick={advance}
              className="self-start rounded-md border border-border bg-background px-3 py-1 text-xs hover:bg-muted"
            >
              advance ({growing.length}/{SAMPLE_LIST.length})
            </button>
            <ToolCallList items={growing} />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<ToolCall
  name="read_file"
  state="output-available"
  input={{ path: "src/index.ts" }}
  output={{ lines: 80 }}
  callId="call_abc123"
/>

<ToolCallList
  items={[
    { id: "a", name: "list_dir", state: "output-available", output: { entries: 14 } },
    { id: "b", name: "read_file", state: "input-streaming", input: { path: "x" } },
  ]}
/>`}</CodeBlock>
      </div>
    </>
  );
}
