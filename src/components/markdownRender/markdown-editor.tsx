import { cn } from "@/lib/utils";
import { useLocalGenerationInputHistory } from "@/utils/local-storage";
import { CompletionContext, CompletionResult, autocompletion } from "@codemirror/autocomplete";
// import { createHistoryCompletionSource, historyExtension } from "./codemirror-history";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView, tooltips } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback, useEffect, useRef } from "react";
import { highlightBracketsExtension } from "./extensions/codemirror-highlight-brackets";
import { createHistoryCompletionSource } from "./extensions/codemirror-history";
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
}

/**
 * I probably should have integrated CodeMirror directly.
 */
export const MarkdownEditor = ({
  initialValue = "",
  enableHistory = false,
  onChange,
  className,
  label,
  placeholder,
  sendShortcut,
  onSubmit,
  suggestions = [],
}: MDXEditorProps) => {
  const editorRef = useRef<EditorView | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const isUserEditing = useRef(false);
  const [generationInputHistory] = useLocalGenerationInputHistory();
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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!onSubmit) {
        return;
      }

      const isCtrlEnter = e.key === "Enter" && (e.ctrlKey || e.metaKey);
      const isShiftEnter = e.key === "Enter" && e.shiftKey;
      const isEnter = e.key === "Enter" && !e.ctrlKey && !e.shiftKey && !e.metaKey;

      let shouldSubmit = false;

      switch (sendShortcut) {
        case "Enter": {
          shouldSubmit = isEnter;
          break;
        }
        case "Ctrl+Enter": {
          shouldSubmit = isCtrlEnter;
          break;
        }
        case "CMD+Enter": {
          shouldSubmit = isCtrlEnter;
          break;
        }
        case "Shift+Enter": {
          shouldSubmit = isShiftEnter;
          break;
        }
      }

      if (shouldSubmit) {
        e.preventDefault();
        const currentContent = editorRef.current?.state.doc.toString() || "";
        onSubmit(currentContent);
      }
    },
    [onSubmit, sendShortcut],
  );

  // Set up keyboard event listener
  useEffect(() => {
    if (!onSubmit || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown, onSubmit]);

  const completionSource = createCompletionSource(suggestions);

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {label && <div className="text-sm font-medium text-foreground mb-0 flex-none">{label}</div>}
      <CodeMirror
        autoFocus={true}
        value={initialValue}
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
    </div>
  );
};

MarkdownEditor.displayName = "MarkdownEditor";
