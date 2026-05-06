import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@weekend/design/registry";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageSelect(): React.JSX.Element {
  const [value, setValue] = useState("");
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Select</h1>
        <p className="lede">
          A dropdown select with a portaled menu, spring-animated open, animated check on the
          chosen item, and full keyboard support.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage">
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger placeholder="Pick a strategy" />
              <SelectContent>
                <SelectItem value="hi-lo">Hi-Lo</SelectItem>
                <SelectItem value="hi-opt-1">Hi-Opt I</SelectItem>
                <SelectItem value="hi-opt-2">Hi-Opt II</SelectItem>
                <SelectItem value="ko">KO (Knock-Out)</SelectItem>
                <SelectItem value="omega-2">Omega II</SelectItem>
                <SelectItem value="red-7">Red 7</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<Select value={value} onValueChange={setValue}>
  <SelectTrigger placeholder="Pick one" />
  <SelectContent>
    <SelectItem value="apple">Apple</SelectItem>
    <SelectItem value="banana">Banana</SelectItem>
  </SelectContent>
</Select>`}</CodeBlock>
      </div>
    </>
  );
}
