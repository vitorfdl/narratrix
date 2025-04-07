import { useTheme } from "@/hooks/ThemeContext";
import { cn } from "@/lib/utils";
import { CompletionContext, CompletionResult, autocompletion } from "@codemirror/autocomplete";
import {
  MDXEditor,
  MDXEditorMethods,
  codeBlockPlugin,
  diffSourcePlugin,
  headingsPlugin,
  imagePlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
} from "@mdxeditor/editor";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import "../layout/styles/mdxeditor.css";
import { SuggestionItem } from "./tiptap-textarea";

export interface MDXEditorProps {
  initialValue?: string;
  onChange?: (content: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  sendShortcut?: "Enter" | "Ctrl+Enter" | "Shift+Enter" | "CMD+Enter";
  onSubmit?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  minHeight?: string;
  suggestions?: SuggestionItem[];
}

export const MarkdownEditor = forwardRef<MDXEditorMethods, MDXEditorProps>(
  ({ initialValue = "", onChange, className, label, placeholder, sendShortcut, onSubmit, onFocus, onBlur, suggestions = [] }, ref) => {
    const [content, setContent] = useState(initialValue);
    const [showPlaceholder, setShowPlaceholder] = useState(!initialValue);
    const editorRef = useRef<MDXEditorMethods>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isInitialMount = useRef(true);
    const isUserEditing = useRef(false);
    const { theme } = useTheme();
    // Determine if dark mode is active
    const isDarkMode =
      theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

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
          detail: item.description,
          type: "variable",
        }));

        return {
          from: wordStartPos,
          options,
          // Valid as long as we're still within a {{ ... }} expression and haven't closed it
          validFor: /^\w*(?!\}\})$/,
        };
      };
    }, []);

    useImperativeHandle(ref, () => {
      if (!editorRef.current) {
        return {
          getMarkdown: () => "",
          setMarkdown: () => {},
          insertMarkdown: () => {},
          focus: () => {},
        } as MDXEditorMethods;
      }
      return editorRef.current;
    });

    // Only sync from props on mount or when initialValue changes and user is not actively editing
    useEffect(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      // Only update from props if the user isn't currently editing
      // and the content has actually changed
      if (!isUserEditing.current && initialValue !== content) {
        setContent(initialValue);
        setShowPlaceholder(!initialValue);
        if (editorRef.current) {
          editorRef.current.setMarkdown(initialValue);
        }
      }
    }, [initialValue]);

    const debouncedOnChange = useDebouncedCallback((value: string) => {
      onChange?.(value);
    }, 150);

    const handleChange = (value: string) => {
      isUserEditing.current = true;
      setContent(value);
      setShowPlaceholder(!value.trim());
      debouncedOnChange(value);

      // Reset the editing flag after a short delay
      setTimeout(() => {
        isUserEditing.current = false;
      }, 200);
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
          const currentContent = editorRef.current?.getMarkdown() || "";
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

    // Handle focus and blur events
    const handleFocus = useCallback(() => {
      isUserEditing.current = true;
      setShowPlaceholder(false);
      onFocus?.();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
      isUserEditing.current = false;
      setShowPlaceholder(!content.trim());
      onBlur?.();
    }, [onBlur, content]);

    // Handle clicking on the placeholder to focus the editor
    const handlePlaceholderClick = useCallback(() => {
      editorRef.current?.focus();
    }, []);

    // Create the completion source using current suggestions
    const completionSource = createCompletionSource(suggestions);

    return (
      <div className={className} ref={containerRef}>
        {label && <div className="text-sm font-medium text-foreground mb-0 flex-none">{label}</div>}
        <div
          className={cn("flex-1 relative focus:bg-accent bg-foreground/5", className, isDarkMode && "dark")}
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          {showPlaceholder && placeholder && (
            <div className="absolute inset-0 flex items-start ml-5 px-4 py-1 pointer-events-none z-10" onClick={handlePlaceholderClick}>
              <span className="text-muted-foreground/30 italic font-mono text-sm">{placeholder}</span>
            </div>
          )}
          <MDXEditor
            autoFocus
            ref={editorRef}
            markdown={content}
            onChange={handleChange}
            toMarkdownOptions={{
              ruleSpaces: false,
              tightDefinitions: true,
            }}
            plugins={[
              headingsPlugin(),
              listsPlugin(),
              linkPlugin(),
              quotePlugin(),
              markdownShortcutPlugin(),
              codeBlockPlugin(),
              thematicBreakPlugin(),
              imagePlugin(),
              tablePlugin(),
              diffSourcePlugin({
                codeMirrorExtensions: [
                  autocompletion({
                    override: [completionSource],
                    defaultKeymap: true,
                    aboveCursor: true,
                    maxRenderedOptions: 10,
                  }),
                ],
                viewMode: "source",
              }),
            ]}
          />
        </div>
      </div>
    );
  },
);

MarkdownEditor.displayName = "MarkdownEditor";
