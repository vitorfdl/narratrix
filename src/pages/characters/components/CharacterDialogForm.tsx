import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Character } from "@/schema/characters-schema";
import { CheckCircleIcon, XCircleIcon } from "lucide-react";
import { useRef, useState } from "react";
import { CharacterForm, CharacterFormRef } from "./AddCharacterForm";

interface CharacterDialogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: Character;
  onSuccess: () => void;
  title?: string;
}

export function CharacterDialogForm({ open, onOpenChange, mode, initialData, onSuccess, title }: CharacterDialogFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const formRef = useRef<CharacterFormRef>(null);
  const formId = `character-dialog-form-${mode}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="window" onInteractOutside={(e) => isEditing && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {title || (mode === "edit" ? `Edit ${initialData?.type === "character" ? "Character" : "Agent"}` : "Add New Character / Agent")}
          </DialogTitle>
        </DialogHeader>
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            if (formRef.current) {
              formRef.current.submit();
            }
          }}
          className="flex flex-col h-full"
        >
          <div className="flex-1 overflow-y-auto max-h-[60vh] pr-2">
            <CharacterForm
              ref={formRef}
              mode={mode}
              initialData={initialData}
              setIsEditing={setIsEditing}
              onSuccess={() => {
                onOpenChange(false);
                onSuccess();
                setIsEditing(false);
              }}
              asDialog={false}
            />
          </div>
          <DialogFooter className="sticky bottom-0 z-10 bg-background/95 backdrop-blur border-t border-border px-6 py-4 flex gap-3">
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
              <XCircleIcon className="h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" className="flex items-center gap-2 ">
              <CheckCircleIcon className="h-4 w-4" />
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
