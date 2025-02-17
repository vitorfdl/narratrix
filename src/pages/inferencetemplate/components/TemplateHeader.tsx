import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Trash, Edit, FileDown, FileUp } from "lucide-react";
import { TemplateSettings } from "@/types/inference";

interface TemplateHeaderProps {
    settings: TemplateSettings;
    onUpdate: (updates: Partial<{ settings: TemplateSettings }>) => void;
    onDelete: () => void;
    onNewTemplate: () => void;
    onEditName: () => void;
    onImport: () => void;
    onExport: () => void;
}

export function TemplateHeader({
    settings,
    onUpdate,
    onDelete,
    onNewTemplate,
    onEditName,
    onImport,
    onExport
}: TemplateHeaderProps) {
    return (
        <div className="space-y-4 bg-card p-4 rounded-lg border">
            <div className="flex items-center space-x-2">
                <Select>
                    <SelectTrigger className="w-[300px]">
                        <SelectValue placeholder="Select Template" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="template1">Template 1</SelectItem>
                        <SelectItem value="template2">Template 2</SelectItem>
                    </SelectContent>
                </Select>

                <div className="flex items-center space-x-1">
                    <Button variant="outline" size="icon" onClick={onDelete}>
                        <Trash className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={onNewTemplate}>
                        <Plus className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={onEditName}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={onImport}>
                        <FileDown className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={onExport}>
                        <FileUp className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-8">
                {/* Left Column - Checkboxes */}
                <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="trimAssistant"
                            checked={settings.trimAssistantIncomplete}
                            onCheckedChange={(checked) =>
                                onUpdate({
                                    settings: {
                                        ...settings,
                                        trimAssistantIncomplete: checked as boolean
                                    }
                                })
                            }
                        />
                        <Label htmlFor="trimAssistant" className="text-sm text-muted-foreground">
                            Trim Assistant Incomplete Sequences
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="trimSpaces"
                            checked={settings.trimDoubleSpaces}
                            onCheckedChange={(checked) =>
                                onUpdate({
                                    settings: {
                                        ...settings,
                                        trimDoubleSpaces: checked as boolean
                                    }
                                })
                            }
                        />
                        <Label htmlFor="trimSpaces" className="text-sm text-muted-foreground">
                            Trim Double+ Spaces
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="collapseLines"
                            checked={settings.collapseConsecutiveLines}
                            onCheckedChange={(checked) =>
                                onUpdate({
                                    settings: {
                                        ...settings,
                                        collapseConsecutiveLines: checked as boolean
                                    }
                                })
                            }
                        />
                        <Label htmlFor="collapseLines" className="text-sm text-muted-foreground">
                            Collapse Consecutive Lines
                        </Label>
                    </div>
                </div>

                {/* Middle Column - Template Type and Prefix Messages */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Template Type</Label>
                        <RadioGroup
                            value={settings.chatCompletion ? "chat" : "text"}
                            onValueChange={(value) =>
                                onUpdate({
                                    settings: {
                                        ...settings,
                                        chatCompletion: value === "chat",
                                        textCompletion: value === "text"
                                    }
                                })
                            }
                            className="flex space-x-4"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="chat" id="chat" />
                                <Label htmlFor="chat" className="text-sm text-muted-foreground">Chat Completion</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="text" id="text" />
                                <Label htmlFor="text" className="text-sm text-muted-foreground">Text Completion</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Prefix Messages with Character Names</Label>
                        <RadioGroup
                            value={settings.prefixMessages.type}
                            onValueChange={(value) =>
                                onUpdate({
                                    settings: {
                                        ...settings,
                                        prefixMessages: {
                                            ...settings.prefixMessages,
                                            type: value as "never" | "always" | "characters"
                                        }
                                    }
                                })
                            }
                            className="flex space-x-4"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="never" id="never" />
                                <Label htmlFor="never" className="text-sm text-muted-foreground">Never</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="always" id="always" />
                                <Label htmlFor="always" className="text-sm text-muted-foreground">Always</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="characters" id="characters" />
                                <Label htmlFor="characters" className="text-sm text-muted-foreground">Only 2+ Characters</Label>
                            </div>
                        </RadioGroup>
                    </div>
                </div>

                {/* Right Column - Additional Checkboxes */}
                <div className="space-y-2">
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
                                            enabled: checked as boolean
                                        }
                                    }
                                })
                            }
                        />
                        <Label htmlFor="mergeMessages" className="text-sm text-muted-foreground">
                            Merge all messages on User
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="applyCensorship"
                            checked={false} // Add to settings if needed
                            onCheckedChange={() => {}}
                        />
                        <Label htmlFor="applyCensorship" className="text-sm text-muted-foreground">
                            Apply censorship to messages
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="mergeSubsequent"
                            checked={false} // Add to settings if needed
                            onCheckedChange={() => {}}
                        />
                        <Label htmlFor="mergeSubsequent" className="text-sm text-muted-foreground">
                            Merge subsquent Messages
                        </Label>
                    </div>
                </div>
            </div>
        </div>
    );
} 