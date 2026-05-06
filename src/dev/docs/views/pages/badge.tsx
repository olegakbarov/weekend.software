import { Badge, BADGE_HEX, type BadgeColor } from "@weekend/design/registry";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

const COLORS = Object.keys(BADGE_HEX) as BadgeColor[];

export function PageBadge(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Badge</h1>
        <p className="lede">
          A small chip for status, count, or label. 17 colors, three sizes, two variants. The
          colored variants use a 15% mix with the card surface.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="colors">
          Colors
        </H>
        <div className="example">
          <div className="example-stage" style={{ flexWrap: "wrap", gap: 6 }}>
            {COLORS.map((c) => (
              <Badge key={c} color={c}>
                {c}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="variants">
          Variants
        </H>
        <div className="example">
          <div className="example-stage" style={{ gap: 12 }}>
            <Badge color="blue">Solid</Badge>
            <Badge color="blue" variant="dot">
              Dot
            </Badge>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="sizes">
          Sizes
        </H>
        <div className="example">
          <div className="example-stage" style={{ gap: 8 }}>
            <Badge color="green" size="sm">
              Small
            </Badge>
            <Badge color="green" size="md">
              Medium
            </Badge>
            <Badge color="green" size="lg">
              Large
            </Badge>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<Badge color="blue">Pre-release</Badge>
<Badge color="green" variant="dot">Active</Badge>
<Badge color="amber" size="lg">12</Badge>`}</CodeBlock>
      </div>
    </>
  );
}
