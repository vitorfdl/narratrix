import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TemplatePicker, Template } from "./TemplatePicker";

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
    onUpdate: (updates: Partial<{
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
    }>) => void;
    onDeleteTemplate: () => void;
    onNewTemplate: () => void;
    onEditTemplateName: () => void;
    onTemplateImport: () => void;
    onTemplateExport: () => void;
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
    onTemplateExport
}: ModelInstructionSectionProps) {
    return (
        <Card className="rounded-sm">
            <CardContent className="p-6 space-y-6">
                <h3 className="inference-section-header">Inference Template</h3>
                <div className="mb-4">
                    <TemplatePicker
                        templates={templates}
                        selectedTemplateId={selectedTemplateId}
                        onTemplateSelect={onTemplateSelect}
                        onDelete={onDeleteTemplate}
                        onNewTemplate={onNewTemplate}
                        onEditName={onEditTemplateName}
                        onImport={onTemplateImport}
                        onExport={onTemplateExport}
                    />
                </div>
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">System Prompt Formatting</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Suffix</Label>
                            <Input
                                value={systemPromptFormatting.suffix}
                                onChange={(e) =>
                                    onUpdate({
                                        systemPromptFormatting: {
                                            ...systemPromptFormatting,
                                            suffix: e.target.value
                                        }
                                    })
                                }
                                placeholder="[INT]"
                            />
                        </div>
                        <div>
                            <Label>Prefix</Label>
                            <Input
                                value={systemPromptFormatting.prefix}
                                onChange={(e) =>
                                    onUpdate({
                                        systemPromptFormatting: {
                                            ...systemPromptFormatting,
                                            prefix: e.target.value
                                        }
                                    })
                                }
                                placeholder="[INT]"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-medium">User Message Formatting</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Suffix</Label>
                            <Input
                                value={userMessageFormatting.suffix}
                                onChange={(e) =>
                                    onUpdate({
                                        userMessageFormatting: {
                                            ...userMessageFormatting,
                                            suffix: e.target.value
                                        }
                                    })
                                }
                                placeholder="[INT]"
                            />
                        </div>
                        <div>
                            <Label>Prefix</Label>
                            <Input
                                value={userMessageFormatting.prefix}
                                onChange={(e) =>
                                    onUpdate({
                                        userMessageFormatting: {
                                            ...userMessageFormatting,
                                            prefix: e.target.value
                                        }
                                    })
                                }
                                placeholder="[INT]"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Assistant Message Formatting</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Suffix</Label>
                            <Input
                                value={assistantMessageFormatting.suffix}
                                onChange={(e) =>
                                    onUpdate({
                                        assistantMessageFormatting: {
                                            ...assistantMessageFormatting,
                                            suffix: e.target.value
                                        }
                                    })
                                }
                                placeholder="[INT]"
                            />
                        </div>
                        <div>
                            <Label>Prefix</Label>
                            <Input
                                value={assistantMessageFormatting.prefix}
                                onChange={(e) =>
                                    onUpdate({
                                        assistantMessageFormatting: {
                                            ...assistantMessageFormatting,
                                            prefix: e.target.value
                                        }
                                    })
                                }
                                placeholder="[INT]"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                        <Label>Assistant Prefill</Label>
                        <Input
                            value={assistantMessageFormatting.prefill}
                            onChange={(e) =>
                                onUpdate({
                                    assistantMessageFormatting: {
                                        ...assistantMessageFormatting,
                                        prefill: e.target.value
                                    }
                                })
                            }
                            placeholder="[INT]"
                        />
                        </div>
                        <div className="flex items-center align-middle space-x-2">
                            <Checkbox
                                id="prefillOnlyCharacters"
                                checked={assistantMessageFormatting.prefillOnlyCharacters}
                                onCheckedChange={(checked) =>
                                    onUpdate({
                                        assistantMessageFormatting: {
                                            ...assistantMessageFormatting,
                                            prefillOnlyCharacters: checked as boolean
                                        }
                                    })
                                }
                            />
                            <Label className="font-normal" htmlFor="prefillOnlyCharacters">
                                Prefill only on Characters
                            </Label>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Agent Message Formatting</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="useSameAsUser"
                                checked={agentMessageFormatting.useSameAsUser}
                                onCheckedChange={(checked) =>
                                    onUpdate({
                                        agentMessageFormatting: {
                                            ...agentMessageFormatting,
                                            useSameAsUser: checked as boolean
                                        }
                                    })
                                }
                            />
                            <Label className="font-normal" htmlFor="useSameAsUser">
                                Use same as User
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="useSameAsSystemPrompt"
                                checked={agentMessageFormatting.useSameAsSystemPrompt}
                                onCheckedChange={(checked) =>
                                    onUpdate({
                                        agentMessageFormatting: {
                                            ...agentMessageFormatting,
                                            useSameAsSystemPrompt: checked as boolean
                                        }
                                    })
                                }
                            />
                            <Label htmlFor="useSameAsSystemPrompt">
                                Use same as System Prompt
                            </Label>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Suffix</Label>
                            <Input
                                value={agentMessageFormatting.suffix}
                                onChange={(e) =>
                                    onUpdate({
                                        agentMessageFormatting: {
                                            ...agentMessageFormatting,
                                            suffix: e.target.value
                                        }
                                    })
                                }
                                placeholder="[INT]"
                                disabled={agentMessageFormatting.useSameAsUser || agentMessageFormatting.useSameAsSystemPrompt}
                            />
                        </div>
                        <div>
                            <Label>Prefix</Label>
                            <Input
                                value={agentMessageFormatting.prefix}
                                onChange={(e) =>
                                    onUpdate({
                                        agentMessageFormatting: {
                                            ...agentMessageFormatting,
                                            prefix: e.target.value
                                        }
                                    })
                                }
                                placeholder="[INT]"
                                disabled={agentMessageFormatting.useSameAsUser || agentMessageFormatting.useSameAsSystemPrompt}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Custom Stop Strings</h3>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => onUpdate({ customStopStrings: [...customStopStrings, ""] })}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {customStopStrings.map((stopString, index) => (
                            <Input
                                key={index}
                                value={stopString}
                                onChange={(e) => {
                                    const newStopStrings = [...customStopStrings];
                                    newStopStrings[index] = e.target.value;
                                    onUpdate({ customStopStrings: newStopStrings });
                                }}
                                placeholder="Enter stop string"
                            />
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
} 