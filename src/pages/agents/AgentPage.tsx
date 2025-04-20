import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import AddAgentDialog from "./components/AddAgentDialog";
import ToolList from "./components/ToolList";

// Strictly typed Agent interface for mock data
interface Agent {
  id: string;
  name: string;
  updated_at: string;
  type: "agent";
}

// Mock agent data for development/testing
const MOCK_AGENTS: Agent[] = [
  {
    id: "agent-1",
    name: "Alice Agent",
    updated_at: new Date().toISOString(),
    type: "agent",
  },
  {
    id: "agent-2",
    name: "Bob Bot",
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    type: "agent",
  },
  {
    id: "agent-3",
    name: "Charlie Chat",
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    type: "agent",
  },
];

export default function AgentPage() {
  // Use local state for mock agents
  const [agents, setAgents] = useState<Agent[]>(MOCK_AGENTS);
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // Filtered by search
  const filteredAgents = useMemo(() => {
    if (!search) {
      return agents;
    }
    return agents.filter((agent) => agent.name.toLowerCase().includes(search.toLowerCase()));
  }, [agents, search]);

  // Simulate delete with confirmation and local state update
  const handleDelete = (agent: Agent) => {
    if (window.confirm(`Delete agent '${agent.name}'?`)) {
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    }
  };

  // Simulate refresh (reset to mock data)
  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setAgents(MOCK_AGENTS);
      setIsLoading(false);
    }, 600);
  };

  if (selectedAgent) {
    return <ToolList agent={selectedAgent} onBack={() => setSelectedAgent(null)} />;
  }

  return (
    <div className="flex flex-col h-full w-full p-6">
      {/* Page header styled like LorebooksPage */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold title">Agents</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="default" size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-1 h-5 w-5" /> New Agent
          </Button>
        </div>
      </div>
      {/* Search bar */}
      <div className="flex items-center gap-2 mt-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search agents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" autoFocus />
        </div>
      </div>
      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">Loading agents...</div>
        ) : filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Search className="h-8 w-8 mb-2" />
            <div className="text-lg font-semibold mb-2">No agents found</div>
            <div className="mb-4">Create your first agent to get started.</div>
            <Button variant="default" size="lg" onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-2 h-5 w-5" /> Add Agent
            </Button>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {filteredAgents.map((agent) => (
              <Card key={agent.id} className="flex flex-col h-full cursor-pointer" onClick={() => setSelectedAgent(agent)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-base truncate" title={agent.name}>
                      {agent.name}
                    </span>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(agent);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center items-center text-xs text-muted-foreground">
                  Agent ID: <span className="font-mono break-all">{agent.id}</span>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground justify-end">{new Date(agent.updated_at).toLocaleDateString()}</CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
      <AddAgentDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  );
}
