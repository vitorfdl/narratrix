import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Trash, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { SystemPrompt, SystemPromptType } from "@/schema/inference";
import { ResizableTextarea } from "@/components/ui/ResizableTextarea";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TemplatePicker, Template } from "./TemplatePicker";
import '../styles/shared.css';

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
        <Card ref={setNodeRef} style={{ ...style, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
            <CardContent className="p-1 space-y-1 select-none">
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
                        <div className="font-medium text-sm">{prompt.name}</div>
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
                        <div className="mb-2 mr-1 ml-1">
                            <ResizableTextarea
                                value={prompt.content}
                                onChange={(e) =>
                                    onUpdate({ content: e.target.value })
                                }
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

interface SystemPromptSectionProps {
    prompts: SystemPrompt[];
    templates: Template[];
    selectedTemplateId: string | null;
    onTemplateSelect: (templateId: string) => void;
    onUpdate: (prompts: SystemPrompt[]) => void;
    onDeleteTemplate: (templateId: string) => void;
    onNewTemplate: () => void;
    onEditTemplateName: (templateId: string) => void;
    onTemplateImport: (templateId: string) => void;
    onTemplateExport: (templateId: string) => void;
}

export function SystemPromptSection({
    prompts,
    templates,
    selectedTemplateId,
    onTemplateSelect,
    onUpdate,
    onDeleteTemplate,
    onNewTemplate,
    onEditTemplateName,
    onTemplateImport,
    onTemplateExport
}: SystemPromptSectionProps) {
    const [useGlobal, setUseGlobal] = useState(false);

    const handleAddPrompt = (type: SystemPromptType) => {
        const newPrompt: SystemPrompt = {
            id: crypto.randomUUID(),
            type,
            name: type
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
        <Card className="rounded-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="inference-section-header">System Prompts</CardTitle>
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="useGlobal"
                        checked={useGlobal}
                        onCheckedChange={(checked) => setUseGlobal(checked as boolean)}
                    />
                    <Label htmlFor="useGlobal" className="text-sm text-muted-foreground">
                        Use Global
                    </Label>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {!useGlobal && (
                    <div className="mb-4">
                        <TemplatePicker
                            templates={templates}
                            selectedTemplateId={selectedTemplateId}
                            onTemplateSelect={onTemplateSelect}
                            onDelete={() => onDeleteTemplate(selectedTemplateId ?? '')}
                            onNewTemplate={onNewTemplate}
                            onEditName={() => onEditTemplateName(selectedTemplateId ?? '')}
                            onImport={() => onTemplateImport(selectedTemplateId ?? '')}
                            onExport={() => onTemplateExport(selectedTemplateId ?? '')}
                        />
                    </div>
                )}
                <div className="space-y-1">
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
                </div>

                {availableTypes.length > 0 && (
                    <div className="flex justify-center pt-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-dashed border-2 hover:border-solid"
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Section
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="w-56">
                                {availableTypes.map((type) => (
                                    <DropdownMenuItem
                                        key={type}
                                        onClick={() => handleAddPrompt(type)}
                                        className="font-normal font-sans text-xs"
                                    >
                                        {type
                                            .replace(/([A-Z])/g, " $1")
                                            .toLowerCase()
                                            .replace(/^./, (str) => str.toUpperCase())}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </CardContent>
        </Card>
    );
} 