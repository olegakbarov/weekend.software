import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@weekend/design/registry";
import { CodeBlock, CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageDropdown(): React.JSX.Element {
  const [v, setV] = useState("");
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Dropdown</h1>
        <p className="lede">
          A general-purpose dropdown for menus and pickers. Powered by the same Select primitive,
          composed how you need.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage">
            <Select value={v} onValueChange={setV}>
              <SelectTrigger placeholder="Choose a workspace" />
              <SelectContent>
                <SelectItem value="acme">Acme HQ</SelectItem>
                <SelectItem value="bridge">Bridgewater Studio</SelectItem>
                <SelectItem value="crescent">Crescent Labs</SelectItem>
                <SelectItem value="drift" disabled>
                  Drift Co (suspended)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="note">
          Relationship to Select
        </H>
        <p>
          The Dropdown and <CodeInline>Select</CodeInline> share the same primitive. Convention:
          use Select for form data binding (a single chosen value), Dropdown for action menus
          (each item triggers a side effect). The component is identical; the wrapper communicates
          intent.
        </p>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<Select value={value} onValueChange={setValue}>
  <SelectTrigger placeholder="Pick" />
  <SelectContent>
    <SelectItem value="a">Action one</SelectItem>
    <SelectItem value="b">Action two</SelectItem>
  </SelectContent>
</Select>`}</CodeBlock>
      </div>
    </>
  );
}
