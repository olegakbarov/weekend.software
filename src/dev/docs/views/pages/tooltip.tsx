import { Tooltip } from "@weekend/design/registry";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageTooltip(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Tooltip</h1>
        <p className="lede">
          Light wrapper over Radix Tooltip with our DS surface colors. Delay defaults to 300ms.
          Portaled, dismissable on Escape, repositions on collision.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage" style={{ gap: 24 }}>
            <Tooltip content="Click to copy">
              <button
                type="button"
                className="btn btn-tertiary"
                style={{ position: "relative", isolation: "isolate" }}
              >
                <span className="btn-bg" />
                Hover me
              </button>
            </Tooltip>
            <Tooltip content="Permanently delete this item" side="bottom">
              <button
                type="button"
                className="btn btn-primary"
                style={{ position: "relative", isolation: "isolate" }}
              >
                <span className="btn-bg" />
                Bottom side
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<Tooltip content="Click to copy" side="top">
  <button>Hover me</button>
</Tooltip>`}</CodeBlock>
      </div>
    </>
  );
}
