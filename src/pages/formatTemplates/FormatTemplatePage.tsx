import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useFormatTemplateList, useTemplateActions, useTemplateError } from "@/hooks/templateStore";
import { useSessionCurrentFormatTemplate } from "@/utils/session-storage";
import { HelpCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ExtraSections } from "./components/ExtrasSection";
import { InstructTemplateSection } from "./components/InstructTemplateSection";
import { SystemPromptTemplateSection } from "./components/SystemTemplateSection";
import { TemplateHeader } from "./components/TemplateHeader";

export default function FormatTemplatePage() {
  const [isDocOpen, setIsDocOpen] = useState(false);
  const currentProfile = useCurrentProfile();
  const [selectedTemplateId, setSelectedTemplateId] = useSessionCurrentFormatTemplate();
  const error = useTemplateError();
  const { getFormatTemplatesByProfile } = useTemplateActions();

  // Find the current template from store based on selected ID using useMemo
  const formatTemplates = useFormatTemplateList();
  // const currentTemplate = useFormatTemplate(selectedTemplateId ?? "");

  // Fetch templates when profile changes
  useEffect(() => {
    if (!currentProfile?.id) {
      return;
    }

    getFormatTemplatesByProfile(currentProfile!.id);
  }, [currentProfile?.id]);

  // Auto-select first template or create default one if none exists
  useEffect(() => {
    const ensureTemplateSelected = async () => {
      // Skip if we already have a selected template
      if (selectedTemplateId && formatTemplates.some((t) => t.id === selectedTemplateId)) {
        return;
      }

      // If templates are loaded but none selected, auto-select the first
      if (formatTemplates.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(formatTemplates[0].id);
        return;
      }
    };

    ensureTemplateSelected();
  }, [formatTemplates, selectedTemplateId]);

  // Handle template selection change
  const handleTemplateChange = useCallback((templateId: string | null) => {
    setSelectedTemplateId(templateId);
  }, []);

  return (
    <div className="space-y-2 page-container">
      <div className="flex gap-2 items-center">
        <h1 className="title">Formatting Template</h1>
        <Sheet open={isDocOpen} onOpenChange={setIsDocOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
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

      {error && <div className="text-destructive">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="space-y-2">
          <TemplateHeader formatTemplateID={selectedTemplateId} onTemplateChange={handleTemplateChange} />
          <SystemPromptTemplateSection formatTemplateID={selectedTemplateId} />
          <ExtraSections formatTemplateID={selectedTemplateId} />
        </div>

        <InstructTemplateSection />
      </div>
    </div>
  );
}
