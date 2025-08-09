import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { IconName, IconPicker } from "@/components/ui/icon-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WidgetConfig from "@/pages/chat/components/WidgetConfig";
import { promptReplacementSuggestionList } from "@/schema/chat-message-schema";
import { QuickAction } from "@/schema/profiles-schema";
import { estimateTokens } from "@/services/inference/formatter/apply-context-limit";
import { motion } from "framer-motion";
import { MessageCircle, MessageSquarePlus, Settings, Wand2 } from "lucide-react";
import React, { useEffect, useState } from "react";

interface QuickActionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  isEditMode: boolean;
  initialData?: Partial<QuickAction>;
  onSave: (actionData: QuickAction) => void;
}

const DEFAULT_ACTION_STATE: Partial<QuickAction> = {
  icon: "wand-2",
  label: "",
  userPrompt: "",
  chatTemplateId: "",
  systemPromptOverride: "",
  streamOption: "textarea",
  participantMessageType: "new", // Default value for participant message type
};

export const QuickActionDialog: React.FC<QuickActionDialogProps> = ({ isOpen, onOpenChange, isEditMode, initialData, onSave }) => {
  const [currentAction, setCurrentAction] = useState<Partial<QuickAction>>(DEFAULT_ACTION_STATE);
  const [activeTab, setActiveTab] = useState("basic");

  useEffect(() => {
    if (isOpen) {
      // Ensure a fresh copy of the default state is used for new actions
      setCurrentAction(isEditMode && initialData ? { ...initialData } : { ...DEFAULT_ACTION_STATE });
      setActiveTab("basic");
    }
  }, [isOpen, isEditMode, initialData]);

  const handleSave = () => {
    if (!currentAction.label || !currentAction.userPrompt) {
      // Basic validation
      return;
    }

    const actionToSave: QuickAction = {
      id: currentAction.id || crypto.randomUUID(),
      icon: currentAction.icon || "wand-2",
      label: currentAction.label,
      userPrompt: currentAction.userPrompt,
      chatTemplateId: currentAction.chatTemplateId || "",
      systemPromptOverride: currentAction.systemPromptOverride || "",
      streamOption: currentAction.streamOption || "textarea",
      participantMessageType: currentAction.participantMessageType || "new",
    };

    onSave(actionToSave);
    onOpenChange(false); // Close dialog on save
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleFieldChange = (field: keyof QuickAction, value: string | IconName | "textarea" | "userMessage" | "participantMessage" | "new" | "swap") => {
    setCurrentAction((prev: Partial<QuickAction>) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent size="window">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1 text-lg">
            <MessageSquarePlus className="h-4 w-4 text-primary" />
            {isEditMode ? "Edit Quick Action" : "Add Quick Action"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mb-3">
            <TabsTrigger value="basic" className="flex items-center gap-1 py-1">
              <Settings className="h-3 w-3" />
              <span>Basic Settings</span>
            </TabsTrigger>
            <TabsTrigger value="template" className="flex items-center gap-1 py-1">
              <MessageCircle className="h-3 w-3" />
              <span>Chat Template</span>
            </TabsTrigger>
          </TabsList>

          <DialogBody>
            <TabsContent value="basic" className="space-y-3 mt-2">
              <div className="grid xl:grid-cols-2 grid-cols-1 gap-3">
                <div className="space-y-6">
                  <div className="space-y-1">
                    <Label htmlFor="label" className="text-sm font-medium">
                      Action Name
                    </Label>
                    <Input id="label" placeholder="Enter a descriptive name" value={currentAction.label || ""} onChange={(e) => handleFieldChange("label", e.target.value)} className="h-8" />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="icon" className="text-sm font-medium">
                      Icon
                    </Label>
                    <div className="mt-1">
                      <IconPicker categorized={false} value={currentAction.icon as IconName} onValueChange={(icon) => handleFieldChange("icon", icon)} className="w-full" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="space-y-1 align-center items-center w-full">
                    <Label htmlFor="streamOption" className="text-sm font-medium">
                      Output Type
                    </Label>
                    <RadioGroup
                      value={currentAction.streamOption}
                      onValueChange={(value) => handleFieldChange("streamOption", value as QuickAction["streamOption"])}
                      className="flex space-x-2 mt-1 justify-center align-center items-center w-full"
                    >
                      <div className="flex items-center space-x-1 p-1 rounded-md hover:bg-secondary/50 transition-colors">
                        <RadioGroupItem value="textarea" id="textarea" />
                        <Label htmlFor="textarea" className="cursor-pointer text-sm">
                          Stream to Generation Input
                        </Label>
                      </div>
                      <div className="flex items-center space-x-1 p-1 rounded-md hover:bg-secondary/50 transition-colors">
                        <RadioGroupItem value="userMessage" id="userMessage" />
                        <Label htmlFor="userMessage" className="cursor-pointer text-sm">
                          Stream as User
                        </Label>
                      </div>
                      <div className="flex items-center space-x-1 p-1 rounded-md hover:bg-secondary/50 transition-colors">
                        <RadioGroupItem value="participantMessage" id="participantMessage" />
                        <Label htmlFor="participantMessage" className="cursor-pointer text-sm">
                          Stream as Participant
                        </Label>
                      </div>
                    </RadioGroup>

                    {currentAction.streamOption === "participantMessage" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-1 mt-2"
                      >
                        <Label htmlFor="participantMessageType" className="text-sm font-medium">
                          Participant Message Type
                        </Label>
                        <Select value={currentAction.participantMessageType || "new"} onValueChange={(value: "new" | "swap") => handleFieldChange("participantMessageType", value)}>
                          <SelectTrigger className="w-full h-8">
                            <SelectValue placeholder="Select message type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New Message</SelectItem>
                            <SelectItem value="swap">Swap Last Message / New Message</SelectItem>
                          </SelectContent>
                        </Select>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="userPrompt" className="text-sm font-medium flex items-center gap-1">
                    <Wand2 className="h-3 w-3" /> User Prompt
                  </Label>
                  <span className="text-xs text-muted-foreground">{estimateTokens(currentAction.userPrompt || "", 0)} tokens</span>
                </div>
                <MarkdownTextArea
                  key={currentAction.id ? `userPrompt-${currentAction.id}` : "new-userPrompt"}
                  initialValue={currentAction.userPrompt || ""}
                  editable={true}
                  className="max-h-[20vh]"
                  suggestions={promptReplacementSuggestionList}
                  onChange={(value) => handleFieldChange("userPrompt", value)}
                  placeholder="Enter the prompt that will be sent when this action is triggered..."
                />
                <p className="text-xs text-muted-foreground mt-0.5">
                  Use {"{{input}}"} to refer to the current user message
                  <br />
                  Use {"{{character.message}}"} to refer to the last character message
                  <br />
                  Use {"{{user.message}}"} to refer to the last user message
                </p>
              </div>
            </TabsContent>

            <TabsContent value="template" className="space-y-3 mt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="templateId" className="text-sm font-medium">
                    Chat Template
                  </Label>
                  <WidgetConfig currentChatTemplateID={currentAction.chatTemplateId || null} onChatTemplateChange={(chatTemplateId) => handleFieldChange("chatTemplateId", chatTemplateId)} />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="systemPrompt" className="text-sm font-medium">
                      System Prompt Override
                    </Label>
                    <span className="text-xs text-muted-foreground">{estimateTokens(currentAction.systemPromptOverride || "", 0)} tokens</span>
                  </div>
                  <MarkdownTextArea
                    key={currentAction.id ? `systemPrompt-${currentAction.id}` : "new-systemPrompt"}
                    initialValue={currentAction.systemPromptOverride || ""}
                    editable={true}
                    className="min-h-[100px]"
                    suggestions={promptReplacementSuggestionList}
                    onChange={(value) => handleFieldChange("systemPromptOverride", value)}
                    placeholder="Leave empty to use the default system prompt from the selected template"
                  />
                </div>
              </div>
            </TabsContent>
          </DialogBody>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} className="border-input hover:bg-secondary transition-colors h-8 px-3 py-1">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!currentAction.label?.trim() || !currentAction.userPrompt?.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors h-8 px-3 py-1"
          >
            {isEditMode ? "Update" : "Save"} Action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
