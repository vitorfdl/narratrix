import { ArrowLeft, Pencil } from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommandTagInput } from "@/components/ui/input-tag";
import { useAgentActions, useAgents } from "@/hooks/agentStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useUIStore } from "@/hooks/UIStore";
import { AgentType } from "@/schema/agent-schema";
import ToolEditor from "./components/AgentEditor";

// Props for EditAgentPage
interface EditAgentPageProps {
  agent: AgentType;
  onBack: () => void;
  returnTo?: string;
}

const EditAgentPage: React.FC<EditAgentPageProps> = ({ agent, onBack, returnTo }) => {
  const [currentAgent, setCurrentAgent] = useState<AgentType>(agent);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(agent.name);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState(agent.description ?? "");
  const [tagsValue, setTagsValue] = useState<string[]>(agent.tags ?? []);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
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

  const startEditingName = () => {
    setIsEditingName(true);
    setTimeout(() => {
      nameInputRef.current?.select();
    }, 0);
  };

  const commitNameChange = () => {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setNameValue(currentAgent.name);
      setIsEditingName(false);
      return;
    }
    if (trimmed !== currentAgent.name) {
      updateAgent(currentProfile!.id, agent.id, { name: trimmed });
      setCurrentAgent((prev) => ({ ...prev, name: trimmed }));
      setLastSaved(new Date());
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitNameChange();
    } else if (e.key === "Escape") {
      setNameValue(currentAgent.name);
      setIsEditingName(false);
    }
  };

  const startEditingDescription = () => {
    setIsEditingDescription(true);
    setTimeout(() => {
      descriptionRef.current?.focus();
      descriptionRef.current?.select();
    }, 0);
  };

  const commitDescriptionChange = () => {
    const trimmed = descriptionValue.trim();
    const newDescription = trimmed || null;
    if (newDescription !== currentAgent.description) {
      updateAgent(currentProfile!.id, agent.id, { description: newDescription });
      setCurrentAgent((prev) => ({ ...prev, description: newDescription }));
      setLastSaved(new Date());
    }
    setIsEditingDescription(false);
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setDescriptionValue(currentAgent.description ?? "");
      setIsEditingDescription(false);
    }
  };

  const handleTagsChange = (newTags: string[]) => {
    setTagsValue(newTags);
    updateAgent(currentProfile!.id, agent.id, { tags: newTags });
    setCurrentAgent((prev) => ({ ...prev, tags: newTags }));
    setLastSaved(new Date());
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header with back button and agent name */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-1 pt-1 px-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => (returnTo ? navigateToSection(returnTo) : onBack())} title={returnTo ? `Back to ${returnTo}` : "Back to Agents"}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-bold mr-auto title flex items-center gap-1.5">
            <span className="text-muted-foreground">Agent:</span>
            {isEditingName ? (
              <Input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={commitNameChange}
                onKeyDown={handleNameKeyDown}
                className="h-7 w-48 py-0 px-1.5 font-bold italic text-primary text-base border-primary/50 focus-visible:ring-1"
              />
            ) : (
              <button type="button" onClick={startEditingName} className="group flex items-center gap-1 italic text-primary hover:opacity-80 transition-opacity cursor-text">
                {currentAgent.name}
                <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
              </button>
            )}
          </h1>
          {hasUnsavedChanges && <span className="text-sm text-muted-foreground">• Unsaved changes</span>}
          {lastSaved && <span className="text-sm text-muted-foreground">• Last saved: {lastSaved.toLocaleTimeString()}</span>}
        </div>

        {/* Second row: description and tags */}
        <div className="flex items-start gap-2 pb-2 px-4">
          {/* Spacer to align with name (past back button + gap) */}
          <div className="w-8 shrink-0" />

          {/* Description */}
          <div className="flex-1 min-w-0">
            {isEditingDescription ? (
              <textarea
                ref={descriptionRef}
                value={descriptionValue}
                onChange={(e) => setDescriptionValue(e.target.value)}
                onBlur={commitDescriptionChange}
                onKeyDown={handleDescriptionKeyDown}
                rows={2}
                placeholder="Add a description..."
                className="w-full text-xs text-muted-foreground bg-transparent border border-border/60 rounded-sm px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:italic placeholder:opacity-50"
              />
            ) : (
              <button
                type="button"
                onClick={startEditingDescription}
                className="group flex items-center gap-1 text-left w-full text-xs text-muted-foreground hover:text-foreground/80 transition-colors cursor-text"
                title="Edit description"
              >
                <span className="truncate">{currentAgent.description ? currentAgent.description : <span className="italic opacity-40">Add a description...</span>}</span>
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
              </button>
            )}
          </div>

          {/* Tags */}
          <div className="w-72 shrink-0">
            <CommandTagInput value={tagsValue} onChange={handleTagsChange} suggestions={allTags} placeholder="Add tags..." maxTags={10} />
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
