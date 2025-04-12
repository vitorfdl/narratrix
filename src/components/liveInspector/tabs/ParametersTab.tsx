import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import React from "react";
import { markdownClass } from "../LiveInspector";

interface ParametersProps {
  selectedRequest: any;
}

export const formatJSONToMarkdown = (value: string) => {
  return `\`\`\`\`\`json\n${value}\n\`\`\`\`\``;
};

export const Parameters: React.FC<ParametersProps> = ({ selectedRequest }) => {
  return (
    <div className="h-full p-0 m-0">
      <ScrollArea className="h-full custom-scrollbar">
        <div className="p-4 space-y-4">
          <div>
            <div className="text-sm font-medium mb-1 text-foreground/80">Model Specs</div>
            <MarkdownTextArea
              editable={false}
              className={markdownClass}
              initialValue={formatJSONToMarkdown(JSON.stringify(selectedRequest.modelSpecs, null, 2))}
            />
          </div>

          <div>
            <div className="text-sm font-medium mb-1 text-foreground/80">Parameters</div>
            <MarkdownTextArea
              editable={false}
              className={markdownClass}
              initialValue={formatJSONToMarkdown(JSON.stringify(selectedRequest.parameters, null, 2))}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
