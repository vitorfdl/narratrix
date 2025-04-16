import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatTemplate, useTemplateActions } from "@/hooks/templateStore";
import { BrainCircuitIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { LabeledInput } from "../../models/components/InferenceTemplateSection";

interface ExtraSectionsProps {
  formatTemplateID: string | null;
}

// Custom hooks for atomic selectors - optimizes renders

export function ExtraSections({ formatTemplateID }: ExtraSectionsProps) {
  const currentTemplate = useFormatTemplate(formatTemplateID ?? "");
  const { updateFormatTemplate } = useTemplateActions();

  // Memoize the reasoning object from currentTemplate
  const reasoning = useMemo(() => currentTemplate?.config.reasoning ?? null, [currentTemplate?.config.reasoning]);

  // Local state for input fields
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");

  // Update local state when reasoning changes from store
  useEffect(() => {
    if (reasoning) {
      setPrefix(reasoning.prefix || "");
      setSuffix(reasoning.suffix || "");
    }
  }, [reasoning]);

  // Single debounced update that uses current state values
  const debouncedUpdate = useDebouncedCallback(async () => {
    if (!currentTemplate || !reasoning) {
      return;
    }

    const updatedReasoning = {
      ...reasoning,
      prefix,
      suffix,
    };

    await updateFormatTemplate(currentTemplate.id, {
      config: {
        ...currentTemplate.config,
        reasoning: updatedReasoning,
      },
    });
  }, 100);

  // Handler for updating reasoning fields
  const handleFieldChange = useCallback(
    (key: "prefix" | "suffix", value: string) => {
      if (!currentTemplate || !reasoning) {
        return;
      }

      if (key === "prefix") {
        setPrefix(value);
      } else {
        setSuffix(value);
      }

      // Trigger the debounced update after state changes
      // React batches state updates, so this will run with the latest values
      debouncedUpdate();
    },
    [currentTemplate, reasoning, debouncedUpdate],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="inference-section-header">Miscellaneous</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Card>
            <CardHeader className="template-card-header">
              <CardTitle className="template-card-title">
                <BrainCircuitIcon className="h-4 w-4" /> Reasoning
                <HelpTooltip>
                  <p>
                    Define the markers used to identify reasoning text within the assistant's response.
                    <br />
                    <br />
                    The content between the specified <strong>Prefix</strong> and <strong>Suffix</strong> will be automatically extracted from the
                    main chat message and displayed in a separate reasoning section.
                  </p>
                </HelpTooltip>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <LabeledInput
                label="Prefix"
                value={prefix}
                placeholder=""
                disabled={!currentTemplate}
                onChange={(val) => handleFieldChange("prefix", val)}
              />
              <LabeledInput
                label="Suffix"
                value={suffix}
                placeholder=""
                disabled={!currentTemplate}
                onChange={(val) => handleFieldChange("suffix", val)}
              />
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
