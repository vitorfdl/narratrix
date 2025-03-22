import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TemplateSettings } from "@/schema/inference-template";
import { Template, TemplatePicker } from "./TemplatePicker";

interface TemplateHeaderProps {
  settings: TemplateSettings;
  templates: Template[];
  selectedTemplateId: string | null;
  onTemplateSelect: (templateId: string) => void;
  onUpdate: (updates: Partial<{ settings: TemplateSettings }>) => void;
  onDelete: () => void;
  onNewTemplate: () => void;
  onEditName: () => void;
  onImport: () => void;
  onExport: () => void;
}

export function TemplateHeader({
  settings,
  templates,
  selectedTemplateId,
  onTemplateSelect,
  onUpdate,
  onDelete,
  onNewTemplate,
  onEditName,
  onImport,
  onExport,
}: TemplateHeaderProps) {
  return (
    <div className="space-y-4 bg-card p-4 rounded-sm border">
      <TemplatePicker
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        onTemplateSelect={onTemplateSelect}
        onDelete={onDelete}
        onNewTemplate={onNewTemplate}
        onEditName={onEditName}
        onImport={onImport}
        onExport={onExport}
      />

      <div className="grid grid-cols-3 gap-8">
        {/* Left Column - Checkboxes */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Text Cleanup</h3>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="trimAssistant"
              checked={settings.trimAssistantIncomplete}
              onCheckedChange={(checked) =>
                onUpdate({
                  settings: {
                    ...settings,
                    trimAssistantIncomplete: checked as boolean,
                  },
                })
              }
            />
            <Label htmlFor="trimAssistant">Trim Assistant Incomplete Sequences</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="trimSpaces"
              checked={settings.trimDoubleSpaces}
              onCheckedChange={(checked) =>
                onUpdate({
                  settings: {
                    ...settings,
                    trimDoubleSpaces: checked as boolean,
                  },
                })
              }
            />
            <Label htmlFor="trimSpaces">Trim Double+ Spaces</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="collapseLines"
              checked={settings.collapseConsecutiveLines}
              onCheckedChange={(checked) =>
                onUpdate({
                  settings: {
                    ...settings,
                    collapseConsecutiveLines: checked as boolean,
                  },
                })
              }
            />
            <Label htmlFor="collapseLines">Collapse Consecutive Lines</Label>
          </div>
        </div>

        {/* Middle Column - Template Type and Prefix Messages */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-medium text-muted-foreground">Template Type</Label>
            <RadioGroup
              value={settings.chatCompletion ? "chat" : "text"}
              onValueChange={(value) =>
                onUpdate({
                  settings: {
                    ...settings,
                    chatCompletion: value === "chat",
                    textCompletion: value === "text",
                  },
                })
              }
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="chat" id="chat" />
                <Label htmlFor="chat">Chat Completion</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="text" id="text" />
                <Label htmlFor="text">Text Completion</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="font-medium text-muted-foreground">
              Prefix Messages with Character Names
            </Label>
            <RadioGroup
              value={settings.prefixMessages.type}
              onValueChange={(value) =>
                onUpdate({
                  settings: {
                    ...settings,
                    prefixMessages: {
                      ...settings.prefixMessages,
                      type: value as "never" | "always" | "characters",
                    },
                  },
                })
              }
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="never" id="never" />
                <Label htmlFor="never">Never</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="always" id="always" />
                <Label htmlFor="always">Always</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="characters" id="characters" />
                <Label htmlFor="characters">Only 2+ Characters</Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        {/* Right Column - Additional Checkboxes */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Message Formatting</h3>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="mergeMessages"
              checked={settings.prefixMessages.enabled}
              onCheckedChange={(checked) =>
                onUpdate({
                  settings: {
                    ...settings,
                    prefixMessages: {
                      ...settings.prefixMessages,
                      enabled: checked as boolean,
                    },
                  },
                })
              }
            />
            <Label htmlFor="mergeMessages">Merge all messages on User</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="applyCensorship"
              checked={settings.applyCensorship}
              onCheckedChange={(checked) =>
                onUpdate({
                  settings: {
                    ...settings,
                    applyCensorship: checked as boolean,
                  },
                })
              }
            />
            <Label htmlFor="applyCensorship">Apply censorship to messages</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="mergeSubsequent"
              checked={settings.mergeSubsequentMessages}
              onCheckedChange={(checked) =>
                onUpdate({
                  settings: {
                    ...settings,
                    mergeSubsequentMessages: checked as boolean,
                  },
                })
              }
            />
            <Label htmlFor="mergeSubsequent">Merge subsquent Messages</Label>
          </div>
        </div>
      </div>
    </div>
  );
}
