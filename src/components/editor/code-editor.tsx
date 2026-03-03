import { useEffect, useRef } from "react";
import { EditorView, keymap, type KeyBinding } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
import { indentWithTab, redo, undo } from "@codemirror/commands";
import type { Extension } from "@codemirror/state";
import { vim, getCM, Vim } from "@replit/codemirror-vim";
import { useTheme } from "@/components/theme/use-theme";

export type VimMode = "insert" | "normal" | "visual" | "replace";

function languageExtensionForPath(filePath: string): Extension[] {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "js":
    case "jsx":
      return [javascript({ jsx: true })];
    case "ts":
    case "tsx":
      return [javascript({ jsx: true, typescript: true })];
    case "json":
      return [json()];
    case "html":
    case "htm":
      return [html()];
    case "css":
      return [css()];
    case "md":
    case "mdx":
      return [markdown()];
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
  const { resolvedMode } = useTheme();
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

    const state = EditorState.create({
      doc: content,
      extensions: [
        ...(isVimModeEnabled ? [vim()] : []),
        basicSetup,
        Prec.highest(
          keymap.of([
            indentWithTab,
            saveBinding,
            undoBinding,
            redoBinding,
            redoFallbackBinding,
          ])
        ),
        ...(resolvedMode === "dark" ? [oneDark] : []),
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
            { dark: resolvedMode === "dark" }
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

    if (isVimModeEnabled) {
      const cm = getCM(view);
      if (cm) {
        cm.on(
          "vim-mode-change",
          (info: { mode: string; subMode?: string }) => {
            onVimModeChangeRef.current?.(
              info.mode as VimMode,
              info.subMode
            );
          }
        );
      }
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Re-create editor when file or vim mode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, content, isVimModeEnabled, resolvedMode]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}
