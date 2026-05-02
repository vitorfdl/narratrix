import { ArrowLeft, Check, Clipboard, Tag } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CommandTagInput } from "@/components/ui/input-tag";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAgentActions, useAgents } from "@/hooks/agentStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useUIStore } from "@/hooks/UIStore";
import { cn } from "@/lib/utils";
import { AgentType } from "@/schema/agent-schema";
import ToolEditor from "./components/AgentEditor";

interface EditAgentPageProps {
  agent: AgentType;
  onBack: () => void;
  returnTo?: string;
}

const EditAgentPage: React.FC<EditAgentPageProps> = ({ agent, onBack, returnTo }) => {
  const [currentAgent, setCurrentAgent] = useState<AgentType>(agent);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [nameValue, setNameValue] = useState(agent.name);
  const [descriptionValue, setDescriptionValue] = useState(agent.description ?? "");
  const [tagsValue, setTagsValue] = useState<string[]>(agent.tags ?? []);
  const [copied, setCopied] = useState(false);

  const currentProfile = useCurrentProfile();
  const { updateAgent } = useAgentActions();
  const { navigateToSection } = useUIStore();
  const allAgents = useAgents();
  const allTags = useMemo(() => Array.from(new Set(allAgents.flatMap((a) => a.tags ?? []))).sort(), [allAgents]);

  const handleAgentChange = (updatedAgent: AgentType) => {
    setCurrentAgent(updatedAgent);
    setHasUnsavedChanges(true);

    updateAgent(currentProfile!.id, agent.id, {
      nodes: updatedAgent.nodes,
      edges: updatedAgent.edges,
    });

    setLastSaved(new Date());
    setHasUnsavedChanges(false);
  };

  const commitNameChange = () => {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setNameValue(currentAgent.name);
      return;
    }
    if (trimmed !== currentAgent.name) {
      updateAgent(currentProfile!.id, agent.id, { name: trimmed });
      setCurrentAgent((prev) => ({ ...prev, name: trimmed }));
      setLastSaved(new Date());
    }
  };

  const commitDescriptionChange = () => {
    const trimmed = descriptionValue.trim();
    const newDescription = trimmed || null;
    if (newDescription !== currentAgent.description) {
      updateAgent(currentProfile!.id, agent.id, { description: newDescription });
      setCurrentAgent((prev) => ({ ...prev, description: newDescription }));
      setLastSaved(new Date());
    }
  };

  const handleTagsChange = (newTags: string[]) => {
    setTagsValue(newTags);
    updateAgent(currentProfile!.id, agent.id, { tags: newTags });
    setCurrentAgent((prev) => ({ ...prev, tags: newTags }));
    setLastSaved(new Date());
  };

  const handleCopyConfig = async () => {
    await navigator.clipboard.writeText(JSON.stringify(currentAgent, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const savedTimeLabel = lastSaved?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const inlineInputBase =
    "w-full border border-transparent bg-transparent px-1.5 py-0.5 -mx-1.5 rounded-md outline-none transition-colors " +
    "hover:bg-muted/50 hover:border-border/40 " +
    "focus:bg-background focus:border-border focus:ring-1 focus:ring-primary/30 " +
    "placeholder:italic placeholder:text-muted-foreground/60 truncate";

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center gap-2 px-4 py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => (returnTo ? navigateToSection(returnTo) : onBack())}
            title={returnTo ? `Back to ${returnTo}` : "Back to Agents"}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="h-9 w-1 shrink-0 rounded-full bg-primary" />

          {/* Title stack: name + description (always-editable, no mode switch) */}
          <div className="min-w-0 flex-1 flex flex-col">
            <input
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitNameChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  setNameValue(currentAgent.name);
                  e.currentTarget.blur();
                }
              }}
              placeholder="Untitled agent"
              spellCheck={false}
              className={cn(inlineInputBase, "text-base font-semibold leading-tight text-foreground")}
              title={nameValue}
            />
            <input
              type="text"
              value={descriptionValue}
              onChange={(e) => setDescriptionValue(e.target.value)}
              onBlur={commitDescriptionChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  setDescriptionValue(currentAgent.description ?? "");
                  e.currentTarget.blur();
                }
              }}
              placeholder="Add a description..."
              className={cn(inlineInputBase, "text-xs leading-tight text-muted-foreground focus:text-foreground")}
              title={descriptionValue || undefined}
            />
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Save status */}
            <div
              className={cn(
                "hidden md:flex items-center gap-1.5 rounded-md border px-2 h-8 text-[11px] font-medium tabular-nums",
                hasUnsavedChanges
                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                  : lastSaved
                    ? "border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400"
                    : "border-border/60 bg-muted/30 text-muted-foreground",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", hasUnsavedChanges ? "bg-yellow-500 animate-pulse" : lastSaved ? "bg-green-500" : "bg-muted-foreground/50")} />
              <span>{hasUnsavedChanges ? "Saving…" : lastSaved ? `Saved ${savedTimeLabel}` : "Not saved"}</span>
            </div>

            {/* Tags popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-background px-2.5" title="Tags">
                  <Tag className="h-3.5 w-3.5" />
                  <span className="text-xs tabular-nums">{tagsValue.length > 0 ? tagsValue.length : <span className="text-muted-foreground">Tags</span>}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-3">
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-foreground">Tags</div>
                  <CommandTagInput value={tagsValue} onChange={handleTagsChange} suggestions={allTags} placeholder="Add tags..." maxTags={10} />
                </div>
              </PopoverContent>
            </Popover>

            {/* Copy config */}
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 bg-background" onClick={handleCopyConfig} title="Copy agent configuration as JSON">
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Tool editor node box */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <ToolEditor toolConfig={currentAgent} onChange={handleAgentChange} />
        </div>
      </div>
    </div>
  );
};

export default EditAgentPage;
