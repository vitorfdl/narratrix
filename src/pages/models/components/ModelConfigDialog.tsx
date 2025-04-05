import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StepButton } from "@/components/ui/step-button";
import { useInferenceTemplateList } from "@/hooks/templateStore";
import { Model } from "@/schema/models-schema";
import { CheckCircleIcon, MessageCircleIcon, Settings2Icon } from "lucide-react";
import { useEffect, useState } from "react";

interface ModelConfigDialogProps {
  model: Model;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (modelId: string, updates: { max_concurrency: number; inference_template_id?: string | null }) => Promise<void>;
  isUpdating: boolean;
}

export function ModelConfigDialog({ model, open, onOpenChange, onSave, isUpdating }: ModelConfigDialogProps) {
  const inferenceTemplates = useInferenceTemplateList();
  const [maxConcurrency, setMaxConcurrency] = useState(model.max_concurrency);
  const [inferenceTemplateID, setInferenceTemplateID] = useState(model.inference_template_id || null);
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setMaxConcurrency(model.max_concurrency);
      setInferenceTemplateID(model.inference_template_id || null);
    }
  }, [open, model]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(model.id, {
        max_concurrency: maxConcurrency,
        inference_template_id: inferenceTemplateID === "none" ? null : inferenceTemplateID,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex gap-2 items-center">
            <Settings2Icon className="h-5 w-5" />
            Model Configuration
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="concurrency" className="text-right">
              Max Concurrency
            </Label>
            <StepButton id="concurrency" className="col-span-3" min={1} max={10} step={1} value={maxConcurrency} onValueChange={setMaxConcurrency} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="format" className="text-right">
              Format Template
            </Label>
            <Select value={inferenceTemplateID || "none"} onValueChange={setInferenceTemplateID}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select format template" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                <SelectGroup>
                  <SelectLabel className="flex items-center gap-2 text-primary">
                    <MessageCircleIcon className="h-4 w-4" />
                    Default Mode
                  </SelectLabel>
                  <SelectItem value="none" className="pl-8 flex items-center gap-2 font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4 text-primary" />
                      Use Chat Completion
                    </div>
                  </SelectItem>
                </SelectGroup>

                <SelectSeparator className="my-2" />

                {inferenceTemplates.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="flex items-center gap-2 text-primary">
                      <Settings2Icon className="h-4 w-4" />
                      Text Completion Templates
                    </SelectLabel>
                    {inferenceTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id} className="pl-8">
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving || isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isUpdating}>
            {isSaving || isUpdating ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
