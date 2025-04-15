import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const initialCompletionType: "chat" | "text" = model.inference_template_id ? "text" : "chat";
  const [completionType, setCompletionType] = useState<"chat" | "text">(initialCompletionType);
  const [inferenceTemplateID, setInferenceTemplateID] = useState<string | null>(model.inference_template_id || null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const manifests = useModelManifests();

  // Find the manifest for the current model
  const modelManifest = manifests.find((m) => m.id === model.manifest_id);
  const supportsCompletion = modelManifest?.inference_type?.includes("completion") ?? false;

  // Reset form when dialog opens or model changes
  useEffect(() => {
    if (open) {
      setMaxConcurrency(model.max_concurrency);
      setInferenceTemplateID(model.inference_template_id || null);
      setCompletionType(model.inference_template_id ? "text" : "chat");
    }
  }, [open, model]);

  // If user switches to chat, clear template selection
  useEffect(() => {
    if (completionType === "chat") {
      setInferenceTemplateID(null);
    }
  }, [completionType]);

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
      <DialogContent size={!supportsCompletion ? "default" : "window"} className="flex flex-col w-full p-0 bg-background rounded-lg shadow-lg">
        {/* Sticky Header */}
        <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-4">
          <DialogTitle className="flex gap-2 items-center text-lg font-semibold">
            <Settings2Icon className="h-5 w-5" />
            Model Configuration
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
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
                <RadioGroup
                  id="completionType"
                  className="flex flex-row gap-2"
                  value={completionType}
                  onValueChange={(val) => setCompletionType(val as "chat" | "text")}
                >
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

              <InstructTemplateSection disabled={completionType !== "text"} onChange={setInferenceTemplateID} modelTemplateID={inferenceTemplateID} />
            </>
          )}
        </div>

        {/* Sticky Footer */}
        <DialogFooter className="sticky bottom-0 z-10 bg-background/95 backdrop-blur border-t border-border px-6 py-4 flex gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving || isUpdating}>
            <XCircleIcon className="h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isUpdating} className="px-6 min-w-[140px]">
            <CheckCircleIcon className="h-4 w-4" />
            {isSaving || isUpdating ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
