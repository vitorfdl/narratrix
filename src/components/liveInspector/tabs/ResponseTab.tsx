import { FileQuestion } from "lucide-react";
import React from "react";
import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatMarkdownValue, markdownClass } from "../LiveInspector";

interface ResponseProps {
  selectedRequest: any;
}

export const Response: React.FC<ResponseProps> = ({ selectedRequest }) => {
  return (
    <div className="h-full p-0 m-0">
      <ScrollArea className="h-full custom-scrollbar">
        <div className="p-4">
          {selectedRequest.fullResponse ? (
            <MarkdownTextArea editable={false} className={markdownClass} initialValue={formatMarkdownValue(selectedRequest.fullResponse)} />
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <FileQuestion className="w-8 h-8 mb-2" />
              <span>No response data available</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
