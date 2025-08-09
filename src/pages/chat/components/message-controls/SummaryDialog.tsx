import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import WidgetConfig from "@/pages/chat/components/WidgetConfig";
import { promptReplacementSuggestionList } from "@/schema/chat-message-schema";
import { estimateTokens } from "@/services/inference/formatter/apply-context-limit";
import { useLocalSummarySettings } from "@/utils/local-storage";
import { MessageCircle, Settings, TextSelect } from "lucide-react";
import React, { useEffect, useState } from "react";

export interface SummarySettings {
  chatTemplateID?: string;
  requestPrompt: string;
  systemPrompt: string;
  injectionPrompt: string;
}

interface SummaryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (settings: SummarySettings, runNow?: boolean) => void;
}

const DEFAULT_SETTINGS_STATE: SummarySettings = {
  chatTemplateID: "",
  requestPrompt: "",
  systemPrompt: "",
  injectionPrompt: "---\n{{summary}}\n---",
};

export const SummaryDialog: React.FC<SummaryDialogProps> = ({ isOpen, onOpenChange, onSave }) => {
  const [localSettings] = useLocalSummarySettings();
  const [currentSettings, setCurrentSettings] = useState<SummarySettings>(DEFAULT_SETTINGS_STATE);

  useEffect(() => {
    if (isOpen) {
      // Initialize with either the provided data, stored settings, or defaults
      setCurrentSettings(localSettings || DEFAULT_SETTINGS_STATE);
    }
  }, [isOpen, localSettings]);

  const handleSave = (runNow = false) => {
    // No validation required as empty fields are allowed
    onSave(currentSettings, runNow);
    onOpenChange(false); // Close dialog on save
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleFieldChange = (field: keyof SummarySettings, value: string) => {
    setCurrentSettings((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent size="window">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1 text-lg">
            <TextSelect className="h-4 w-4 text-primary" />
            Summary Settings
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="systemPrompt" className="text-sm font-medium flex items-center gap-1">
                      <Settings className="h-3 w-3" /> System Prompt Override (optional)
                    </Label>
                    <span className="text-xs text-muted-foreground">{estimateTokens(currentSettings.systemPrompt, 0) || 0} tokens</span>
                  </div>
                  <MarkdownTextArea
                    initialValue={currentSettings.systemPrompt}
                    editable={true}
                    suggestions={promptReplacementSuggestionList}
                    onChange={(value) => handleFieldChange("systemPrompt", value)}
                    placeholder="Leave empty to use the default system prompt from the selected template"
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">System instructions for the AI when generating summaries</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="requestPrompt" className="text-sm font-medium flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" /> User Request Prompt
                    </Label>
                    <span className="text-xs text-muted-foreground">{estimateTokens(currentSettings.requestPrompt, 0) || 0} tokens</span>
                  </div>
                  <MarkdownTextArea
                    initialValue={currentSettings.requestPrompt}
                    editable={true}
                    suggestions={promptReplacementSuggestionList}
                    onChange={(value) => handleFieldChange("requestPrompt", value)}
                    placeholder="Enter the prompt that will be sent to generate the summary..."
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">This will be used as the request sent to the AI</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="injectionPrompt" className="text-sm font-medium flex items-center gap-1">
                      <TextSelect className="h-3 w-3" /> History Injection Prompt
                    </Label>
                    <span className="text-xs text-muted-foreground">{estimateTokens(currentSettings.injectionPrompt, 0) || 0} tokens</span>
                  </div>
                  <MarkdownTextArea
                    initialValue={currentSettings.injectionPrompt}
                    editable={true}
                    suggestions={promptReplacementSuggestionList}
                    onChange={(value) => handleFieldChange("injectionPrompt", value)}
                    placeholder="---\n{{summary}}\n---"
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">How the summary will be injected into the chat history</p>
                </div>
              </div>

              <div className="space-y-1 row-span-3 overflow-y-auto ">
                <Label htmlFor="templateId" className="text-sm font-medium">
                  Chat Template
                </Label>
                <div className="border border-input rounded-md">
                  <WidgetConfig currentChatTemplateID={currentSettings.chatTemplateID || null} onChatTemplateChange={(chatTemplateId) => handleFieldChange("chatTemplateID", chatTemplateId)} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Select the chat template to use for the summary generation</p>
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} className="border-input hover:bg-secondary transition-colors h-8 px-3 py-1">
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={() => handleSave(false)} className="border-input hover:bg-secondary transition-colors h-8 px-3 py-1">
            Save
          </Button>
          <Button type="button" onClick={() => handleSave(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors h-8 px-3 py-1">
            Save & Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
