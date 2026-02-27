import { useState } from "react";
import { LuBot, LuCircleCheck, LuCircleX } from "react-icons/lu";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResizableTextarea } from "@/components/ui/ResizableTextarea";
import { useAgentActions } from "@/hooks/agentStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { AgentType } from "@/schema/agent-schema";

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
            id: "agent-new",
            type: "agent",
            position: {
              x: 330,
              y: 200,
            },
            label: "Agent",
            config: {
              systemPromptOverride: "",
              inputPrompt: "Determine the success of upcoming interactions based on the context.",
            },
          },
          {
            id: "trigger-node-6",
            type: "trigger",
            position: {
              x: -480,
              y: 0,
            },
            label: "Trigger",
            config: {
              triggerType: "manual",
            },
          },
          {
            id: "chatHistory-node-7",
            type: "chatHistory",
            position: {
              x: -100,
              y: -60,
            },
            label: "Chat History",
            config: {
              name: "Chat History Node",
              depth: 2,
              messageType: "all",
            },
          },
          {
            id: "promptInjection-node-8",
            type: "promptInjection",
            position: {
              x: 740,
              y: 290,
            },
            label: "Prompt Injection",
            config: {
              behavior: "next",
              role: "system",
              position: "bottom",
              depth: 1,
              globalType: "",
              scopeToAgent: false,
            },
          },
          {
            id: "javascript-node-9",
            type: "javascript",
            position: {
              x: -230,
              y: 280,
            },
            label: "Javascript",
            config: {
              mode: "tool",
              code: '/**\n * D&D 5e Dice Roller\n * Supports: standard rolls, ability checks, saving throws,\n * advantage/disadvantage, and difficulty class (DC) checks.\n */\n\n// ─────────────────────────────────────────────\n// Core Roller\n// ─────────────────────────────────────────────\n\n/**\n * Rolls a single die with a given number of sides.\n * @param {number} sides - Number of sides (e.g. 6, 8, 20)\n * @returns {number}\n */\nfunction rollDie(sides) {\n  return Math.floor(Math.random() * sides) + 1;\n}\n\n// ─────────────────────────────────────────────\n// D20 Check (the heart of D&D 5e)\n// ─────────────────────────────────────────────\n\n/**\n * Performs a D20 roll with optional modifier, advantage/disadvantage,\n * and compares against a Difficulty Class (DC).\n *\n * @param {Object} options\n * @param {number}  [options.modifier=0]      - Ability/skill modifier\n * @param {number}  [options.dc=null]         - Difficulty Class to beat (null = no check)\n * @param {\'normal\'|\'advantage\'|\'disadvantage\'} [options.mode=\'normal\']\n * @param {boolean} [options.proficient=false] - Add proficiency bonus\n * @param {number}  [options.proficiencyBonus=2] - Proficiency bonus value\n * @returns {Object} Full result object\n */\nfunction d20Check({\n  modifier = 0,\n  dc = null,\n  mode = "normal",\n  proficient = false,\n  proficiencyBonus = 2,\n} = {}) {\n  const roll1 = rollDie(20);\n  const roll2 = rollDie(20);\n\n  let chosenRoll;\n  let rolls = [roll1];\n\n  if (mode === "advantage") {\n    chosenRoll = Math.max(roll1, roll2);\n    rolls = [roll1, roll2];\n  } else if (mode === "disadvantage") {\n    chosenRoll = Math.min(roll1, roll2);\n    rolls = [roll1, roll2];\n  } else {\n    chosenRoll = roll1;\n  }\n\n  const totalModifier = modifier + (proficient ? proficiencyBonus : 0);\n  const total = chosenRoll + totalModifier;\n\n  // Critical hit / miss only apply to attack rolls (d20 natural results)\n  const isCriticalHit  = chosenRoll === 20;\n  const isCriticalMiss = chosenRoll === 1;\n\n  const success = dc !== null ? total >= dc : null;\n\n  return {\n    rolls,\n    chosenRoll,\n    modifier: totalModifier,\n    total,\n    dc,\n    mode,\n    isCriticalHit,\n    isCriticalMiss,\n    success,\n    summary: buildSummary({ rolls, chosenRoll, totalModifier, total, dc, mode, success, isCriticalHit, isCriticalMiss }),\n  };\n}\n\n// ─────────────────────────────────────────────\n// Helper: Build Summary String\n// ─────────────────────────────────────────────\n\nfunction buildSummary({ rolls, chosenRoll, totalModifier, total, dc, mode, success, isCriticalHit, isCriticalMiss }) {\n  const modeLabel = mode !== "normal" ? ` [${mode.toUpperCase()}]` : "";\n  const rollsStr  = rolls.length > 1 ? `(${rolls.join(", ")}) → kept ${chosenRoll}` : `${chosenRoll}`;\n  const modStr    = totalModifier >= 0 ? `+${totalModifier}` : `${totalModifier}`;\n  const dcStr     = dc !== null ? ` vs DC ${dc} → ${success ? "✅ SUCCESS" : "❌ FAILURE"}` : "";\n  const critStr   = isCriticalHit ? " 🎯 CRITICAL HIT!" : isCriticalMiss ? " 💀 CRITICAL MISS!" : "";\n\n  return `Rolled${modeLabel}: [${rollsStr}] ${modStr} = ${total}${dcStr}${critStr}`;\n}\n\nconst result = d20Check(input)\nreturn result.summary;\n',
              inputSchema: {
                $schema: "http://json-schema.org/draft-07/schema#",
                type: "object",
                title: "DiceRoller",
                description: "Roll a d20 with an attribute modifier against a difficulty class",
                properties: {
                  dc: {
                    type: "integer",
                    description: "Difficulty class the total must meet or beat (default: 15)",
                  },
                  modifier: {
                    type: "integer",
                    description: "Flat bonus or penalty added to the roll (default: 0)",
                  },
                },
              },
            },
          },
        ],
        edges: [
          {
            id: "edge-javascript-node-9-out-toolset-agent-new-in-toolset",
            source: "javascript-node-9",
            target: "agent-new",
            sourceHandle: "out-toolset",
            targetHandle: "in-toolset",
            edgeType: "toolset",
          },
          {
            id: "edge-chatHistory-node-7-out-messages-agent-new-in-history",
            source: "chatHistory-node-7",
            target: "agent-new",
            sourceHandle: "out-messages",
            targetHandle: "in-history",
            edgeType: "message-list",
          },
          {
            id: "edge-agent-new-response-promptInjection-node-8-response",
            source: "agent-new",
            target: "promptInjection-node-8",
            sourceHandle: "response",
            targetHandle: "response",
            edgeType: "string",
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
            <LuBot className="h-5 w-5 text-primary" />
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
              <LuCircleX className="h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" size="dialog" disabled={isSubmitting || !name.trim()} className="bg-primary hover:bg-primary/90">
              <LuCircleCheck className="h-4 w-4" />
              Create Agent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
