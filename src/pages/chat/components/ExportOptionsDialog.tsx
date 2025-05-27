import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState } from "react";

interface ExportOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: ExportOptions) => void;
  templateName: string;
  hasFormatTemplate: boolean;
  hasLorebooks: boolean;
  hasAvatar?: boolean;
  isCharacterExport?: boolean;
}

export interface ExportOptions {
  includeFormatTemplate: boolean;
  includeLorebooks: boolean;
  exportFormat: "json" | "png";
}

export function ExportOptionsDialog({
  open,
  onOpenChange,
  onConfirm,
  templateName,
  hasFormatTemplate,
  hasLorebooks,
  hasAvatar = false,
  isCharacterExport = false,
}: ExportOptionsDialogProps) {
  const [includeFormatTemplate, setIncludeFormatTemplate] = useState(true);
  const [includeLorebooks, setIncludeLorebooks] = useState(true);
  const [exportFormat, setExportFormat] = useState<"json" | "png">("png");

  const handleConfirm = () => {
    onConfirm({
      includeFormatTemplate: includeFormatTemplate && hasFormatTemplate,
      includeLorebooks: includeLorebooks && hasLorebooks,
      exportFormat,
    });
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Options</DialogTitle>
          <DialogDescription>
            Choose what to include when exporting "{templateName}". Additional resources will be embedded in the export file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isCharacterExport && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Export Format</Label>
              <RadioGroup value={exportFormat} onValueChange={(value) => setExportFormat(value as "json" | "png")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="json" id="json" />
                  <Label htmlFor="json" className="text-sm font-normal">
                    JSON file
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="png" id="png" disabled={!hasAvatar} />
                  <Label htmlFor="png" className={`text-sm font-normal ${!hasAvatar ? "text-muted-foreground" : ""}`}>
                    PNG file with embedded data {!hasAvatar && "(requires avatar)"}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {hasFormatTemplate && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="format-template"
                checked={includeFormatTemplate}
                onCheckedChange={(checked) => setIncludeFormatTemplate(checked === true)}
              />
              <label htmlFor="format-template" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Include Format Template
              </label>
            </div>
          )}

          {hasLorebooks && (
            <div className="flex items-center space-x-2">
              <Checkbox id="lorebooks" checked={includeLorebooks} onCheckedChange={(checked) => setIncludeLorebooks(checked === true)} />
              <label htmlFor="lorebooks" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Include Lorebooks
              </label>
            </div>
          )}

          {!isCharacterExport && !hasFormatTemplate && !hasLorebooks && (
            <p className="text-sm text-muted-foreground">This template doesn't have any format template or lorebooks to include.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Export</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
