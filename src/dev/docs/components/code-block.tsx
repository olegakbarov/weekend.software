import { Code, CodeInline as DesignCodeInline } from "@weekend/design/registry";

interface CodeBlockProps {
  /** Language hint for syntax highlighting (e.g. "tsx", "json", "bash"). */
  lang?: string;
  children: string;
}

/**
 * Thin docs-site wrapper around the design system `<Code>` component.
 * Maps the historical `lang` prop to the canonical `language` prop so the
 * 30+ fluid docs pages don't need to be touched.
 */
export function CodeBlock({ children, lang = "tsx" }: CodeBlockProps): React.JSX.Element {
  return <Code language={lang}>{children}</Code>;
}

export function CodeInline({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <DesignCodeInline>{children}</DesignCodeInline>;
}
