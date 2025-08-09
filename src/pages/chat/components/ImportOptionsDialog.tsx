import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

interface ImportOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: ImportOptions) => void;
  templateName: string;
  hasFormatTemplate: boolean;
  hasLorebooks: boolean;
  lorebookCount?: number;
}

export interface ImportOptions {
  includeFormatTemplate: boolean;
  includeLorebooks: boolean;
}

export function ImportOptionsDialog({ open, onOpenChange, onConfirm, templateName, hasFormatTemplate, hasLorebooks, lorebookCount = 0 }: ImportOptionsDialogProps) {
  const [includeFormatTemplate, setIncludeFormatTemplate] = useState(hasFormatTemplate);
  const [includeLorebooks, setIncludeLorebooks] = useState(hasLorebooks);

  const handleConfirm = () => {
    onConfirm({
      includeFormatTemplate: includeFormatTemplate && hasFormatTemplate,
      includeLorebooks: includeLorebooks && hasLorebooks,
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
          <DialogTitle>Import Options</DialogTitle>
          <DialogDescription>The template "{templateName}" contains additional resources. Choose what to import along with the template.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {hasFormatTemplate && (
            <div className="flex items-center space-x-2">
              <Checkbox id="format-template" checked={includeFormatTemplate} onCheckedChange={(checked) => setIncludeFormatTemplate(checked === true)} />
              <label htmlFor="format-template" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Import Format Template
              </label>
            </div>
          )}

          {hasLorebooks && (
            <div className="flex items-center space-x-2">
              <Checkbox id="lorebooks" checked={includeLorebooks} onCheckedChange={(checked) => setIncludeLorebooks(checked === true)} />
              <label htmlFor="lorebooks" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Import Lorebooks {lorebookCount > 0 && `(${lorebookCount})`}
              </label>
            </div>
          )}

          {!hasFormatTemplate && !hasLorebooks && <p className="text-sm text-muted-foreground">This template doesn't contain any additional resources to import.</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
