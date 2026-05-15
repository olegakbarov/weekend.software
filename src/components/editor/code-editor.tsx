import { useEffect, useRef } from "react";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
  type KeyBinding,
} from "@codemirror/view";
import { EditorState, Prec, type Extension } from "@codemirror/state";
import { weekendSyntaxHighlighting } from "./syntax-highlight";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  undo,
} from "@codemirror/commands";
import { vim, getCM, Vim } from "@replit/codemirror-vim";
import { useTheme } from "@/components/theme/use-theme";

export type VimMode = "insert" | "normal" | "visual" | "replace";

function languageExtensionForPath(filePath: string): Extension[] {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return [javascript({ jsx: true })];
    case "ts":
    case "tsx":
    case "mts":
    case "cts":
      return [javascript({ jsx: true, typescript: true })];
    case "json":
    case "jsonc":
      return [json()];
    case "html":
    case "htm":
      return [html()];
    case "css":
    case "scss":
    case "sass":
    case "less":
      return [css()];
    case "md":
    case "mdx":
    case "markdown":
      return [markdown()];
    case "py":
    case "pyi":
      return [python()];
    case "rs":
      return [rust()];
    case "yaml":
    case "yml":
      return [yaml()];
    case "xml":
    case "svg":
    case "plist":
      return [xml()];
    default:
      return [];
  }
}

export function CodeEditor({
  content,
  filePath,
  isVimModeEnabled,
  onChange,
  onSave,
  onVimModeChange,
}: {
  content: string;
  filePath: string;
  isVimModeEnabled: boolean;
  onChange: (content: string) => void;
  onSave: () => void;
  onVimModeChange?: (mode: VimMode, subMode?: string) => void;
}) {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onVimModeChangeRef = useRef(onVimModeChange);
  onVimModeChangeRef.current = onVimModeChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const lang = languageExtensionForPath(filePath);

    // Register ex commands so :w / :wq save the file
    Vim.defineEx("write", "w", () => {
      onSaveRef.current();
    });
    Vim.defineEx("wq", "wq", () => {
      onSaveRef.current();
    });

    const saveBinding: KeyBinding = {
      key: "Mod-s",
      run: () => {
        onSaveRef.current();
        return true;
      },
    };
    const undoBinding: KeyBinding = { key: "Mod-z", run: undo };
    const redoBinding: KeyBinding = { key: "Shift-Mod-z", run: redo };
    const redoFallbackBinding: KeyBinding = { key: "Mod-y", run: redo };
    const baseExtensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
    ];

    const state = EditorState.create({
      doc: content,
      extensions: [
        ...(isVimModeEnabled ? [vim()] : []),
        ...baseExtensions,
        Prec.highest(
          keymap.of([
            saveBinding,
            undoBinding,
            redoBinding,
            redoFallbackBinding,
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
          ])
        ),
        weekendSyntaxHighlighting,
        Prec.highest(
          EditorView.theme(
            {
              "&": {
                height: "100%",
                fontSize: "15px",
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
              },
              ".cm-scroller": {
                overflow: "auto",
                backgroundColor: "var(--background)",
                fontFamily: "var(--font-mono)",
              },
              ".cm-content": {
                caretColor: "var(--foreground)",
                backgroundColor: "var(--background)",
              },
              ".cm-gutters": {
                backgroundColor: "var(--background)",
                borderRight: "1px solid var(--border)",
                color: "var(--muted-foreground)",
              },
              ".cm-cursor, .cm-dropCursor": {
                borderLeftColor: "var(--foreground)",
              },
            },
            { dark: isDark }
          )
        ),
        EditorView.baseTheme({
          ".cm-activeLine, .cm-activeLineGutter": {
            backgroundColor:
              "color-mix(in oklab, var(--muted) 65%, transparent)",
          },
          ".cm-selectionBackground, .cm-content ::selection": {
            backgroundColor: "var(--text-highlight-selection)",
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        ...lang,
      ],
    });

    const view = new EditorView({ state, parent: container });
    viewRef.current = view;

    let removeVimModeListener: (() => void) | null = null;
    if (isVimModeEnabled) {
      const cm = getCM(view);
      if (cm) {
        const handleVimModeChange = (info: {
          mode: string;
          subMode?: string;
        }) => {
          onVimModeChangeRef.current?.(info.mode as VimMode, info.subMode);
        };
        cm.on("vim-mode-change", handleVimModeChange);
        removeVimModeListener = () => {
          cm.off("vim-mode-change", handleVimModeChange);
        };
      }
    }

    return () => {
      removeVimModeListener?.();
      view.destroy();
      viewRef.current = null;
    };
    // Re-create editor when file or vim mode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, content, isVimModeEnabled, isDark]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}
