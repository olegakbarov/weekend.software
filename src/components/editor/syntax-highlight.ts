import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { tags as t } from "@lezer/highlight";

/**
 * Weekend's syntax highlight style. Maps Lezer tags to CSS variables defined
 * in tokens.css (--syntax-*). Each variable defaults to a fluid color token
 * but can be overridden per-theme by setting :root[data-theme="..."]
 * { --syntax-keyword: ... } in the consumer's stylesheet.
 *
 * Works in both light and dark themes — the colors live in CSS so the
 * cascade picks the right ones automatically.
 */
const weekendHighlightStyle = HighlightStyle.define([
  // Keywords + control flow
  { tag: [t.keyword, t.controlKeyword, t.modifier, t.self], color: "var(--syntax-keyword)" },
  { tag: [t.operatorKeyword, t.definitionKeyword], color: "var(--syntax-keyword)" },

  // Strings + special strings
  { tag: [t.string, t.special(t.string), t.character], color: "var(--syntax-string)" },
  { tag: t.escape, color: "var(--syntax-regexp)" },
  { tag: t.regexp, color: "var(--syntax-regexp)" },

  // Numbers + booleans + null
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--syntax-number)" },

  // Comments
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--syntax-comment)", fontStyle: "italic" },

  // Functions + methods
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: "var(--syntax-function)" },

  // Variables + properties
  { tag: [t.variableName, t.propertyName, t.labelName], color: "var(--syntax-variable)" },
  { tag: [t.definition(t.variableName), t.definition(t.propertyName)], color: "var(--syntax-variable)" },

  // Types + classes + namespaces
  { tag: [t.typeName, t.className, t.namespace], color: "var(--syntax-type)" },

  // JSX/HTML tags + attributes
  { tag: [t.tagName, t.angleBracket], color: "var(--syntax-tag)" },
  { tag: [t.attributeName, t.attributeValue], color: "var(--syntax-attribute)" },

  // Operators + punctuation
  { tag: [t.operator, t.compareOperator, t.logicOperator, t.arithmeticOperator, t.bitwiseOperator], color: "var(--syntax-punctuation)" },
  { tag: [t.punctuation, t.separator, t.bracket, t.brace, t.paren, t.squareBracket], color: "var(--syntax-punctuation)" },

  // Markdown / docs
  { tag: t.heading, color: "var(--syntax-heading)", fontWeight: "bold" },
  { tag: t.heading1, color: "var(--syntax-heading)", fontWeight: "bold" },
  { tag: t.heading2, color: "var(--syntax-heading)", fontWeight: "bold" },
  { tag: t.heading3, color: "var(--syntax-heading)", fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.link, t.url], color: "var(--syntax-link)", textDecoration: "underline" },

  // Misc
  { tag: t.invalid, color: "var(--destructive)" },
  { tag: t.meta, color: "var(--syntax-comment)" },
]);

export const weekendSyntaxHighlighting: Extension = syntaxHighlighting(weekendHighlightStyle);
