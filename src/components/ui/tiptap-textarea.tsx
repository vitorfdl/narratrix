import rehypeHighlightQuotes from "@/lib/rehype-highlight-quotes";
import { cn } from "@/lib/utils";
import "@mdxeditor/editor/style.css";
import { useEffect, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import RehypeHighlight from "rehype-highlight";
import RemarkBreaks from "remark-breaks";
import RemarkGfm from "remark-gfm";
import "../layout/styles/highlight.css";
import "../layout/styles/markdown.css";
import { ScrollArea } from "./scroll-area";
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

  // For backward compatibility with non-editable mode using ReactMarkdown
  if (!editable) {
    // Define markdown components for view-only mode
    const markdownComponents: Components = {
      pre: ({ children }) => <pre className="p-4 bg-accent/50 rounded">{children}</pre>,
      code: ({ className, children, ...props }) => (
        <code className={cn("font-mono text-sm overflow-wrap-anywhere", className)} {...props}>
          {children}
        </code>
      ),
    };

    return (
      <div className="flex flex-col h-full">
        {label && <div className="text-sm font-medium text-foreground mb-0 flex-none">{label}</div>}
        <div
          className={cn(
            "custom-scrollbar font-sans rounded-sm markdown-body h-full w-full px-3 py-2 overflow-auto prose prose-sm dark:prose-invert max-w-none",
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
