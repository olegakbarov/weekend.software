import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@weekend/design/registry";
import { CodeBlock, CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageDialog(): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Dialog</h1>
        <p className="lede">
          Modal dialog built on Radix primitives. Springs control enter and exit, with the exit
          using the slightly slower preset so the dialog doesn't feel snatched.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ position: "relative", isolation: "isolate" }}
                >
                  <span className="btn-bg" />
                  Open dialog
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save changes?</DialogTitle>
                  <DialogDescription>
                    Your edits will be applied to the live document. This action can be undone
                    from the History menu within the next 24 hours.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setOpen(false)}
                    style={{ position: "relative", isolation: "isolate" }}
                  >
                    <span className="btn-bg" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setOpen(false)}
                    style={{ position: "relative", isolation: "isolate" }}
                  >
                    <span className="btn-bg" />
                    Save
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="example-meta">
            <span style={{ fontFamily: "var(--font-mono)" }}>
              springs.slow on enter / exit
            </span>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <p>
          Built on <CodeInline>@radix-ui/react-dialog</CodeInline>. Controlled or uncontrolled:
          pass <CodeInline>open</CodeInline> + <CodeInline>onOpenChange</CodeInline> to control
          externally, or omit them and use <CodeInline>DialogTrigger</CodeInline>.
        </p>
        <CodeBlock lang="tsx">{`import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@weekend/design/registry";

<Dialog>
  <DialogTrigger asChild>
    <button>Open</button>
  </DialogTrigger>
  <DialogContent size="sm">
    <DialogHeader>
      <DialogTitle>Save changes?</DialogTitle>
      <DialogDescription>This can be undone within 24 hours.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <button>Cancel</button>
      <button>Save</button>
    </DialogFooter>
  </DialogContent>
</Dialog>`}</CodeBlock>
      </div>

      <div className="section">
        <H as="h2" id="props">
          Props
        </H>
        <table className="props-table">
          <thead>
            <tr>
              <th>Prop</th>
              <th>Type</th>
              <th>Default</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="prop-name">open</td>
              <td>boolean</td>
              <td className="prop-default">None</td>
              <td>Controls visibility (controlled mode).</td>
            </tr>
            <tr>
              <td className="prop-name">onOpenChange</td>
              <td>(open: boolean) =&gt; void</td>
              <td className="prop-default">None</td>
              <td>Called when the open state changes.</td>
            </tr>
            <tr>
              <td className="prop-name">size</td>
              <td>"sm" | "lg"</td>
              <td className="prop-default">"sm"</td>
              <td>Max width, sm 400px, lg 540px. (DialogContent prop.)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
