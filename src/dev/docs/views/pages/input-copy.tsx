import { InputCopy } from "@weekend/design/registry";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageInputCopy(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Input Copy</h1>
        <p className="lede">
          A read-only value with a copy-to-clipboard button. Both icon-only and labelled variants;
          click the icon and watch the SVG path draw itself.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example-icon">
          Icon variant
        </H>
        <div className="example">
          <div className="example-stage">
            <div style={{ width: 360 }}>
              <InputCopy
                value="npx shadcn@latest registry add @weekend"
                label="Install"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="example-button">
          Button variant
        </H>
        <div className="example">
          <div className="example-stage">
            <div style={{ width: 360 }}>
              <InputCopy
                value="ghp_xxxxxxxxxxxxxxxxxxxxxxxx1234"
                label="Personal access token"
                variant="button"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<InputCopy
  value="npx shadcn@latest add @weekend/button"
  label="Install"
  variant="icon"
/>`}</CodeBlock>
      </div>
    </>
  );
}
