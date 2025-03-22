import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reasoning } from "@/schema/inference-template";
import { LabeledInput } from "./ModelInstructionSection";

interface ExtraSectionsProps {
  reasoning: Reasoning;
  onUpdate: (reasoning: Reasoning) => void;
}

export function ExtraSections({ reasoning, onUpdate }: ExtraSectionsProps) {
  return (
    <div className="space-y-6">
      <Card className="rounded-sm">
        <CardHeader>
          <CardTitle className="inference-section-header">Miscellaneous</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Card className="rounded-sm">
            <CardHeader>
              <CardTitle>Reasoning</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <LabeledInput
                label="Prefix"
                value={reasoning.prefix}
                placeholder=""
                onChange={(val) => onUpdate({ ...reasoning, prefix: val })}
              />
              <LabeledInput
                label="Suffix"
                value={reasoning.suffix}
                placeholder=""
                onChange={(val) => onUpdate({ ...reasoning, suffix: val })}
              />
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
