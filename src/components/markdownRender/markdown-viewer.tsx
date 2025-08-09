import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Copy } from "lucide-react";
import { useRef } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import RehypeHighlight from "rehype-highlight";
import RemarkBreaks from "remark-breaks";
import RemarkGfm from "remark-gfm";
import { toast } from "sonner";
import rehypeHighlightQuotes from "@/components/markdownRender/extensions/rehype-highlight-quotes";
import { cn } from "@/lib/utils";
import "./styles/highlight.css";
import "./styles/markdown.css";

export interface MarkdownViewerProps {
  content: string;
  className?: string;
  label?: string;
}

const PreWithCopy: React.FC<React.PropsWithChildren<React.HTMLAttributes<HTMLPreElement>>> = ({ children, ...props }) => {
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const code = preRef.current?.querySelector("code")?.innerText ?? "";
    try {
      await writeText(code);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <pre ref={preRef} className="group relative p-4 bg-accent/50 rounded" {...props}>
      <button className="copy-code-button" type="button" aria-label="Copy code to clipboard" tabIndex={0} onClick={handleCopy}>
        <Copy className="w-4 h-4" />
      </button>
      {children}
    </pre>
  );
};

export function MarkdownViewer({ content, className, label }: MarkdownViewerProps) {
  // Define markdown components for view-only mode
  const markdownComponents: Components = {
    pre: PreWithCopy,
    code: ({ className, children, ...props }) => (
      <code className={cn("font-mono text-sm !whitespace-pre-wrap !break-words relative", className)} {...props}>
        {children}
      </code>
    ),
  };

  return (
    <div className="flex flex-col">
      {label && <div className="text-sm font-medium text-foreground mb-0 flex-none">{label}</div>}
      <div className={cn("custom-scrollbar font-sans rounded-sm markdown-body h-full w-full px-3 py-2 overflow-auto prose prose-sm dark:prose-invert max-w-none", className)}>
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
