import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { InferenceTemplate, SystemPrompt, SystemPromptType } from "@/schema/inference-template";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { ExtraSections } from "./components/ExtrasSection";
import { ModelInstructionSection } from "./components/ModelInstructionSection";
import { SystemPromptSection } from "./components/SystemPromptSection";
import { TemplateHeader } from "./components/TemplateHeader";

// Mock data - replace with API call later
const mockTemplate: InferenceTemplate = {
  id: "1",
  name: "Default Template",
  description: "A default inference template",
  modelInstructions: {
    systemPromptFormatting: {
      prefix: "[INT]",
      suffix: "[INT]",
    },
    userMessageFormatting: {
      prefix: "[INT]",
      suffix: "[INT]",
    },
    assistantMessageFormatting: {
      prefix: "[INT]",
      suffix: "[INT]",
      prefill: "[INT]",
      prefillOnlyCharacters: false,
    },
    agentMessageFormatting: {
      useSameAsUser: false,
      useSameAsSystemPrompt: false,
      prefix: "[INT]",
      suffix: "[INT]",
    },
    customStopStrings: ["[INT]"],
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
        applyCensorship: false,
      },
    },
  ],
  reasoning: {
    prefix: "<think>",
    suffix: "</think>",
  },
  settings: {
    trimAssistantIncomplete: true,
    trimDoubleSpaces: true,
    collapseConsecutiveLines: true,
    chatCompletion: true,
    textCompletion: false,
    prefixMessages: {
      enabled: true,
      type: "never",
    },
    mergeMessagesOnUser: false,
    applyCensorship: false,
    mergeSubsequentMessages: false,
  },
};

export default function InferenceTemplatePage() {
  const [template, setTemplate] = useState<InferenceTemplate>(mockTemplate);
  const [isDocOpen, setIsDocOpen] = useState(false);

  const handleSystemPromptReorder = (items: SystemPrompt[]) => {
    setTemplate((prev) => ({
      ...prev,
      systemPrompts: items,
    }));
  };

  const handleDelete = () => {};

  const handleNewTemplate = () => {};

  const handleEditName = () => {};

  const handleImport = () => {};

  const handleExport = () => {};

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
        onUpdate={(updates) =>
          setTemplate((prev) => ({
            ...prev,
            settings: {
              ...prev.settings,
              ...updates.settings,
            },
          }))
        }
        onDelete={handleDelete}
        onNewTemplate={handleNewTemplate}
        onEditName={handleEditName}
        onImport={handleImport}
        onExport={handleExport}
        templates={[]}
        selectedTemplateId={null}
        onTemplateSelect={(_templateId: string): void => {
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
                    (item) => item.id === active.id,
                  );
                  const newIndex = template.systemPrompts.findIndex((item) => item.id === over.id);

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
                    setTemplate((prev) => ({ ...prev, systemPrompts: prompts }))
                  }
                  templates={[]}
                  selectedTemplateId={null}
                  onTemplateSelect={(_templateId: string): void => {
                    throw new Error("Function not implemented.");
                  }}
                  onDeleteTemplate={(_templateId: string): void => {
                    throw new Error("Function not implemented.");
                  }}
                  onNewTemplate={(): void => {
                    throw new Error("Function not implemented.");
                  }}
                  onEditTemplateName={(_templateId: string): void => {
                    throw new Error("Function not implemented.");
                  }}
                  onTemplateImport={(_templateId: string): void => {
                    throw new Error("Function not implemented.");
                  }}
                  onTemplateExport={(_templateId: string): void => {
                    throw new Error("Function not implemented.");
                  }}
                />
              </SortableContext>
            </DndContext>
          </div>

          <ExtraSections
            reasoning={template.reasoning}
            onUpdate={(reasoning) => setTemplate((prev) => ({ ...prev, reasoning }))}
          />
        </div>

        <ModelInstructionSection
          {...template.modelInstructions}
          onUpdate={(updates) =>
            setTemplate((prev) => ({
              ...prev,
              modelInstructions: {
                ...prev.modelInstructions,
                ...updates,
              },
            }))
          }
          templates={[]}
          selectedTemplateId={null}
          onTemplateSelect={(_templateId: string): void => {
            throw new Error("Function not implemented.");
          }}
          onDeleteTemplate={(_templateId: string): void => {
            throw new Error("Function not implemented.");
          }}
          onNewTemplate={(): void => {
            throw new Error("Function not implemented.");
          }}
          onEditTemplateName={(_templateId: string): void => {
            throw new Error("Function not implemented.");
          }}
          onTemplateImport={(_templateId: string): void => {
            throw new Error("Function not implemented.");
          }}
          onTemplateExport={(_templateId: string): void => {
            throw new Error("Function not implemented.");
          }}
        />
      </div>
    </div>
  );
}
