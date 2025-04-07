import rehypeHighlightQuotes from "@/lib/rehype-highlight-quotes";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import RehypeHighlight from "rehype-highlight";
import RemarkBreaks from "remark-breaks";
import RemarkGfm from "remark-gfm";
import "../layout/styles/highlight.css";
import "../layout/styles/markdown.css";
import { MarkdownEditor } from "./tiptap-text-editor";

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

export function TipTapTextArea({
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

  // Define markdown components for view-only mode
  const markdownComponents: Components = {
    pre: ({ children }) => <pre className="p-4 bg-accent/50 rounded">{children}</pre>,
    code: ({ className, children, ...props }) => (
      <code className={cn("font-mono text-sm overflow-wrap-anywhere", className)} {...props}>
        {children}
      </code>
    ),
  };

  // For backward compatibility with non-editable mode using ReactMarkdown
  if (!editable) {
    return (
      <div className="flex flex-col h-full">
        {label && <div className="text-sm font-medium text-foreground mb-0 flex-none">{label}</div>}
        <div
          className={cn(
            "custom-scrollbar rounded-sm markdown-body h-full w-full px-3 py-2 overflow-auto prose prose-sm dark:prose-invert max-w-none",
            className,
          )}
        >
          <ReactMarkdown
            remarkPlugins={[RemarkGfm, RemarkBreaks]}
            rehypePlugins={[
              rehypeHighlightQuotes,
              [
                RehypeHighlight,
                {
                  detect: false,
                  ignoreMissing: true,
                },
              ],
            ]}
            components={markdownComponents}
          >
            {nonEditableContent}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("focus:bg-accent bg-foreground/5 h-full", className)}>
      <MarkdownEditor
        initialValue={initialValue}
        onChange={onChange}
        label={label}
        placeholder={placeholder}
        suggestions={suggestions}
        sendShortcut={sendShortcut}
        onSubmit={onSubmit}
        onFocus={onFocus}
        onBlur={onBlur}
        minHeight="140px"
      />
    </div>
  );
}
