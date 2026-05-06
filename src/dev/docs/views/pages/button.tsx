import { Button, IconButton } from "@weekend/design";
import { Heart, Plus } from "lucide-react";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageButton(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Button</h1>
        <p className="lede">
          Three variants, three sizes. Hover transitions weight (450 → 550) before color, letting
          the cursor's path preview the interaction without a hard state flip.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="variants">
          Variants
        </H>
        <div className="example">
          <div className="example-stage" style={{ gap: 8, flexWrap: "wrap" }}>
            <Button variant="primary">Primary</Button>
            <Button variant="tertiary">Tertiary</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="sizes">
          Sizes
        </H>
        <div className="example">
          <div className="example-stage" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Button size="sm">Small</Button>
            <Button>Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="icons">
          With icons
        </H>
        <div className="example">
          <div className="example-stage" style={{ gap: 8, flexWrap: "wrap" }}>
            <Button icon={Plus} variant="primary">
              New project
            </Button>
            <Button trailingIcon={Heart} variant="tertiary">
              Favorite
            </Button>
            <IconButton icon={Heart} label="Like" />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<Button variant="primary" size="md" onClick={save}>
  Save changes
</Button>
<IconButton icon={Heart} label="Like" />`}</CodeBlock>
      </div>
    </>
  );
}
