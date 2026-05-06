import { useState } from "react";
import {
  CheckboxGroup,
  CheckboxItem,
  RadioGroup,
  RadioItem,
} from "@weekend/design/registry";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

const FRUITS = ["Apples", "Bananas", "Cherries", "Dates"];
const CADENCES = ["Daily", "Weekly", "Monthly"];

export function PageCheckboxRadio(): React.JSX.Element {
  const [checked, setChecked] = useState<Set<number>>(new Set([0, 1]));
  const [pickIdx, setPickIdx] = useState<number>(1);
  const [pickValue, setPickValue] = useState<string>("weekly");

  function toggle(i: number): void {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Checkbox & Radio</h1>
        <p className="lede">
          Vertical lists with proximity-hover, an animated focus ring, and animated check / dot
          marks. <code>CheckboxGroup</code> renders a single merged background for contiguous
          checked items; <code>RadioGroup</code> slides one selection background between rows.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="checkbox-group">
          CheckboxGroup
        </H>
        <p className="lede">
          Independent yes/no states. The parent owns selection (a <code>Set&lt;number&gt;</code>);
          each <code>CheckboxItem</code> reports toggles via <code>onToggle</code>. Try selecting
          adjacent rows — the selected backgrounds merge into one block.
        </p>
        <div className="example">
          <div className="example-stage" style={{ justifyContent: "flex-start" }}>
            <CheckboxGroup checkedIndices={checked}>
              {FRUITS.map((label, i) => (
                <CheckboxItem
                  key={label}
                  index={i}
                  label={label}
                  checked={checked.has(i)}
                  onToggle={() => toggle(i)}
                />
              ))}
            </CheckboxGroup>
          </div>
        </div>

        <H as="h3" id="checkbox-usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`import { CheckboxGroup, CheckboxItem } from "@weekend/design/registry";
import { useState } from "react";

const items = ["Apples", "Bananas", "Cherries", "Dates"];
const [checked, setChecked] = useState<Set<number>>(new Set([0]));

<CheckboxGroup checkedIndices={checked}>
  {items.map((label, i) => (
    <CheckboxItem
      key={label}
      index={i}
      label={label}
      checked={checked.has(i)}
      onToggle={() =>
        setChecked((prev) => {
          const next = new Set(prev);
          if (next.has(i)) next.delete(i);
          else next.add(i);
          return next;
        })
      }
    />
  ))}
</CheckboxGroup>`}</CodeBlock>

        <H as="h3" id="checkbox-api">
          API
        </H>
        <ul>
          <li>
            <code>CheckboxGroup</code> — required <code>checkedIndices: Set&lt;number&gt;</code>.
            Renders <code>role="group"</code> and owns the proximity-hover, focus-ring, and merged
            selection overlays.
          </li>
          <li>
            <code>CheckboxItem</code> — required <code>label</code>, <code>index</code>,{" "}
            <code>checked</code>, <code>onToggle</code>. Keyboard: Space/Enter toggle;
            Arrow/Home/End navigate.
          </li>
        </ul>
      </div>

      <div className="section">
        <H as="h2" id="radio-group">
          RadioGroup
        </H>
        <p className="lede">
          One-of-N selection. Two control modes: index-based ({" "}
          <code>selectedIndex</code> + <code>selected</code> + <code>onSelect</code>) or
          value-based (<code>value</code> + <code>onValueChange</code> + per-item{" "}
          <code>value</code>).
        </p>

        <H as="h3" id="radio-index">
          Index-based
        </H>
        <div className="example">
          <div className="example-stage" style={{ justifyContent: "flex-start" }}>
            <RadioGroup selectedIndex={pickIdx}>
              {CADENCES.map((label, i) => (
                <RadioItem
                  key={label}
                  index={i}
                  label={label}
                  selected={pickIdx === i}
                  onSelect={() => setPickIdx(i)}
                />
              ))}
            </RadioGroup>
          </div>
        </div>

        <H as="h3" id="radio-value">
          Value-based
        </H>
        <div className="example">
          <div className="example-stage" style={{ justifyContent: "flex-start" }}>
            <RadioGroup value={pickValue} onValueChange={setPickValue}>
              {CADENCES.map((label, i) => (
                <RadioItem
                  key={label}
                  index={i}
                  label={label}
                  value={label.toLowerCase()}
                />
              ))}
            </RadioGroup>
          </div>
        </div>

        <H as="h3" id="radio-usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`import { RadioGroup, RadioItem } from "@weekend/design/registry";
import { useState } from "react";

const options = ["Daily", "Weekly", "Monthly"];
const [selected, setSelected] = useState(1);

<RadioGroup selectedIndex={selected}>
  {options.map((label, i) => (
    <RadioItem
      key={label}
      index={i}
      label={label}
      selected={selected === i}
      onSelect={() => setSelected(i)}
    />
  ))}
</RadioGroup>`}</CodeBlock>

        <H as="h3" id="radio-api">
          API
        </H>
        <ul>
          <li>
            <code>RadioGroup</code> — accepts <code>selectedIndex</code> for the index-based mode,
            or <code>value</code> + <code>onValueChange</code> for the value-based mode. Renders{" "}
            <code>role="radiogroup"</code>.
          </li>
          <li>
            <code>RadioItem</code> — required <code>label</code> and <code>index</code>; either{" "}
            <code>selected</code> + <code>onSelect</code> (index mode) or <code>value</code>{" "}
            (value mode). Keyboard: Arrow/Home/End move + select; Space/Enter select on focus.
            Roving <code>tabIndex</code> means only the currently selected row is in the tab
            order.
          </li>
        </ul>
      </div>
    </>
  );
}
