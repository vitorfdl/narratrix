import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StringArray } from "@/components/ui/string-array";
import { Template, TemplatePicker } from "./TemplatePicker";

// Helper component for labeled input to reduce nesting
interface LabeledInputProps {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export const LabeledInput: React.FC<LabeledInputProps> = ({
  label,
  value,
  placeholder,
  disabled,
  onChange,
}) => (
  <div>
    <Label>{label}</Label>
    <Input
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

// Helper component for checkbox with label
interface CheckboxWithLabelProps {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const CheckboxWithLabel: React.FC<CheckboxWithLabelProps> = ({
  id,
  label,
  checked,
  disabled,
  onCheckedChange,
}) => (
  <div className="flex items-center space-x-2">
    <Checkbox
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={(checked) => onCheckedChange(checked as boolean)}
    />
    <Label htmlFor={id} className="font-normal">
      {label}
    </Label>
  </div>
);

interface MessageFormatting {
  prefix: string;
  suffix: string;
}

interface ModelInstructionSectionProps {
  systemPromptFormatting: MessageFormatting;
  userMessageFormatting: MessageFormatting;
  assistantMessageFormatting: MessageFormatting & {
    prefill: string;
    prefillOnlyCharacters: boolean;
  };
  agentMessageFormatting: {
    useSameAsUser: boolean;
    useSameAsSystemPrompt: boolean;
    prefix: string;
    suffix: string;
  };
  customStopStrings: string[];
  templates: Template[];
  selectedTemplateId: string | null;
  onTemplateSelect: (templateId: string) => void;
  onUpdate: (
    updates: Partial<{
      systemPromptFormatting: MessageFormatting;
      userMessageFormatting: MessageFormatting;
      assistantMessageFormatting: MessageFormatting & {
        prefill: string;
        prefillOnlyCharacters: boolean;
      };
      agentMessageFormatting: {
        useSameAsUser: boolean;
        useSameAsSystemPrompt: boolean;
        prefix: string;
        suffix: string;
      };
      customStopStrings: string[];
    }>,
  ) => void;
  onDeleteTemplate: (templateId: string) => void;
  onNewTemplate: () => void;
  onEditTemplateName: (templateId: string) => void;
  onTemplateImport: (templateId: string) => void;
  onTemplateExport: (templateId: string) => void;
}

export function ModelInstructionSection({
  systemPromptFormatting,
  userMessageFormatting,
  assistantMessageFormatting,
  agentMessageFormatting,
  customStopStrings,
  templates,
  selectedTemplateId,
  onTemplateSelect,
  onUpdate,
  onDeleteTemplate,
  onNewTemplate,
  onEditTemplateName,
  onTemplateImport,
  onTemplateExport,
}: ModelInstructionSectionProps) {
  return (
    <div className="space-y-6">
      <Card className="rounded-sm">
        <CardHeader>
          <CardTitle className="inference-section-header">Inference Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <TemplatePicker
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            onTemplateSelect={onTemplateSelect}
            onDelete={() => onDeleteTemplate(selectedTemplateId ?? "")}
            onNewTemplate={onNewTemplate}
            onEditName={() => onEditTemplateName(selectedTemplateId ?? "")}
            onImport={() => onTemplateImport(selectedTemplateId ?? "")}
            onExport={() => onTemplateExport(selectedTemplateId ?? "")}
          />

          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle>System Prompt Formatting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <LabeledInput
                  label="Prefix"
                  value={systemPromptFormatting.prefix}
                  placeholder="[INT]"
                  onChange={(val) =>
                    onUpdate({
                      systemPromptFormatting: { ...systemPromptFormatting, prefix: val },
                    })
                  }
                />
                <LabeledInput
                  label="Suffix"
                  value={systemPromptFormatting.suffix}
                  placeholder="[INT]"
                  onChange={(val) =>
                    onUpdate({
                      systemPromptFormatting: { ...systemPromptFormatting, suffix: val },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle>User Message Formatting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <LabeledInput
                  label="Prefix"
                  value={userMessageFormatting.prefix}
                  placeholder="[INT]"
                  onChange={(val) =>
                    onUpdate({
                      userMessageFormatting: { ...userMessageFormatting, prefix: val },
                    })
                  }
                />
                <LabeledInput
                  label="Suffix"
                  value={userMessageFormatting.suffix}
                  placeholder="[INT]"
                  onChange={(val) =>
                    onUpdate({
                      userMessageFormatting: { ...userMessageFormatting, suffix: val },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle>Assistant Message Formatting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <LabeledInput
                    label="Prefix"
                    value={assistantMessageFormatting.prefix}
                    placeholder="[INT]"
                    onChange={(val) =>
                      onUpdate({
                        assistantMessageFormatting: { ...assistantMessageFormatting, prefix: val },
                      })
                    }
                  />
                  <LabeledInput
                    label="Suffix"
                    value={assistantMessageFormatting.suffix}
                    placeholder="[INT]"
                    onChange={(val) =>
                      onUpdate({
                        assistantMessageFormatting: { ...assistantMessageFormatting, suffix: val },
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <LabeledInput
                    label="Assistant Prefill"
                    value={assistantMessageFormatting.prefill}
                    placeholder="[INT]"
                    onChange={(val) =>
                      onUpdate({
                        assistantMessageFormatting: { ...assistantMessageFormatting, prefill: val },
                      })
                    }
                  />
                  <CheckboxWithLabel
                    id="prefillOnlyCharacters"
                    label="Prefill only on Characters"
                    checked={assistantMessageFormatting.prefillOnlyCharacters}
                    onCheckedChange={(checked) =>
                      onUpdate({
                        assistantMessageFormatting: {
                          ...assistantMessageFormatting,
                          prefillOnlyCharacters: checked,
                        },
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle>Agent Message Formatting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <CheckboxWithLabel
                    id="useSameAsUser"
                    label="Use same as User"
                    checked={agentMessageFormatting.useSameAsUser}
                    disabled={agentMessageFormatting.useSameAsSystemPrompt}
                    onCheckedChange={(checked) =>
                      onUpdate({
                        agentMessageFormatting: {
                          ...agentMessageFormatting,
                          useSameAsUser: checked,
                        },
                      })
                    }
                  />
                  <CheckboxWithLabel
                    id="useSameAsSystemPrompt"
                    label="Use same as System Prompt"
                    checked={agentMessageFormatting.useSameAsSystemPrompt}
                    disabled={agentMessageFormatting.useSameAsUser}
                    onCheckedChange={(checked) =>
                      onUpdate({
                        agentMessageFormatting: {
                          ...agentMessageFormatting,
                          useSameAsSystemPrompt: checked,
                        },
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <LabeledInput
                    label="Prefix"
                    value={agentMessageFormatting.prefix}
                    placeholder="[INT]"
                    disabled={
                      agentMessageFormatting.useSameAsUser ||
                      agentMessageFormatting.useSameAsSystemPrompt
                    }
                    onChange={(val) =>
                      onUpdate({
                        agentMessageFormatting: { ...agentMessageFormatting, prefix: val },
                      })
                    }
                  />
                  <LabeledInput
                    label="Suffix"
                    value={agentMessageFormatting.suffix}
                    placeholder="[INT]"
                    disabled={
                      agentMessageFormatting.useSameAsUser ||
                      agentMessageFormatting.useSameAsSystemPrompt
                    }
                    onChange={(val) =>
                      onUpdate({
                        agentMessageFormatting: { ...agentMessageFormatting, suffix: val },
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle>Custom Stop Strings</CardTitle>
            </CardHeader>
            <CardContent>
              <StringArray
                values={customStopStrings}
                placeholder="Enter stop string"
                onChange={(newValues) => onUpdate({ customStopStrings: newValues })}
              />
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
