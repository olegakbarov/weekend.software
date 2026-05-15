import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@weekend/design/registry";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageAccordion(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Accordion</h1>
        <p className="lede">
          Spring-animated collapsible content built on Radix Accordion. Single or multiple items
          can be open at once.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <Accordion type="single" collapsible defaultValue="a">
              <AccordionItem value="a">
                <AccordionTrigger>What's a design token?</AccordionTrigger>
                <AccordionContent>
                  A named, reusable design decision, a color, a radius, a duration. Tokens give
                  the design system one source of truth that components and apps reference.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="b" style={{ marginTop: 8 }}>
                <AccordionTrigger>Why springs over durations?</AccordionTrigger>
                <AccordionContent>
                  Springs adapt naturally to interruption. If a tooltip is mid-fade and you move
                  away, the exit picks up where the enter left off, not from the original anchor.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="c" style={{ marginTop: 8 }}>
                <AccordionTrigger>What about accessibility?</AccordionTrigger>
                <AccordionContent>
                  Built on Radix primitives, so all the keyboard and ARIA work is done. Focus is
                  managed, headers are buttons, and content regions are properly labeled.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<Accordion type="single" collapsible>
  <AccordionItem value="item-1">
    <AccordionTrigger>First question</AccordionTrigger>
    <AccordionContent>The answer.</AccordionContent>
  </AccordionItem>
</Accordion>`}</CodeBlock>
      </div>
    </>
  );
}
