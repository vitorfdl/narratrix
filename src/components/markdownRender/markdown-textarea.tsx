import { MDXEditorMethods } from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { forwardRef, useEffect, useState } from "react";
import { ScrollArea } from "../ui/scroll-area";
import { MarkdownEditor } from "./markdown-editor";
import { MarkdownViewer } from "./markdown-viewer";
import "./styles/highlight.css";
import "./styles/markdown.css";

// For backward compatibility
export interface SuggestionItem {
  title: string;
  description?: string;
  type?: "variable" | "function" | "keyword";
  section?: "prompt" | "function";
}

interface MarkdownTextAreaProps {
  initialValue?: string;
  onChange?: (content: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  editable?: boolean;
  suggestions?: SuggestionItem[];
  sendShortcut?: "Enter" | "Ctrl+Enter" | "Shift+Enter" | "CMD+Enter";
  onSubmit?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  enableHistory?: boolean;
  autofocus?: boolean;
}

export const MarkdownTextArea = forwardRef<MDXEditorMethods, MarkdownTextAreaProps>(
  (
    {
      initialValue = "",
      enableHistory = false,
      onChange,
      className,
      label,
      placeholder,
      editable = true,
      suggestions,
      sendShortcut,
      onSubmit,
      onFocus,
      onBlur,
      autofocus = false,
    },
    ref,
  ) => {
    const [nonEditableContent, setNonEditableContent] = useState(initialValue);

    useEffect(() => {
      if (!editable) {
        setNonEditableContent(initialValue);
      }
    }, [initialValue, editable]);

    if (!editable) {
      return <MarkdownViewer content={nonEditableContent} className={className} label={label} />;
    }

    return (
      <ScrollArea className="flex-1 min-h-0  rounded rich-text-area">
        <MarkdownEditor
          initialValue={initialValue}
          onChange={onChange}
          label={label}
          placeholder={placeholder}
          suggestions={suggestions}
          sendShortcut={sendShortcut}
          className={className}
          enableHistory={enableHistory}
          onSubmit={onSubmit}
          onFocus={onFocus}
          onBlur={onBlur}
          ref={ref}
          autofocus={autofocus}
        />
      </ScrollArea>
    );
  },
);

MarkdownTextArea.displayName = "MarkdownTextArea";
