import rehypeHighlightQuotes from "@/lib/rehype-highlight-quotes";
import { cn } from "@/lib/utils";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import RehypeHighlight from "rehype-highlight";
import RemarkBreaks from "remark-breaks";
import RemarkGfm from "remark-gfm";
import "../layout/styles/highlight.css";
import "../layout/styles/markdown.css";

export interface MarkdownViewerProps {
  content: string;
  className?: string;
  label?: string;
}

export function MarkdownViewer({ content, className, label }: MarkdownViewerProps) {
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
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
