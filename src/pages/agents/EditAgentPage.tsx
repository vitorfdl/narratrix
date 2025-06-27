import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useAgentActions } from "@/hooks/agentStore";
import { AgentType } from "@/schema/agent-schema";
import { ArrowLeft } from "lucide-react";
import React, { useState } from "react";
import ToolEditor from "./components/AgentEditor";

// Props for EditAgentPage
interface EditAgentPageProps {
  agent: AgentType;
  onBack: () => void;
}

const EditAgentPage: React.FC<EditAgentPageProps> = ({ agent, onBack }) => {
  const [currentAgent, setCurrentAgent] = useState<AgentType>(agent);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const currentProfile = useCurrentProfile();
  const { updateAgent } = useAgentActions();

  const handleAgentChange = (updatedAgent: AgentType) => {
    setCurrentAgent(updatedAgent);
    setHasUnsavedChanges(true);

    // Auto-save the changes
    updateAgent(currentProfile!.id, agent.id, {
      nodes: updatedAgent.nodes,
      edges: updatedAgent.edges,
    });

    setLastSaved(new Date());
    setHasUnsavedChanges(false);
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header with back button and agent name */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-1 p-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack} title="Back to Agents">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-bold mr-auto title">
            Agents: <span className="italic text-primary">{agent.name}</span>
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
