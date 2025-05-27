import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useFormatTemplateList, useTemplateActions, useTemplateError } from "@/hooks/templateStore";
import { HelpCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ExtraSections } from "./components/ExtrasSection";
import { SystemPromptTemplateSection } from "./components/SystemTemplateSection";
import { TemplateHeader } from "./components/TemplateHeader";

interface FormatTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTemplateId: string | null;
  onTemplateChange: (templateId: string | null) => void;
}

export default function FormatTemplateModal({ open, onOpenChange, selectedTemplateId, onTemplateChange }: FormatTemplateModalProps) {
  const [isDocOpen, setIsDocOpen] = useState(false);
  const currentProfile = useCurrentProfile();
  const error = useTemplateError();
  const { getFormatTemplatesByProfile } = useTemplateActions();

  // Find the current template from store based on selected ID
  const formatTemplates = useFormatTemplateList();

  // Fetch templates when profile changes
  useEffect(() => {
    if (!currentProfile?.id) {
      return;
    }

    getFormatTemplatesByProfile(currentProfile.id);
  }, [currentProfile?.id, getFormatTemplatesByProfile]);

  // Auto-select first template if none exists and templates are loaded
  useEffect(() => {
    const ensureTemplateSelected = async () => {
      // Skip if we already have a selected template
      if (selectedTemplateId && formatTemplates.some((t) => t.id === selectedTemplateId)) {
        return;
      }

      // If templates are loaded but none selected, auto-select the first
      if (formatTemplates.length > 0 && !selectedTemplateId) {
        onTemplateChange(formatTemplates[0].id);
        return;
      }
    };

    ensureTemplateSelected();
  }, [formatTemplates, selectedTemplateId, onTemplateChange]);

  // Handle template selection change
  const handleTemplateChange = useCallback(
    (templateId: string | null) => {
      onTemplateChange(templateId);
    },
    [onTemplateChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="window" className="max-h-[95vh]">
        <DialogHeader>
          <div className="flex gap-2 items-center w-full">
            <DialogTitle className="text-lg font-semibold">Format Template Editor</DialogTitle>
            <Sheet open={isDocOpen} onOpenChange={setIsDocOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-auto">
                  <HelpCircle className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold">Documentation</h2>
                  <p>Select a template to view its documentation.</p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4 flex flex-col items-center py-4">
            {error && <div className="text-destructive">{error}</div>}

            <div className="w-full h-full space-y-4">
              <TemplateHeader formatTemplateID={selectedTemplateId} onTemplateChange={handleTemplateChange} />
              <SystemPromptTemplateSection formatTemplateID={selectedTemplateId} />
              <ExtraSections formatTemplateID={selectedTemplateId} />
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
