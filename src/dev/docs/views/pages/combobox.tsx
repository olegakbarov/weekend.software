import { useState } from "react";
import { Combobox, type ComboboxItem } from "@weekend/design/registry";
import { CodeBlock, CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

const AGENT_ITEMS: ReadonlyArray<ComboboxItem> = [
  { value: "claude", label: "Claude" },
  { value: "codex", label: "Codex" },
  { value: "gemini", label: "Gemini" },
];

const FRUITS: ReadonlyArray<ComboboxItem<"apple" | "banana" | "cherry" | "date">> = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
  { value: "date", label: "Date" },
];

export function PageCombobox(): React.JSX.Element {
  const [agent, setAgent] = useState("");
  const [fruit, setFruit] = useState<"apple" | "banana" | "cherry" | "date">("apple");
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Combobox</h1>
        <p className="lede">
          Trigger button + popover with a free-text input and a filterable preset list. Use it
          where the value is usually one of a known set but consumers may need to type any string
          — agent commands, branch names, file paths.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="free-text">
          Free text + presets
        </H>
        <p>
          The default. Typing in the input updates the external value as the user types; pressing
          Enter or clicking outside commits the typed string. Picking an item commits its{" "}
          <CodeInline>value</CodeInline>.
        </p>
        <div className="example">
          <div className="example-stage">
            <Combobox
              value={agent}
              onChange={setAgent}
              items={AGENT_ITEMS}
              placeholder="agent command"
            />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="preset-only">
          Preset only
        </H>
        <p>
          Pass <CodeInline>allowFreeText={"{false}"}</CodeInline> to lock the value to one of the
          provided items. The input then filters but cannot commit a custom string.
        </p>
        <div className="example">
          <div className="example-stage">
            <Combobox
              value={fruit}
              onChange={setFruit}
              items={FRUITS}
              allowFreeText={false}
              placeholder="Pick a fruit"
            />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`import { Combobox, type ComboboxItem } from "@weekend/design/registry";

const ITEMS: ReadonlyArray<ComboboxItem> = [
  { value: "claude", label: "Claude" },
  { value: "codex", label: "Codex" },
  { value: "gemini", label: "Gemini" },
];

const [value, setValue] = useState("");

<Combobox
  value={value}
  onChange={setValue}
  items={ITEMS}
  placeholder="agent command"
/>`}</CodeBlock>
      </div>

      <div className="section">
        <H as="h2" id="api">
          API
        </H>
        <ul>
          <li>
            <CodeInline>value</CodeInline> — current string value. Generic over{" "}
            <CodeInline>T extends string</CodeInline> so literal-union types narrow correctly.
          </li>
          <li>
            <CodeInline>onChange(next)</CodeInline> — fires on selection, and on every keystroke
            when <CodeInline>allowFreeText</CodeInline> is true (the default).
          </li>
          <li>
            <CodeInline>items</CodeInline> — preset list of{" "}
            <CodeInline>{"{ value, label }"}</CodeInline>. Filtered case-insensitively against the
            input as the user types.
          </li>
          <li>
            <CodeInline>allowFreeText</CodeInline> — default <CodeInline>true</CodeInline>. When
            false, only items.value can be committed.
          </li>
          <li>
            <CodeInline>popoverWidth</CodeInline> — pixel width of the popover panel. Defaults to
            280.
          </li>
        </ul>
      </div>
    </>
  );
}
