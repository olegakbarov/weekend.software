import { Callout } from "../../components/callout";
import { CodeBlock, CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageInstallation(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Getting started</div>
        <h1>Installation</h1>
        <p className="lede">
          Add Fluid Functionalism to a Next.js or Vite project. Three steps. The CLI does the
          work.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="prerequisites">
          Prerequisites
        </H>
        <p>
          You need a project with shadcn/ui already initialized — Tailwind v4, the{" "}
          <CodeInline>cn</CodeInline> helper, and a registered{" "}
          <CodeInline>components/ui</CodeInline> directory.
        </p>
        <Callout>
          <strong>Don't have shadcn yet?</strong> Run{" "}
          <CodeInline>npx shadcn@latest init</CodeInline> first. The Fluid registry layers on top
          — it doesn't replace it.
        </Callout>
      </div>

      <div className="section">
        <H as="h2" id="step-1">
          1 · Add the registry
        </H>
        <p>
          Register Fluid as a remote source in your <CodeInline>components.json</CodeInline>:
        </p>
        <CodeBlock lang="bash">npx shadcn@latest registry add @weekend</CodeBlock>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 8 }}>
          This appends an entry to <CodeInline>components.json</CodeInline> pointing at the Fluid
          registry. No further config needed.
        </p>
      </div>

      <div className="section">
        <H as="h2" id="step-2">
          2 · Install components
        </H>
        <p>
          Install only what you need. Source code lands in{" "}
          <CodeInline>components/ui/</CodeInline>:
        </p>
        <CodeBlock lang="bash">{`npx shadcn@latest add @weekend/button
npx shadcn@latest add @weekend/badge @weekend/switch @weekend/tabs`}</CodeBlock>
      </div>

      <div className="section">
        <H as="h2" id="step-3">
          3 · Use it
        </H>
        <CodeBlock lang="tsx">{`import { Button } from "@/components/ui/button";

export function Save() {
  return (
    <Button variant="primary" size="md">
      Save changes
    </Button>
  );
}`}</CodeBlock>
      </div>

      <div className="section">
        <H as="h2" id="theming">
          Theming
        </H>
        <p>
          Fluid reads from your existing CSS variables. If your{" "}
          <CodeInline>--background</CodeInline>, <CodeInline>--foreground</CodeInline>,{" "}
          <CodeInline>--accent</CodeInline>, etc. are already defined, the components inherit
          them. Nothing to override.
        </p>
        <p>The one Fluid-specific token you'll see is the variable font-weight axis:</p>
        <CodeBlock lang="css">{`:root {
  --fw-normal:   "wght" 400;
  --fw-medium:   "wght" 450;  /* lighter than typical */
  --fw-semibold: "wght" 550;  /* the hover target */
  --fw-bold:     "wght" 700;
}`}</CodeBlock>
      </div>

      <div className="section">
        <H as="h2" id="font">
          Font setup
        </H>
        <p>
          The hover-weight transition needs a variable font. Inter Variable is the canonical
          choice:
        </p>
        <CodeBlock lang="css">{`@font-face {
  font-family: "Inter";
  src: url("/fonts/InterVariable.ttf") format("truetype-variations");
  font-weight: 100 900;
  font-display: swap;
}`}</CodeBlock>
        <Callout kind="alert">
          <strong>Without a variable font</strong>, hover transitions will jump between discrete
          weights instead of interpolating. The interaction still works — it just loses the
          smooth feel.
        </Callout>
      </div>
    </>
  );
}
