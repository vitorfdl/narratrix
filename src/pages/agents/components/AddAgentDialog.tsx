import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { ResizableTextarea } from "@/components/ui/ResizableTextarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useAgentActions } from "@/hooks/agentStore";
import { AgentType } from "@/schema/agent-schema";
import { Bot, CheckCircleIcon, XCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface AddAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (agent: AgentType) => void;
}

export default function AddAgentDialog({ open, onOpenChange, onSuccess }: AddAgentDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createAgent } = useAgentActions();
  const currentProfile = useCurrentProfile();

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!name.trim()) {
      toast.error("Agent name is required");
      return;
    }

    if (!currentProfile?.id) {
      toast.error("No profile selected");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create agent data with default structure
      const agentData = {
        profile_id: currentProfile.id,
        name: name.trim(),
        description: description.trim() || undefined,
        tags: [],
        version: "1.0.0",
        favorite: false,
        nodes: [
          {
            id: "chat-input-new",
            type: "chatInput" as const,
            position: { x: -100, y: 200 },
            label: "Chat Input",
            config: {},
          },
          {
            id: "agent-new",
            type: "agent" as const,
            position: { x: 250, y: 200 },
            label: "Agent",
            config: {
              systemPromptOverride: "",
              inputPrompt: "",
            },
          },
          {
            id: "chat-output-new",
            type: "chatOutput" as const,
            position: { x: 600, y: 200 },
            label: "Chat Output",
            config: {},
          },
        ],
        edges: [
          {
            id: "edge-input-to-agent",
            source: "chat-input-new",
            target: "agent-new",
            sourceHandle: "message",
            targetHandle: "in-input",
            edgeType: "string" as const,
          },
          {
            id: "edge-agent-to-output",
            source: "agent-new",
            target: "chat-output-new",
            sourceHandle: "response",
            targetHandle: "response",
            edgeType: "string" as const,
          },
        ],
        settings: {
          run_on: {
            type: "manual" as const,
          },
        },
      };

      // Create the agent using the store
      const newAgent = await createAgent(agentData);

      // Call onSuccess if provided
      if (onSuccess) {
        onSuccess(newAgent);
      }

      // Reset form and close dialog
      setName("");
      setDescription("");
      onOpenChange(false);
      toast.success("Agent created successfully");
    } catch (err) {
      console.error("Failed to create agent:", err);
      toast.error("Failed to create agent", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="large">
        <DialogHeader>
          <DialogTitle className="flex gap-2 items-center text-lg font-semibold">
            <Bot className="h-5 w-5 text-primary" />
            Create New Agent
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DialogBody className="pb-4">
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="agent-name" className="font-medium text-sm">
                  Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="agent-name"
                  type="text"
                  placeholder="My AI Agent"
                  className="w-full mt-1"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  maxLength={64}
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="agent-description" className="font-medium text-sm">
                  Description
                </label>
                <ResizableTextarea
                  id="agent-description"
                  placeholder="Describe what this agent does..."
                  className="w-full mt-1 min-h-[80px]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  maxLength={500}
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              <XCircleIcon className="h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" size="dialog" disabled={isSubmitting || !name.trim()} className="bg-primary hover:bg-primary/90">
              <CheckCircleIcon className="h-4 w-4" />
              Create Agent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
