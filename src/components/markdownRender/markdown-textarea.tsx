import { forwardRef, useEffect, useState } from "react";
import { MarkdownEditor, MarkdownEditorRef } from "./markdown-editor";
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
  enableHistory?: boolean;
  useEditorOnly?: boolean; // If true, the editor will be used exclusively and the viewer will be hidden.
  autofocus?: boolean;
  key?: string;
}

export const MarkdownTextArea = forwardRef<MarkdownEditorRef, MarkdownTextAreaProps>(
  ({ initialValue = "", enableHistory = false, onChange, className, label, placeholder, editable = true, suggestions, sendShortcut, onSubmit, useEditorOnly = false }, ref) => {
    const [nonEditableContent, setNonEditableContent] = useState(initialValue);

    useEffect(() => {
      if (!editable) {
        setNonEditableContent(initialValue);
      }
    }, [initialValue, editable]);

    if (!editable && !useEditorOnly) {
      return <MarkdownViewer content={nonEditableContent} className={className} label={label} />;
    }

    return (
      <MarkdownEditor
        editable={editable}
        initialValue={initialValue}
        onChange={onChange}
        label={label}
        placeholder={placeholder}
        suggestions={suggestions}
        sendShortcut={sendShortcut}
        className={className}
        enableHistory={enableHistory}
        onSubmit={onSubmit}
        ref={ref}
      />
    );
  },
);

MarkdownTextArea.displayName = "MarkdownTextArea";
