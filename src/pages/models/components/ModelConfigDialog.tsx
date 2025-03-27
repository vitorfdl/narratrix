import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StepButton } from "@/components/ui/step-button";
import { useFormatTemplateList } from "@/hooks/templateStore";
import { Model } from "@/schema/models-schema";
import { Settings2Icon } from "lucide-react";
import { useEffect, useState } from "react";

interface ModelConfigDialogProps {
  model: Model;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (modelId: string, updates: { max_concurrency: number; format_template_id?: string }) => Promise<void>;
  isUpdating: boolean;
}

export function ModelConfigDialog({ model, open, onOpenChange, onSave, isUpdating }: ModelConfigDialogProps) {
  const formatTemplates = useFormatTemplateList();
  const [maxConcurrency, setMaxConcurrency] = useState(model.max_concurrency);
  const [formatTemplateId, setFormatTemplateId] = useState(model.format_template_id || "none");
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setMaxConcurrency(model.max_concurrency);
      setFormatTemplateId(model.format_template_id || "none");
    }
  }, [open, model]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(model.id, {
        max_concurrency: maxConcurrency,
        format_template_id: formatTemplateId === "none" ? undefined : formatTemplateId,
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
            <Select value={formatTemplateId} onValueChange={setFormatTemplateId}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select format template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {formatTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
