import { useState } from "react";
import { type BadgeColor, ColorPicker } from "@weekend/design/registry";
import { CodeBlock, CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageColorPicker(): React.JSX.Element {
  const [color, setColor] = useState<BadgeColor>("blue");
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Color Picker</h1>
        <p className="lede">
          A swatch grid for choosing one of the 17 design-system accent colors. Selected swatch
          gets a checkmark; the foreground color of the check adapts to the swatch's luminance.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage" style={{ flexDirection: "column", gap: 16 }}>
            <ColorPicker value={color} onChange={setColor} />
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              Selected: <CodeInline>{color}</CodeInline>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="note">
          Scope
        </H>
        <p>
          The legacy version is a 1,700-line custom picker with HSL sliders, hex input, and an
          eyedropper. This port covers the common 17-color swatch use case (Badge color, accent
          chip). The full picker can be added later as a separate component.
        </p>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`const [color, setColor] = useState<BadgeColor>("blue");
<ColorPicker value={color} onChange={setColor} />`}</CodeBlock>
      </div>
    </>
  );
}
