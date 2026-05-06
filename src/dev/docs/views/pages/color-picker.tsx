import { useState } from "react";
import { ColorPicker, ColorPickerPopover } from "@weekend/design/registry";
import { CodeBlock, CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageColorPicker(): React.JSX.Element {
  const [color, setColor] = useState<string>("#6B97FF");
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Color Picker</h1>
        <p className="lede">
          Full-spectrum color picker with HSV square, hue/alpha sliders, format dropdown
          (HEX/RGB/HSL/OKLCH), per-channel scrubbable inputs, eyedropper, and optional swatches.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Inline panel
        </H>
        <div className="example">
          <div className="example-stage" style={{ flexDirection: "column", gap: 16 }}>
            <ColorPicker value={color} onValueChange={(next) => setColor(next)} />
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Selected: <CodeInline>{color}</CodeInline>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="popover">
          Popover trigger
        </H>
        <div className="example">
          <div className="example-stage" style={{ flexDirection: "column", gap: 16 }}>
            <ColorPickerPopover
              value={color}
              onValueChange={(next) => setColor(next)}
              triggerLabel="Fill"
              triggerLabelPosition="left"
            />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`const [color, setColor] = useState("#6B97FF");
<ColorPicker value={color} onValueChange={setColor} />

// Or as a popover trigger:
<ColorPickerPopover value={color} onValueChange={setColor} triggerLabel="Fill" />`}</CodeBlock>
      </div>
    </>
  );
}
