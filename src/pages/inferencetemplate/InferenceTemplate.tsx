import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { InferenceTemplate, SystemPrompt, SystemPromptType } from "@/types/inference";
import { TemplateHeader } from "./components/TemplateHeader";
import { ModelInstructionSection } from "./components/ModelInstructionSection";
import { ExtraSections } from "./components/ExtrasSection";
import { SystemPromptSection } from "./components/SystemPromptSection";

// Mock data - replace with API call later
const mockTemplate: InferenceTemplate = {
    id: "1",
    name: "Default Template",
    description: "A default inference template",
    modelInstructions: {
        systemPromptFormatting: {
            prefix: "[INT]",
            suffix: "[INT]"
        },
        userMessageFormatting: {
            prefix: "[INT]",
            suffix: "[INT]"
        },
        assistantMessageFormatting: {
            prefix: "[INT]",
            suffix: "[INT]",
            prefill: "[INT]",
            prefillOnlyCharacters: false
        },
        agentMessageFormatting: {
            useSameAsUser: false,
            useSameAsSystemPrompt: false,
            prefix: "[INT]",
            suffix: "[INT]"
        },
        customStopStrings: ["[INT]"]
    },
    systemPrompts: [
        {
            id: "1",
            type: SystemPromptType.Context,
            name: "System Context",
            content: "",
            order: 0,
            settings: {
                useGlobal: false,
                mergeMessages: false,
                applyCensorship: false
            }
        }
    ],
    reasoning: {
        prefix: "<think>",
        suffix: "</think>"
    },
    settings: {
        trimAssistantIncomplete: true,
        trimDoubleSpaces: true,
        collapseConsecutiveLines: true,
        chatCompletion: true,
        textCompletion: false,
        prefixMessages: {
            enabled: true,
            type: "never"
        },
        mergeMessagesOnUser: false,
        applyCensorship: false,
        mergeSubsequentMessages: false
    }
};

export default function InferenceTemplatePage() {
    const [template, setTemplate] = useState<InferenceTemplate>(mockTemplate);
    const [isDocOpen, setIsDocOpen] = useState(false);

    const handleSystemPromptReorder = (items: SystemPrompt[]) => {
        setTemplate(prev => ({
            ...prev,
            systemPrompts: items
        }));
    };

    const handleDelete = () => {
        // TODO: Implement delete functionality
        console.log("Delete template");
    };

    const handleNewTemplate = () => {
        // TODO: Implement new template functionality
        console.log("Create new template");
    };

    const handleEditName = () => {
        // TODO: Implement edit name functionality
        console.log("Edit template name");
    };

    const handleImport = () => {
        // TODO: Implement import functionality
        console.log("Import template");
    };

    const handleExport = () => {
        // TODO: Implement export functionality
        console.log("Export template");
    };

    return (
        <div className="container mx-auto p-6 space-y-2">
            <div className="flex gap-2 items-center">
                <h1 className="text-2xl font-bold text-white">Inference Template</h1>
                <Sheet open={isDocOpen} onOpenChange={setIsDocOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <HelpCircle className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent>
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold">Documentation</h2>
                            <p>Documentation content from public folder will be loaded here.</p>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            <TemplateHeader
                settings={template.settings}
                onUpdate={(updates) => setTemplate(prev => ({
                    ...prev,
                    settings: {
                        ...prev.settings,
                        ...updates.settings
                    }
                }))}
                onDelete={handleDelete}
                onNewTemplate={handleNewTemplate}
                onEditName={handleEditName}
                onImport={handleImport}
                onExport={handleExport}
                templates={[]}
                selectedTemplateId={null}
                onTemplateSelect={function (_templateId: string): void {
                    throw new Error("Function not implemented.");
                }}
            />

            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">

                    <div>
                        <DndContext
                            collisionDetection={closestCenter}
                            onDragEnd={({ active, over }) => {
                                if (over && active.id !== over.id) {
                                    const oldIndex = template.systemPrompts.findIndex(
                                        item => item.id === active.id
                                    );
                                    const newIndex = template.systemPrompts.findIndex(
                                        item => item.id === over.id
                                    );

                                    const newItems = [...template.systemPrompts];
                                    const [removed] = newItems.splice(oldIndex, 1);
                                    newItems.splice(newIndex, 0, removed);

                                    handleSystemPromptReorder(newItems);
                                }
                            }}
                        >
                            <SortableContext
                                items={template.systemPrompts}
                                strategy={verticalListSortingStrategy}
                            >
                                <SystemPromptSection
                                    prompts={template.systemPrompts}
                                    onUpdate={(prompts) =>
                                        setTemplate(prev => ({ ...prev, systemPrompts: prompts }))
                                    }
                                    templates={[]}
                                    selectedTemplateId={null}
                                    onTemplateSelect={function (_templateId: string): void {
                                        throw new Error("Function not implemented.");
                                    }}
                                    onDeleteTemplate={function (_templateId: string): void {
                                        throw new Error("Function not implemented.");
                                    }}
                                    onNewTemplate={function (): void {
                                        throw new Error("Function not implemented.");
                                    }}
                                    onEditTemplateName={function (_templateId: string): void {
                                        throw new Error("Function not implemented.");
                                    }}
                                    onTemplateImport={function (_templateId: string): void {
                                        throw new Error("Function not implemented.");
                                    }}
                                    onTemplateExport={function (_templateId: string): void {
                                        throw new Error("Function not implemented.");
                                    }}

                                />
                            </SortableContext>
                        </DndContext>
                    </div>

                    <ExtraSections
                        reasoning={template.reasoning}
                        onUpdate={(reasoning) =>
                            setTemplate(prev => ({ ...prev, reasoning }))
                        }
                    />
                </div>

                <ModelInstructionSection
                    {...template.modelInstructions}
                    onUpdate={(updates) =>
                        setTemplate(prev => ({
                            ...prev,
                            modelInstructions: {
                                ...prev.modelInstructions,
                                ...updates
                            }
                        }))
                    }
                    templates={[]}
                    selectedTemplateId={null}
                    onTemplateSelect={function (_templateId: string): void {
                        throw new Error("Function not implemented.");
                    }}
                    onDeleteTemplate={function (_templateId: string): void {
                        throw new Error("Function not implemented.");
                    }}
                    onNewTemplate={function (): void {
                        throw new Error("Function not implemented.");
                    }}
                    onEditTemplateName={function (_templateId: string): void {
                        throw new Error("Function not implemented.");
                    }}
                    onTemplateImport={function (_templateId: string): void {
                        throw new Error("Function not implemented.");
                    }}
                    onTemplateExport={function (_templateId: string): void {
                        throw new Error("Function not implemented.");
                    }}
                />
            </div>
        </div>
    );
}
