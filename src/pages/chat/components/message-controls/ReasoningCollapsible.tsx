import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Brain, ChevronDown } from "lucide-react";

export const ReasoningSection = ({ content }: { content: string }) => {
  return (
    <Collapsible className="mt-4 px-3 pt-2 pb-1 bg-accent/40 rounded-lg border border-border text-sm relative animate-in fade-in duration-300">
      <CollapsibleTrigger className="w-full font-medium text-xs flex items-center gap-1.5 text-muted-foreground border-b border-border/50 pb-1.5 cursor-pointer hover:text-primary">
        <Brain className="w-3 h-3 text-primary" />
        <span>AI Reasoning Process</span>
        <ChevronDown className="w-4 h-4 ml-auto transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden transition-all data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <MarkdownTextArea initialValue={content} editable={false} className="bg-transparent border-none p-0 pt-2 text-sm text-muted-foreground leading-relaxed" />
      </CollapsibleContent>
    </Collapsible>
  );
};
