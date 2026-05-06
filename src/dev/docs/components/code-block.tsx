import { useState } from "react";
import { Icon } from "./icon";

interface CodeBlockProps {
  /** Language hint — informational only; no syntax highlighting yet. */
  lang?: "jsx" | "tsx" | "ts" | "js" | "bash" | "css" | "html";
  children: string;
}

export function CodeBlock({ children, lang: _lang = "jsx" }: CodeBlockProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const onCopy = (): void => {
    if (!navigator.clipboard) return;
    navigator.clipboard
      .writeText(children)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => {
        // ignore clipboard rejection
      });
  };

  return (
    <div className="code-block">
      <button
        type="button"
        className="copy-btn"
        onClick={onCopy}
        data-copied={copied ? true : undefined}
        aria-label="Copy code"
      >
        <Icon name={copied ? "check" : "copy"} size={13} />
      </button>
      <pre>{children}</pre>
    </div>
  );
}

export function CodeInline({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <code className="code-inline">{children}</code>;
}
