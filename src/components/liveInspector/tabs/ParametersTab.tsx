import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import React from "react";

interface ParametersProps {
  selectedRequest: any;
  markdownClass: string;
  formatMarkdownValue: (value: string) => string;
}

export const Parameters: React.FC<ParametersProps> = ({ selectedRequest, markdownClass, formatMarkdownValue }) => {
  return (
    <div className="h-full p-0 m-0">
      <ScrollArea className="h-full custom-scrollbar">
        <div className="p-4 space-y-4">
          <div>
            <div className="text-sm font-medium mb-1 text-foreground/80">Model Specs</div>
            <MarkdownTextArea
              editable={false}
              className={markdownClass}
              initialValue={formatMarkdownValue(JSON.stringify(selectedRequest.modelSpecs, null, 2))}
            />
          </div>

          <div>
            <div className="text-sm font-medium mb-1 text-foreground/80">Parameters</div>
            <MarkdownTextArea
              editable={false}
              className={markdownClass}
              initialValue={formatMarkdownValue(JSON.stringify(selectedRequest.parameters, null, 2))}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
