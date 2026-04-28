import { autocompletion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { Compartment, Extension, Prec } from "@codemirror/state";
import { EditorView, keymap, tooltips } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { useLocalGenerationInputHistory } from "@/utils/local-storage";
import { highlightBracketsExtension } from "./extensions/codemirror-highlight-brackets";
import { createHistoryCompletionSource, historyExtension } from "./extensions/codemirror-history";
import { markdownFormatKeymap } from "./extensions/markdown-format-keymap";
import { SuggestionItem } from "./markdown-textarea";
import { narratrixCodeMirror } from "./styles/narratrix-codemirror-theme";

export interface MDXEditorProps {
  initialValue?: string;
  onChange?: (content: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  sendShortcut?: "Enter" | "Ctrl+Enter" | "Shift+Enter" | "CMD+Enter";
  onSubmit?: (text: string) => void;
  suggestions?: SuggestionItem[];
  enableHistory?: boolean;
  editable?: boolean;
  autofocus?: boolean;
}

export interface MarkdownEditorRef {
  focus: () => void;
}

const EMPTY_SUGGESTIONS: SuggestionItem[] = [];

// Truly static extensions — built once at module load, shared across every editor instance.
const STATIC_EXTENSIONS: Extension[] = [
  markdownFormatKeymap,
  tooltips({ parent: document.body }),
  markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }),
  highlightBracketsExtension(),
  EditorView.lineWrapping,
];

function buildSendShortcutKeymap(sendShortcut: string | undefined, onSubmit: ((text: string) => void) | undefined): Extension {
  if (!sendShortcut || !onSubmit) {
    return [];
  }

  const run = (view: EditorView) => {
    onSubmit(view.state.doc.toString());
    return true;
  };

  switch (sendShortcut) {
    case "Enter":
      return Prec.highest(keymap.of([{ key: "Enter", run }]));
    case "Ctrl+Enter":
      return Prec.highest(keymap.of([{ key: "Ctrl-Enter", run }]));
    case "CMD+Enter":
      return Prec.highest(
        keymap.of([
          { key: "Cmd-Enter", run },
          { key: "Ctrl-Enter", run },
        ]),
      );
    case "Shift+Enter":
      return Prec.highest(keymap.of([{ key: "Shift-Enter", run }]));
    default:
      return [];
  }
}

function buildCompletionSource(suggestions: SuggestionItem[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const curlyBraceMatch = context.matchBefore(/\{\{\s*(\w*)$/);
    if (!curlyBraceMatch) {
      return null;
    }

    const currentWord = curlyBraceMatch.text.match(/\{\{\s*(\w*)$/)?.[1] || "";
    const wordStartPos = curlyBraceMatch.from + curlyBraceMatch.text.length - currentWord.length;

    const options = suggestions.map((item) => ({
      label: item.title,
      section: item.section,
      detail: item.description,
      type: item.type || "variable",
    }));

    return {
      from: wordStartPos,
      options,
      validFor: /^[\w.]*(?!\}\})$/,
    };
  };
}

function buildAutocompletionExtension(suggestions: SuggestionItem[], enableHistory: boolean, history: string[]): Extension {
  const completionSource = buildCompletionSource(suggestions);
  return autocompletion({
    override: enableHistory ? [completionSource, createHistoryCompletionSource(history)] : [completionSource],
    defaultKeymap: true,
    aboveCursor: true,
    maxRenderedOptions: 10,
    tooltipClass: () => "custom-tooltip",
  });
}

/**
 * I probably should have integrated CodeMirror directly.
 */
export const MarkdownEditor = forwardRef<MarkdownEditorRef, MDXEditorProps>(
  ({ initialValue = "", enableHistory = false, onChange, className, placeholder, sendShortcut, onSubmit, suggestions = EMPTY_SUGGESTIONS, editable = true, autofocus = false }, ref) => {
    const editorRef = useRef<EditorView | null>(null);
    const isInitialMount = useRef(true);
    const isUserEditing = useRef(false);
    const [generationInputHistory] = useLocalGenerationInputHistory();

    // Compartments isolate dynamic slices so reconfiguring one (e.g. shortcut change)
    // doesn't tear down the whole editor — view plugins, gutters, scroll state are preserved.
    const keymapCompartment = useRef(new Compartment()).current;
    const autocompleteCompartment = useRef(new Compartment()).current;
    const historyCompartment = useRef(new Compartment()).current;

    // Built once per editor instance. Compartments below carry the dynamic slices,
    // so a stale array reference here is intentional — reconfigures go through dispatch.
    // biome-ignore lint/correctness/useExhaustiveDependencies: compartments handle dynamic updates
    const extensions = useMemo<Extension[]>(
      () => [
        ...STATIC_EXTENSIONS,
        keymapCompartment.of(buildSendShortcutKeymap(sendShortcut, onSubmit)),
        autocompleteCompartment.of(buildAutocompletionExtension(suggestions, enableHistory, generationInputHistory)),
        historyCompartment.of(enableHistory ? historyExtension(generationInputHistory) : []),
      ],
      [],
    );

    useEffect(() => {
      const view = editorRef.current;
      if (!view) {
        return;
      }
      view.dispatch({
        effects: keymapCompartment.reconfigure(buildSendShortcutKeymap(sendShortcut, onSubmit)),
      });
    }, [sendShortcut, onSubmit, keymapCompartment]);

    useEffect(() => {
      const view = editorRef.current;
      if (!view) {
        return;
      }
      view.dispatch({
        effects: autocompleteCompartment.reconfigure(buildAutocompletionExtension(suggestions, enableHistory, generationInputHistory)),
      });
    }, [suggestions, enableHistory, generationInputHistory, autocompleteCompartment]);

    useEffect(() => {
      const view = editorRef.current;
      if (!view) {
        return;
      }
      view.dispatch({
        effects: historyCompartment.reconfigure(enableHistory ? historyExtension(generationInputHistory) : []),
      });
    }, [enableHistory, generationInputHistory, historyCompartment]);

    // Sync external value changes when the user is not actively editing.
    useEffect(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      const view = editorRef.current;
      if (!view || isUserEditing.current) {
        return;
      }
      if (initialValue !== view.state.doc.toString()) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: initialValue },
        });
      }
    }, [initialValue]);

    const handleChange = (value: string) => {
      isUserEditing.current = true;
      onChange?.(value);
      setTimeout(() => {
        isUserEditing.current = false;
      }, 50);
    };

    useImperativeHandle(ref, () => ({
      focus: () => {
        editorRef.current?.focus();
      },
    }));

    return (
      <CodeMirror
        autoFocus={autofocus}
        value={initialValue}
        editable={editable}
        extensions={extensions}
        onChange={handleChange}
        onCreateEditor={(editor) => {
          editorRef.current = editor;
        }}
        height="100%"
        placeholder={placeholder}
        className={cn("prose max-w-none w-full min-w-0 text-xs ring-1 ring-border rounded-md input-fields font-mono overflow-auto flex-1", className)}
        theme={narratrixCodeMirror}
      />
    );
  },
);

MarkdownEditor.displayName = "MarkdownEditor";
