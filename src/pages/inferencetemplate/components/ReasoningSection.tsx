import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Reasoning } from "@/types/inference";

interface ReasoningSectionProps {
    reasoning: Reasoning;
    onUpdate: (reasoning: Reasoning) => void;
}

export function ReasoningSection({
    reasoning,
    onUpdate
}: ReasoningSectionProps) {
    return (
        <Card className="rounded-sm">
            <CardHeader>
                <CardTitle className="inference-section-header">Reasoning</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="prefix">Prefix</Label>
                    <Input
                        id="prefix"
                        value={reasoning.prefix}
                        onChange={(e) =>
                            onUpdate({
                                ...reasoning,
                                prefix: e.target.value
                            })
                        }
                        placeholder="<think>"
                    />
                </div>
                <div>
                    <Label htmlFor="suffix">Suffix</Label>
                    <Input
                        id="suffix"
                        value={reasoning.suffix}
                        onChange={(e) =>
                            onUpdate({
                                ...reasoning,
                                suffix: e.target.value
                            })
                        }
                        placeholder="</think>"
                    />
                </div>
            </CardContent>
        </Card>
    );
} 