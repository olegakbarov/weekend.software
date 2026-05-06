import {
  ThinkingStep,
  ThinkingStepSource,
  ThinkingStepSources,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from "@weekend/design/registry";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageThinkingSteps(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Thinking Steps</h1>
        <p className="lede">
          A step-by-step reasoning trace inside an accordion. Each step animates open with a soft
          spring; sources fade in as colored badges.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage">
            <ThinkingSteps>
              <ThinkingStepsHeader>Researching</ThinkingStepsHeader>
              <ThinkingStepsContent>
                <ThinkingStep
                  label="Searching the web"
                  description="Found 12 results for the query."
                  status="complete"
                />
                <ThinkingStep
                  label="Reading source articles"
                  description="Skimmed three top-ranked sources."
                  status="complete"
                >
                  <ThinkingStepSources>
                    <ThinkingStepSource color="blue">npmjs.com</ThinkingStepSource>
                    <ThinkingStepSource color="green">github.com</ThinkingStepSource>
                    <ThinkingStepSource color="amber">vercel.com</ThinkingStepSource>
                  </ThinkingStepSources>
                </ThinkingStep>
                <ThinkingStep
                  label="Synthesizing"
                  status="active"
                  isLast
                />
              </ThinkingStepsContent>
            </ThinkingSteps>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<ThinkingSteps>
  <ThinkingStepsHeader>Reasoning</ThinkingStepsHeader>
  <ThinkingStepsContent>
    <ThinkingStep label="Reading docs" status="complete" />
    <ThinkingStep label="Drafting" status="active" isLast />
  </ThinkingStepsContent>
</ThinkingSteps>`}</CodeBlock>
      </div>
    </>
  );
}
