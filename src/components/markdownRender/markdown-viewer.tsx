import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { memo, useMemo, useRef } from "react";
import { LuCopy } from "react-icons/lu";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import RehypeHighlight from "rehype-highlight";
import RemarkBreaks from "remark-breaks";
import RemarkGfm from "remark-gfm";
import { toast } from "sonner";
import rehypeHighlightQuotes, { type DelimiterType } from "@/components/markdownRender/extensions/rehype-highlight-quotes";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { cn } from "@/lib/utils";
import type { DelimiterHighlighting } from "@/schema/profiles-schema";
import "./styles/highlight.css";
import "./styles/markdown.css";

export interface MarkdownViewerProps {
  content: string;
  className?: string;
  label?: string;
  /** Optional: pass from outside to avoid an internal store subscription per viewer instance */
  delimiterHighlighting?: DelimiterHighlighting;
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
        <LuCopy className="w-4 h-4" />
      </button>
      {children}
    </pre>
  );
};

// Module-scope constant -- no closures, stable reference across all renders
const MARKDOWN_COMPONENTS: Components = {
  pre: PreWithCopy,
  code: ({ className, children, ...props }) => (
    <code className={cn("font-mono text-sm !whitespace-pre-wrap !break-words relative", className)} {...props}>
      {children}
    </code>
  ),
};

const DELIMITER_SETTING_MAP: Record<keyof DelimiterHighlighting, DelimiterType> = {
  quoteDouble: "quote-double",
  quoteLeft: "quote-left",
  brace: "brace",
  dashEm: "dash-em",
};

function getEnabledDelimiterTypes(highlighting: DelimiterHighlighting | undefined): DelimiterType[] | undefined {
  if (!highlighting) {
    return undefined;
  }
  const enabled = Object.entries(DELIMITER_SETTING_MAP)
    .filter(([key]) => highlighting[key as keyof DelimiterHighlighting])
    .map(([, type]) => type);
  return enabled.length === Object.keys(DELIMITER_SETTING_MAP).length ? undefined : enabled;
}

export const MarkdownViewer = memo(function MarkdownViewer({ content, className, label, delimiterHighlighting: delimiterHighlightingProp }: MarkdownViewerProps) {
  // Fall back to reading the profile store only when the prop is not provided
  const currentProfile = useCurrentProfile();
  const delimiterHighlighting = delimiterHighlightingProp ?? currentProfile?.settings.appearance.delimiterHighlighting;

  const rehypePlugins = useMemo(() => {
    const enabledTypes = getEnabledDelimiterTypes(delimiterHighlighting);
    return [
      enabledTypes !== undefined ? [rehypeHighlightQuotes, { enabledTypes }] : rehypeHighlightQuotes,
      [
        RehypeHighlight,
        {
          detect: false,
          ignoreMissing: true,
        },
      ],
    ] as NonNullable<React.ComponentProps<typeof ReactMarkdown>["rehypePlugins"]>;
  }, [delimiterHighlighting]);

  return (
    <div className="flex flex-col">
      {label && <div className="text-sm font-medium text-foreground mb-0 flex-none">{label}</div>}
      <div className={cn("custom-scrollbar font-sans rounded-sm markdown-body h-full w-full px-3 py-2 overflow-auto prose prose-sm dark:prose-invert max-w-none", className)}>
        <ReactMarkdown remarkPlugins={[RemarkGfm, RemarkBreaks]} rehypePlugins={rehypePlugins} components={MARKDOWN_COMPONENTS}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
});
