import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useCharacterActions } from "@/hooks/characterStore";
import { CheckCircleIcon, UserRoundPenIcon, XCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface AddAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddAgentDialog({ open, onOpenChange }: AddAgentDialogProps) {
  const { createCharacter, fetchCharacters } = useCharacterActions();
  const currentProfile = useCurrentProfile();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (!name.trim()) {
      toast.error("Agent name is required");
      return;
    }
    setIsSubmitting(true);
    try {
      await createCharacter({
        type: "agent",
        name: name.trim(),
        profile_id: currentProfile!.id,
        // Only required fields for agent creation
      } as any);
      await fetchCharacters(currentProfile!.id, { type: "agent" });
      setName("");
      onOpenChange(false);
      toast.success("Agent created");
    } catch (err) {
      toast.error("Failed to create agent", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="large">
        <DialogHeader>
          <DialogTitle className="flex gap-2 items-center text-lg font-semibold">
            <UserRoundPenIcon className="h-5 w-5" />
            Add New Agent
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DialogBody>
            <div className="flex flex-col gap-4">
              <label htmlFor="agent-name" className="font-medium text-sm">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="agent-name"
                type="text"
                placeholder="Agent name"
                className="w-full"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                maxLength={64}
                autoFocus
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              <XCircleIcon className="h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" size="dialog" disabled={isSubmitting || !name.trim()}>
              <CheckCircleIcon className="h-4 w-4" />
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
