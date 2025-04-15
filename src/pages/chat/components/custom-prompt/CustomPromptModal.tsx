import { MarkdownTextArea } from "@/components/markdownRender/markdown-textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { promptReplacementSuggestionList } from "@/schema/chat-message-schema";
import { ChatTemplateCustomPrompt } from "@/schema/template-chat-schema";
import { estimateTokens } from "@/services/inference-steps/apply-context-limit";
import { motion } from "framer-motion";
import { MessageSquarePlus, PersonStanding, Sparkles, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

interface CustomPromptModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (prompt: ChatTemplateCustomPrompt) => void;
  initialData?: ChatTemplateCustomPrompt;
}

export const getRoleIcon = (role: string) => {
  switch (role) {
    case "user":
      return <UserRound className="h-4 w-4" />;
    case "character":
      return <PersonStanding className="h-4 w-4" />;
    case "system":
      return <Sparkles className="h-4 w-4" />;
    default:
      return <UserRound className="h-4 w-4" />;
  }
};

export function CustomPromptModal({ open, onClose, onSave, initialData }: CustomPromptModalProps) {
  const [prompt, setPrompt] = useState<ChatTemplateCustomPrompt>({
    id: crypto.randomUUID(),
    name: "",
    role: "user",
    filter: {},
    position: "top",
    depth: 1,
    prompt: "",
  });

  // Reset form when modal opens or initialData changes
  useEffect(() => {
    // Only update state when the modal is actually open
    if (open) {
      if (initialData) {
        // If initialData is provided, set the state for editing
        setPrompt(initialData);
      } else {
        // If no initialData, reset the state for adding a new prompt
        setPrompt({
          id: crypto.randomUUID(),
          name: "",
          role: "user",
          filter: {},
          position: "top",
          depth: 1,
          prompt: "",
        });
      }
    }
    // This effect should run when the modal opens/closes or when the initial data changes.
  }, [open, initialData]);

  const handleSave = () => {
    onSave(prompt);
    onClose();
  };

  const updateDepth = (value: number[]) => {
    setPrompt({ ...prompt, depth: value[0] });
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="large">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            {initialData ? "Edit Custom Prompt" : "Add Custom Prompt"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Prompt Name
            </Label>
            <Input
              id="name"
              placeholder="Enter a descriptive name for this prompt"
              value={prompt.name}
              onChange={(e) => setPrompt({ ...prompt, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm font-medium">
                Role
              </Label>
              <Select value={prompt.role} onValueChange={(value: "user" | "character" | "system") => setPrompt({ ...prompt, role: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(prompt.role)} {prompt.role.charAt(0).toUpperCase() + prompt.role.slice(1)}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4" />
                      <span>User</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="character">
                    <div className="flex items-center gap-2">
                      <PersonStanding className="h-4 w-4" />
                      <span>Character</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      <span>System</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position" className="text-sm font-medium">
                Position
              </Label>
              <Select value={prompt.position} onValueChange={(value: "top" | "bottom" | "depth") => setPrompt({ ...prompt, position: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Top of Conversation</SelectItem>
                  <SelectItem value="bottom">Bottom of Conversation</SelectItem>
                  <SelectItem value="depth">At Specific Depth</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {prompt.position === "depth" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              <div className="flex justify-between items-center">
                <Label htmlFor="depth" className="text-sm font-medium">
                  Depth Position
                </Label>
                <span className="text-sm font-medium bg-primary/20 text-primary px-2 py-0.5 rounded-md">{prompt.depth}</span>
              </div>
              <Slider id="depth" min={1} max={10} step={1} value={[prompt.depth]} onValueChange={updateDepth} className="py-2" />
              <p className="text-xs text-muted-foreground">Determines how many messages into the conversation this prompt should be inserted</p>
            </motion.div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="prompt" className="text-sm font-medium flex items-center gap-2">
                {getRoleIcon(prompt.role)} Prompt Content
              </Label>
              <span className="text-xs text-muted-foreground">{estimateTokens(prompt.prompt, 0)} tokens</span>
            </div>
            <div className="border border-input rounded-md">
              <MarkdownTextArea
                editable={true}
                suggestions={promptReplacementSuggestionList}
                key={`${prompt?.id || "new-prompt"}-${prompt?.role}`}
                initialValue={prompt.prompt || ""}
                onChange={(value) => setPrompt({ ...prompt, prompt: value })}
                className="max-h-[40vh] md:max-h-[50vh] overflow-y-auto"
                placeholder="Enter your custom prompt text..."
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="border-input hover:bg-secondary transition-colors">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!prompt.name.trim() || !prompt.prompt.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
          >
            {initialData ? "Update" : "Save"} Prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
