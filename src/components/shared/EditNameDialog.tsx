import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";

export interface EditNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onSave: (newName: string) => void;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  saveButtonText?: string;
  cancelButtonText?: string;
}

export function EditNameDialog({
  open,
  onOpenChange,
  initialName,
  onSave,
  title = "Edit Name",
  description,
  label = "Name",
  placeholder,
  saveButtonText = "Save",
  cancelButtonText = "Cancel",
}: EditNameDialogProps): JSX.Element {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) {
      setName(initialName); // Reset name when dialog opens
    }
  }, [open, initialName]);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
      onOpenChange(false); // Close dialog on save
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-base mt-2">{description}</DialogDescription>
        </DialogHeader>
        <div className="py-2 flex flex-col space-y-2">
          <div className="flex items-center gap-4">
            <Label htmlFor="edit-name-dialog-input" className="min-w-10">
              {label}
            </Label>
            <Input
              id="edit-name-dialog-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1"
              placeholder={placeholder}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} className="min-w-24">
            {cancelButtonText}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()} className="min-w-24 bg-primary hover:bg-primary/90">
            {saveButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
