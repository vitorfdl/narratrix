import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Trash, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { SystemPrompt, SystemPromptType } from "@/types/inference";
import { ResizableTextarea } from "@/components/ui/ResizableTextarea";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SystemPromptItemProps {
    prompt: SystemPrompt;
    onUpdate: (updates: Partial<SystemPrompt>) => void;
    onDelete: () => void;
}

function SystemPromptItem({ prompt, onUpdate, onDelete }: SystemPromptItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: prompt.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <Card ref={setNodeRef} style={style}>
            <CardContent className="p-2 space-y-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div
                            {...attributes}
                            {...listeners}
                            className="cursor-grab"
                        >
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                onUpdate({ isCollapsed: !prompt.isCollapsed })
                            }
                        >
                            {prompt.isCollapsed ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronUp className="h-4 w-4" />
                            )}
                        </Button>
                        <div className="font-medium">{prompt.name}</div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onDelete}
                    >
                        <Trash className="h-4 w-4" />
                    </Button>
                </div>

                {!prompt.isCollapsed && (
                    <div className="space-y-4">
                        <div>
                            <ResizableTextarea
                                value={prompt.content}
                                onChange={(e) =>
                                    onUpdate({ content: e.target.value })
                                }
                            />
                        </div>

                        <div className="flex space-x-4">
                            {/* <div className="flex items-center space-x-2">
                                <Checkbox
                                    id={`applyCensorship-${prompt.id}`}
                                    checked={prompt.settings?.applyCensorship}
                                    onCheckedChange={(checked) =>
                                        onUpdate({
                                            settings: {
                                                ...prompt.settings,
                                                applyCensorship: checked as boolean,
                                            },
                                        })
                                    }
                                />
                                <Label htmlFor={`applyCensorship-${prompt.id}`}>
                                    Apply Censorship
                                </Label>
                            </div> */}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

interface SystemPromptSectionProps {
    prompts: SystemPrompt[];
    onUpdate: (prompts: SystemPrompt[]) => void;
}

export function SystemPromptSection({
    prompts,
    onUpdate,
}: SystemPromptSectionProps) {
    const [selectedType, setSelectedType] = useState<SystemPromptType | "">("");

    const handleAddPrompt = () => {
        if (!selectedType) return;

        const newPrompt: SystemPrompt = {
            id: crypto.randomUUID(),
            type: selectedType,
            name: selectedType
                .replace(/([A-Z])/g, " $1")
                .toLowerCase()
                .replace(/^./, (str) => str.toUpperCase()),
            content: "",
            order: prompts.length,
            isCollapsed: true,
            settings: {
                useGlobal: false,
                mergeMessages: false,
                applyCensorship: false,
            },
        };

        onUpdate([...prompts, newPrompt]);
        setSelectedType("");
    };

    const handleUpdatePrompt = (id: string, updates: Partial<SystemPrompt>) => {
        onUpdate(
            prompts.map((prompt) =>
                prompt.id === id ? { ...prompt, ...updates } : prompt
            )
        );
    };

    const handleDeletePrompt = (id: string) => {
        onUpdate(prompts.filter((prompt) => prompt.id !== id));
    };

    const availableTypes = Object.values(SystemPromptType).filter(
        (type) => !prompts.some((prompt) => prompt.type === type)
    );

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>System Prompts</CardTitle>
                <div className="flex items-center space-x-2">
                    <Select
                        value={selectedType}
                        onValueChange={(value) =>
                            setSelectedType(value as SystemPromptType)
                        }
                    >
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Add Section" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                    {type
                                        .replace(/([A-Z])/g, " $1")
                                        .toLowerCase()
                                        .replace(/^./, (str) => str.toUpperCase())}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleAddPrompt}
                        disabled={!selectedType}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {prompts.map((prompt) => (
                    <SystemPromptItem
                        key={prompt.id}
                        prompt={prompt}
                        onUpdate={(updates) =>
                            handleUpdatePrompt(prompt.id, updates)
                        }
                        onDelete={() => handleDeletePrompt(prompt.id)}
                    />
                ))}
            </CardContent>
        </Card>
    );
} 