import { ArrowLeft, Pencil } from "lucide-react";
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgentActions } from "@/hooks/agentStore";
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
  const nameInputRef = useRef<HTMLInputElement>(null);
  const currentProfile = useCurrentProfile();
  const { updateAgent } = useAgentActions();
  const { navigateToSection } = useUIStore();

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

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header with back button and agent name */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-1 p-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => (returnTo ? navigateToSection(returnTo) : onBack())} title={returnTo ? `Back to ${returnTo}` : "Back to Agents"}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-bold mr-auto title flex items-center gap-1.5">
            <span className="text-muted-foreground">Agents:</span>
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
