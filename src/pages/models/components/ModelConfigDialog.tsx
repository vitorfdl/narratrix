import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StepButton } from "@/components/ui/step-button";
import { useModelManifests } from "@/hooks/manifestStore";
import { InstructTemplateSection } from "@/pages/models/components/InferenceTemplateSection";
import { Model } from "@/schema/models-schema";
import { CheckCircleIcon, Settings2Icon, XCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface ModelConfigDialogProps {
  model: Model;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (modelId: string, updates: { max_concurrency: number; inference_template_id?: string | null }) => Promise<void>;
  isUpdating: boolean;
}

export function ModelConfigDialog({ model, open, onOpenChange, onSave, isUpdating }: ModelConfigDialogProps) {
  const [maxConcurrency, setMaxConcurrency] = useState<number>(model.max_concurrency);
  const [completionType, setCompletionType] = useState<"chat" | "text">("chat");
  const [inferenceTemplateID, setInferenceTemplateID] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const manifests = useModelManifests();

  // Find the manifest for the current model
  const modelManifest = manifests.find((m) => m.id === model.manifest_id);
  const supportsCompletion = modelManifest?.inference_type?.includes("completion") ?? false;

  // Reset form when dialog opens or model changes
  useEffect(() => {
    if (open) {
      setMaxConcurrency(model.max_concurrency);

      // Set inference template ID and completion type based on model
      const templateId = model.inference_template_id || null;
      setInferenceTemplateID(templateId);

      // If there's a template ID, we're in text completion mode, otherwise chat
      setCompletionType(templateId ? "text" : "chat");
    }
  }, [open, model]);

  // Handle template selection
  const handleTemplateChange = (templateId: string | null) => {
    setInferenceTemplateID(templateId);
  };

  // Handle completion type change
  const handleCompletionTypeChange = (value: string) => {
    const newType = value as "chat" | "text";
    setCompletionType(newType);

    // If switching to chat mode, clear the template
    if (newType === "chat") {
      setInferenceTemplateID(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(model.id, {
        max_concurrency: maxConcurrency,
        inference_template_id: completionType === "text" ? inferenceTemplateID : null,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={!supportsCompletion ? "default" : "window"}>
        {/* Sticky Header */}
        <DialogHeader>
          <DialogTitle className="flex gap-2 items-center">
            <Settings2Icon className="h-5 w-5" />
            Model Configuration <span className="italic text-muted-foreground">{model.name}</span>
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {/* Max Concurrency Field */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-muted/40 rounded-lg p-4">
            <Label htmlFor="concurrency" className="text-base font-medium">
              Max Concurrency
            </Label>
            <StepButton id="concurrency" min={1} max={10} step={1} value={maxConcurrency} onValueChange={setMaxConcurrency} />
          </div>

          {/* Inference Mode Field and Instruct Template Section */}
          {supportsCompletion && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-muted/40 rounded-lg p-4">
                <Label htmlFor="completionType" className="text-base font-medium">
                  Inference Mode
                </Label>
                <RadioGroup id="completionType" className="flex flex-row gap-2" value={completionType} onValueChange={handleCompletionTypeChange}>
                  <RadioGroupItem value="chat" id="chat-mode" />
                  <Label htmlFor="chat-mode" className="mr-2 cursor-pointer select-none">
                    Chat Completion
                  </Label>
                  <RadioGroupItem value="text" id="text-mode" />
                  <Label htmlFor="text-mode" className="cursor-pointer select-none">
                    Text Completion
                  </Label>
                </RadioGroup>
              </div>

              <InstructTemplateSection disabled={completionType !== "text"} onChange={handleTemplateChange} modelTemplateID={inferenceTemplateID} />
            </>
          )}
        </DialogBody>

        {/* Sticky Footer */}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving || isUpdating}>
            <XCircleIcon className="h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} className="px-6 min-w-[140px] ">
            <CheckCircleIcon className="h-4 w-4" />
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
