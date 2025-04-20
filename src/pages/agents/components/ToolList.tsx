import { Button } from "@/components/ui/button";
import { ArrowLeft, Wrench } from "lucide-react";
import React from "react";
import ToolEditor from "./ToolEditor";

// Tool type for mock data
interface Tool {
  id: string;
  name: string;
}

// Props for ToolList
interface ToolListProps {
  agent: {
    id: string;
    name: string;
    updated_at: string;
    type: "agent";
  };
  onBack: () => void;
}

// Mock tools per agent (in a real app, this would come from agent data)
const MOCK_TOOLS: Record<string, Tool[]> = {
  "agent-1": [
    { id: "tool-1", name: "Summarizer" },
    { id: "tool-2", name: "Web Search" },
  ],
  "agent-2": [{ id: "tool-3", name: "Translator" }],
  "agent-3": [],
};

const ToolList: React.FC<ToolListProps> = ({ agent, onBack }) => {
  // Get tools for this agent (mocked)
  const tools = MOCK_TOOLS[agent.id] || [];

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

      {/* Tool list */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
          <Wrench className="h-5 w-5 text-muted-foreground" /> Agent Tools
        </h3>
        {tools.length === 0 ? (
          <div className="text-muted-foreground text-sm">No tools added to this agent yet.</div>
        ) : (
          <ul className="space-y-2">
            {tools.map((tool) => (
              <li key={tool.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{tool.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tool editor node box */}
      <div className="flex-1 flex flex-col">
        <h3 className="text-lg font-medium mb-2">Tool Editor</h3>
        <div className="flex-1">
          <ToolEditor />
        </div>
      </div>
    </div>
  );
};

export default ToolList;
