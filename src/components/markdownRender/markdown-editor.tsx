import { cn } from "@/lib/utils";
import { useLocalGenerationInputHistory } from "@/utils/local-storage";
import { CompletionContext, CompletionResult, autocompletion } from "@codemirror/autocomplete";
// import { createHistoryCompletionSource, historyExtension } from "./codemirror-history";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { Prec } from "@codemirror/state";
import { EditorView, keymap, tooltips } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
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

/**
 * Creates a CodeMirror keymap extension for handling send shortcuts
 * This integrates directly with CodeMirror's event system for reliable keyboard handling
 */
const createSendShortcutKeymap = (
  sendShortcut: string | undefined,
  onSubmit: ((text: string) => void) | undefined,
  editorRef: React.MutableRefObject<EditorView | null>,
) => {
  if (!sendShortcut || !onSubmit) {
    return [];
  }

  const keyBindings: { key: string; run: () => boolean }[] = [];

  switch (sendShortcut) {
    case "Enter": {
      keyBindings.push({
        key: "Enter",
        run: () => {
          const currentContent = editorRef.current?.state.doc.toString() || "";
          onSubmit(currentContent);
          return true; // Prevent default behavior
        },
      });
      break;
    }
    case "Ctrl+Enter": {
      keyBindings.push({
        key: "Ctrl-Enter",
        run: () => {
          const currentContent = editorRef.current?.state.doc.toString() || "";
          onSubmit(currentContent);
          return true;
        },
      });
      break;
    }
    case "CMD+Enter": {
      keyBindings.push({
        key: "Cmd-Enter",
        run: () => {
          const currentContent = editorRef.current?.state.doc.toString() || "";
          onSubmit(currentContent);
          return true;
        },
      });
      // Also add Ctrl-Enter for cross-platform compatibility
      keyBindings.push({
        key: "Ctrl-Enter",
        run: () => {
          const currentContent = editorRef.current?.state.doc.toString() || "";
          onSubmit(currentContent);
          return true;
        },
      });
      break;
    }
    case "Shift+Enter": {
      keyBindings.push({
        key: "Shift-Enter",
        run: () => {
          const currentContent = editorRef.current?.state.doc.toString() || "";
          onSubmit(currentContent);
          return true;
        },
      });
      break;
    }
  }

  // Use highest precedence to ensure our shortcuts take priority over default keymaps
  return Prec.highest(keymap.of(keyBindings));
};

/**
 * I probably should have integrated CodeMirror directly.
 */
export const MarkdownEditor = forwardRef<MarkdownEditorRef, MDXEditorProps>(
  (
    {
      initialValue = "",
      enableHistory = false,
      onChange,
      className,
      placeholder,
      sendShortcut,
      onSubmit,
      suggestions = [],
      editable = true,
      autofocus = false,
    },
    ref,
  ) => {
    const editorRef = useRef<EditorView | null>(null);
    const isInitialMount = useRef(true);
    const isUserEditing = useRef(false);
    const [generationInputHistory] = useLocalGenerationInputHistory();

    // Create the send shortcut keymap extension
    const sendShortcutKeymap = useMemo(() => createSendShortcutKeymap(sendShortcut, onSubmit, editorRef), [sendShortcut, onSubmit]);

    // Create the custom completion source function using provided suggestions
    const createCompletionSource = useCallback((suggestions: SuggestionItem[]) => {
      return (context: CompletionContext): CompletionResult | null => {
        // Look for content within "{{ ... }}" pattern
        const curlyBraceMatch = context.matchBefore(/\{\{\s*(\w*)$/);

        // Only trigger completions if we're inside a {{ ... }} expression
        if (!curlyBraceMatch) {
          return null;
        }

        // Get the current word being typed inside the braces
        const currentWord = curlyBraceMatch.text.match(/\{\{\s*(\w*)$/)?.[1] || "";

        // Get position where the word starts (after {{ and any whitespace)
        const wordStartPos = curlyBraceMatch.from + curlyBraceMatch.text.length - currentWord.length;

        // Transform SuggestionItems to CodeMirror completion format
        const options = suggestions.map((item) => ({
          label: item.title,
          section: item.section,
          detail: item.description,
          type: item.type || "variable",
        }));

        return {
          from: wordStartPos,
          options,
          // Valid as long as we're still within a {{ ... }} expression and haven't closed it
          validFor: /^[\w.]*(?!\}\})$/,
        };
      };
    }, []);

    // Only sync from props on mount or when initialValue changes and user is not actively editing
    useEffect(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      // Only update if the user is NOT editing
      // Ensure editorRef.current is an EditorView instance before calling dispatch
      if (
        !isUserEditing.current &&
        initialValue !== editorRef.current?.state?.doc.toString() &&
        editorRef.current &&
        typeof (editorRef.current as any).dispatch === "function"
      ) {
        const view = editorRef.current;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: initialValue },
        });
      }
    }, [initialValue]);

    const handleChange = (value: string) => {
      isUserEditing.current = true;
      onChange?.(value);
      // setShowPlaceholder(!value.trim());
      // debouncedOnChange(value);

      // Reset the editing flag after a short delay
      setTimeout(() => {
        isUserEditing.current = false;
      }, 50);
    };

    const completionSource = createCompletionSource(suggestions);

    useImperativeHandle(ref, () => ({
      focus: () => {
        if (editorRef.current) {
          editorRef.current.focus();
        }
      },
    }));

    return (
      <CodeMirror
        autoFocus={autofocus}
        value={initialValue}
        editable={editable}
        extensions={[
          markdownFormatKeymap,
          tooltips({ parent: document.body }),
          markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }),
          highlightBracketsExtension(),
          EditorView.lineWrapping,
          autocompletion({
            override: enableHistory ? [completionSource, createHistoryCompletionSource(generationInputHistory)] : [completionSource],
            defaultKeymap: true,
            aboveCursor: true,
            maxRenderedOptions: 10,
            tooltipClass: () => {
              return "custom-tooltip";
            },
          }),
          ...(enableHistory ? [historyExtension(generationInputHistory)] : []),
          // Add the send shortcut keymap extension
          sendShortcutKeymap,
        ]}
        onChange={handleChange}
        onCreateEditor={(editor) => {
          editorRef.current = editor;
        }}
        height="100%"
        placeholder={placeholder}
        className={cn("prose text-xs ring-1 ring-border rounded-md input-fields font-mono overflow-auto flex-1", className)}
        theme={narratrixCodeMirror}
        // style={{ minHeight, maxHeight, overflow: "auto" }}
      />
    );
  },
);

MarkdownEditor.displayName = "MarkdownEditor";
