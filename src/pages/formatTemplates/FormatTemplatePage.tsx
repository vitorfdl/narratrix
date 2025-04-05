import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useProfile } from "@/hooks/ProfileContext";
import { useFormatTemplate, useFormatTemplateList, useTemplateActions, useTemplateError } from "@/hooks/templateStore";
import { useSessionCurrentFormatTemplate } from "@/utils/session-storage";
import { HelpCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ExtraSections } from "./components/ExtrasSection";
import { InstructTemplateSection } from "./components/InstructTemplateSection";
import { SystemPromptTemplateSection } from "./components/SystemTemplateSection";
import { TemplateHeader } from "./components/TemplateHeader";

export default function FormatTemplatePage() {
  const [isDocOpen, setIsDocOpen] = useState(false);
  const profile = useProfile();
  const [selectedTemplateId, setSelectedTemplateId] = useSessionCurrentFormatTemplate();
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [templateCreationFailed, setTemplateCreationFailed] = useState(false);
  const error = useTemplateError();
  const { getFormatTemplatesByProfile, updateFormatTemplate, createFormatTemplate } = useTemplateActions();

  // Find the current template from store based on selected ID using useMemo
  const formatTemplates = useFormatTemplateList();
  const currentTemplate = useFormatTemplate(selectedTemplateId ?? "");

  // Fetch templates when profile changes
  useEffect(() => {
    if (!profile?.currentProfile?.id) {
      return;
    }

    getFormatTemplatesByProfile(profile.currentProfile.id);
  }, [profile?.currentProfile?.id]);

  // Auto-select first template or create default one if none exists
  useEffect(() => {
    const ensureTemplateSelected = async () => {
      // Skip if we're already creating a template or if creation failed
      if (isCreatingTemplate || templateCreationFailed) {
        return;
      }

      // Skip if we already have a selected template
      if (selectedTemplateId && formatTemplates.some((t) => t.id === selectedTemplateId)) {
        return;
      }

      // If templates are loaded but none selected, auto-select the first
      if (formatTemplates.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(formatTemplates[0].id);
        return;
      }

      // Create a default template if none exist
      if (formatTemplates.length === 0 && profile?.currentProfile?.id) {
        try {
          setIsCreatingTemplate(true);

          // Create a default template with minimum required fields
          const newTemplate = await createFormatTemplate({
            name: "Default Format Template",
            profile_id: profile.currentProfile.id,
            config: {
              settings: {
                trim_assistant_incomplete: false,
                trim_double_spaces: false,
                collapse_consecutive_lines: false,
                prefix_messages: "never",
                apply_censorship: false,
                merge_messages_on_user: false,
                merge_subsequent_messages: false,
              },
              reasoning: {
                prefix: "<think>\n",
                suffix: "</think>",
              },
            },
            prompts: [],
          });

          setSelectedTemplateId(newTemplate.id);
        } catch (err) {
          console.error("Failed to create default template:", err);
          setTemplateCreationFailed(true);
        } finally {
          setIsCreatingTemplate(false);
        }
      }
    };

    ensureTemplateSelected();
  }, [formatTemplates, selectedTemplateId, isCreatingTemplate, templateCreationFailed]);

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
      {templateCreationFailed && (
        <div className="text-destructive">Failed to create default template. Please try refreshing the page or create a template manually.</div>
      )}

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
