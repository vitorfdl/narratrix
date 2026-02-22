import { useEffect, useMemo, useRef, useState } from "react";
import { LuCircleCheck, LuCircleX, LuSettings2 } from "react-icons/lu";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StepButton } from "@/components/ui/step-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModelManifests } from "@/hooks/manifestStore";
import { InstructTemplateSection } from "@/pages/models/components/InferenceTemplateSection";
import type { Manifest } from "@/schema/model-manifest-schema";
import type { Model } from "@/schema/models-schema";
import { ModelForm, type ModelFormRef } from "./ModelForm";

interface ModelDialogProps {
  mode: "add" | "edit";
  model?: Model;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ModelDialog({ mode, model, open, onOpenChange, onSuccess }: ModelDialogProps) {
  const formRef = useRef<ModelFormRef>(null);
  const manifests = useModelManifests();

  const [activeTab, setActiveTab] = useState<string>(mode === "add" ? "connection" : "inference");
  const [maxConcurrency, setMaxConcurrency] = useState<number>(1);
  const [completionType, setCompletionType] = useState<"chat" | "text">("chat");
  const [inferenceTemplateID, setInferenceTemplateID] = useState<string | null>(null);
  const [selectedManifest, setSelectedManifest] = useState<Manifest | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const modelManifest = model ? manifests.find((m) => m.id === model.manifest_id) : selectedManifest;
  const supportsCompletion = modelManifest?.inference_type?.includes("completion") ?? false;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === "edit" && model) {
      setMaxConcurrency(model.max_concurrency);
      const templateId = model.inference_template_id || null;
      setInferenceTemplateID(templateId);
      setCompletionType(templateId ? "text" : "chat");
      setActiveTab("inference");
    } else {
      setMaxConcurrency(1);
      setInferenceTemplateID(null);
      setCompletionType("chat");
      setSelectedManifest(null);
      setActiveTab("connection");
    }
  }, [open, mode, model]);

  const handleCompletionTypeChange = (value: string) => {
    const newType = value as "chat" | "text";
    setCompletionType(newType);
    if (newType === "chat") {
      setInferenceTemplateID(null);
    }
  };

  const inferenceData = useMemo(
    () => ({
      max_concurrency: maxConcurrency,
      inference_template_id: completionType === "text" ? inferenceTemplateID : null,
    }),
    [maxConcurrency, completionType, inferenceTemplateID],
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      formRef.current?.submit();
    } catch (error) {
      console.error("Failed to save model:", error);
      setIsSaving(false);
    }
  };

  const handleSuccess = () => {
    setIsSaving(false);
    onSuccess();
    onOpenChange(false);
  };

  const handleManifestChange = (manifest: Manifest | null) => {
    setSelectedManifest(manifest);
  };

  const dialogSize = supportsCompletion && activeTab === "inference" ? "window" : "large";
  const title = mode === "add" ? "Add New Model" : `Model Settings`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={dialogSize} allowClickOutsideClose={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LuSettings2 className="h-5 w-5 text-primary" />
            {title}
            {mode === "edit" && model && <span className="italic text-muted-foreground">{model.name}</span>}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="connection">Connection</TabsTrigger>
            <TabsTrigger value="inference" disabled={mode === "add"}>
              Inference
            </TabsTrigger>
          </TabsList>

          <TabsContent forceMount value="connection" className={`flex-1 overflow-hidden ${activeTab !== "connection" ? "hidden" : ""}`}>
            <DialogBody>
              <ModelForm
                ref={formRef}
                mode={mode === "edit" ? "edit" : "add"}
                model={model}
                hideSubmit
                inferenceData={inferenceData}
                onManifestChange={handleManifestChange}
                onSuccess={handleSuccess}
              />
            </DialogBody>
          </TabsContent>

          <TabsContent value="inference" className="flex-1 overflow-hidden">
            <DialogBody>
              <div className="grid gap-6">
                <div className="space-y-2">
                  <Label htmlFor="concurrency" className="text-sm font-medium">
                    Max Concurrency
                  </Label>
                  <StepButton id="concurrency" min={1} max={10} step={1} value={maxConcurrency} onValueChange={setMaxConcurrency} />
                </div>

                {supportsCompletion && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="completionType" className="text-sm font-medium">
                        Inference Mode
                      </Label>
                      <RadioGroup id="completionType" className="flex flex-row gap-4" value={completionType} onValueChange={handleCompletionTypeChange}>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="chat" id="chat-mode" />
                          <Label htmlFor="chat-mode" className="cursor-pointer select-none">
                            Chat Completion
                          </Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="text" id="text-mode" />
                          <Label htmlFor="text-mode" className="cursor-pointer select-none">
                            Text Completion
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <InstructTemplateSection disabled={completionType !== "text"} onChange={setInferenceTemplateID} modelTemplateID={inferenceTemplateID} />
                  </>
                )}
              </div>
            </DialogBody>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            <LuCircleX className="h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} size="dialog" className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors">
            <LuCircleCheck className="h-4 w-4" />
            {mode === "add" ? "Create Model" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
