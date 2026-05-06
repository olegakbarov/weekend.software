import {
  FileTree,
  prepareFileTreeInput,
  useFileTree,
} from "@weekend/design/registry";
import { CodeBlock, CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

const PATHS: ReadonlyArray<string> = [
  "src/components/Button.tsx",
  "src/components/Card.tsx",
  "src/utils.ts",
  "package.json",
  "README.md",
];

const PREPARED_INPUT = prepareFileTreeInput(PATHS);

function Demo(): React.JSX.Element {
  const { model } = useFileTree({
    initialExpansion: "open",
    preparedInput: PREPARED_INPUT,
  });
  return (
    <div
      style={{
        width: 320,
        height: 280,
        border: "1px solid var(--border)",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <FileTree model={model} style={{ height: "100%" }} />
    </div>
  );
}

export function PageFileTree(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>File Tree</h1>
        <p className="lede">
          Path-first virtualized file tree, re-exported from{" "}
          <CodeInline>@pierre/trees</CodeInline>. The component renders inside a shadow root and
          ships its own styles, so no CSS import is required on the consumer side.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <p>
          Build a paths array, hand it to <CodeInline>prepareFileTreeInput</CodeInline>, then pass
          the result to <CodeInline>useFileTree</CodeInline>. The hook returns{" "}
          <CodeInline>{"{ model }"}</CodeInline>; render <CodeInline>{"<FileTree model={...} />"}</CodeInline>{" "}
          inside a sized container.
        </p>
        <div className="example">
          <div className="example-stage">
            <Demo />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`import {
  FileTree,
  prepareFileTreeInput,
  useFileTree,
} from "@weekend/design/registry";

const PATHS = [
  "src/components/Button.tsx",
  "src/components/Card.tsx",
  "src/utils.ts",
  "package.json",
  "README.md",
];

const preparedInput = prepareFileTreeInput(PATHS);

export function ProjectTree() {
  const { model } = useFileTree({
    initialExpansion: "open",
    preparedInput,
  });
  return (
    <div style={{ height: 280 }}>
      <FileTree model={model} style={{ height: "100%" }} />
    </div>
  );
}`}</CodeBlock>
      </div>

      <div className="section">
        <H as="h2" id="api">
          API
        </H>
        <p>Re-exports from <CodeInline>@pierre/trees/react</CodeInline> (component + hooks):</p>
        <ul>
          <li>
            <CodeInline>FileTree</CodeInline> — renders the tree. Takes a{" "}
            <CodeInline>model</CodeInline>, optional <CodeInline>header</CodeInline>, and an
            optional <CodeInline>renderContextMenu</CodeInline>.
          </li>
          <li>
            <CodeInline>useFileTree(options)</CodeInline> — creates the model. Accepts{" "}
            <CodeInline>paths</CodeInline> or <CodeInline>preparedInput</CodeInline>, plus
            options like <CodeInline>initialExpansion</CodeInline>, <CodeInline>search</CodeInline>,{" "}
            <CodeInline>density</CodeInline>, <CodeInline>icons</CodeInline>,{" "}
            <CodeInline>gitStatus</CodeInline>, <CodeInline>onSelectionChange</CodeInline>.
          </li>
          <li>
            <CodeInline>useFileTreeSelection(model)</CodeInline> — reactive snapshot of selected
            paths.
          </li>
          <li>
            <CodeInline>useFileTreeSelector(model, selector, isEqual?)</CodeInline> — subscribe
            to a derived slice of model state.
          </li>
          <li>
            <CodeInline>useFileTreeSearch(model)</CodeInline> — open / close / drive the
            built-in search overlay.
          </li>
        </ul>
        <p>And from the root entry of <CodeInline>@pierre/trees</CodeInline>:</p>
        <ul>
          <li>
            <CodeInline>prepareFileTreeInput(paths, options?)</CodeInline> — sort + dedupe paths
            once, off the render path. Use this when you start from raw input.
          </li>
          <li>
            <CodeInline>preparePresortedFileTreeInput(paths)</CodeInline> — same idea, skipping
            the sort step when the input order is already canonical.
          </li>
        </ul>
      </div>

      <div className="section">
        <H as="h2" id="notes">
          Notes
        </H>
        <ul>
          <li>
            The tree must live inside a sized container — give the wrapper a fixed{" "}
            <CodeInline>height</CodeInline> (or a flex parent) and pass{" "}
            <CodeInline>{'style={{ height: "100%" }}'}</CodeInline> through.
          </li>
          <li>
            Styles are encapsulated in a shadow root. Theme via the{" "}
            <CodeInline>themeToTreeStyles</CodeInline> helper or pass a <CodeInline>style</CodeInline>{" "}
            object with the documented CSS custom properties.
          </li>
          <li>
            The library bundles Preact internally; we externalize{" "}
            <CodeInline>@pierre/*</CodeInline> from the design build so consumers pull a single
            copy from npm.
          </li>
        </ul>
      </div>
    </>
  );
}
