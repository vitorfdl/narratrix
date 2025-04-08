import "@mdxeditor/editor/style.css";
import { useEffect, useState } from "react";
import "../layout/styles/highlight.css";
import "../layout/styles/markdown.css";
import { ScrollArea } from "../ui/scroll-area";
import { MarkdownEditor } from "./markdown-editor";
import { MarkdownViewer } from "./markdown-viewer";

// For backward compatibility
export interface SuggestionItem {
  title: string;
  description?: string;
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
}

export function MarkdownTextArea({
  initialValue = "",
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
}: MarkdownTextAreaProps) {
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
    <ScrollArea className="flex-1 min-h-0 border border-input border-b-2 border-b-primary/20 rounded rich-text-area">
      <MarkdownEditor
        initialValue={initialValue}
        onChange={onChange}
        label={label}
        placeholder={placeholder}
        suggestions={suggestions}
        sendShortcut={sendShortcut}
        className={className}
        onSubmit={onSubmit}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </ScrollArea>
  );
}
