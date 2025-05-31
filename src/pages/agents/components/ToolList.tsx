import { Button } from "@/components/ui/button";
import { AgentType } from "@/schema/agent-schema";
import { ArrowLeft } from "lucide-react";
import React from "react";
import ToolEditor from "./AgentEditor";

// Props for ToolList
interface ToolListProps {
  agent: AgentType;
  onBack: () => void;
}

const ToolList: React.FC<ToolListProps> = ({ agent, onBack }) => {

  return (
    <div className="flex flex-col h-full w-full p-6">
      {/* Header with back button and agent name */}
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft size={18} />
        </Button>
        <h2 className="text-xl font-semibold truncate">
          Tools for <span className="italic text-primary">{agent.name}</span>
        </h2>
      </div>

      {/* Tool editor node box */}
      <div className="flex-1 flex flex-col">
        <h3 className="text-lg font-medium mb-2">Tool Editor</h3>
        <div className="flex-1">
          <ToolEditor toolConfig={agent} onSave={() => {}} />
        </div>
      </div>
    </div>
  );
};

export default ToolList;
