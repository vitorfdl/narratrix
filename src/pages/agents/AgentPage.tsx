import { useEffect, useMemo, useState } from "react";
import { LuAArrowDown, LuBot, LuCpu, LuRefreshCw, LuSearch, LuSettings2 } from "react-icons/lu";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useAgentActions, useAgentError, useAgentLoading, useAgents } from "@/hooks/agentStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useUIStore } from "@/hooks/UIStore";
import { AgentType } from "@/schema/agent-schema";
import { useLocalAgentPageSettings } from "@/utils/local-storage";
import AddAgentDialog from "./components/AddAgentDialog";
import { AgentCard } from "./components/AgentCard";
import { AgentSidebar } from "./components/AgentSidebar";
import EditAgentPage from "./EditAgentPage";

export type AgentPageSettings = {
  view: {
    mode: "grid" | "list";
    cardsPerRow: number;
    cardSize: "small" | "medium" | "large";
  };
  sort: {
    field: "name" | "version" | "updated_at" | "created_at";
    direction: "asc" | "desc";
  };
  selectedTags: string[];
};

export default function AgentPage() {
  // Store integration
  const agents = useAgents();
  const isLoading = useAgentLoading();
  const error = useAgentError();
  const { fetchAgents, deleteAgent, updateAgent } = useAgentActions();
  const currentProfile = useCurrentProfile();
  const { navigationContext, clearNavigationContext } = useUIStore();

  // Local state
  const [settings, setSettings] = useLocalAgentPageSettings();
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentType | null>(null);

  // Fetch agents on component mount and profile change
  useEffect(() => {
    if (currentProfile?.id) {
      fetchAgents(currentProfile.id);
    }
  }, [currentProfile?.id, fetchAgents]);

  // Auto-select agent when navigated here with a context agentId
  useEffect(() => {
    if (navigationContext?.agentId && agents.length > 0) {
      const target = agents.find((a) => a.id === navigationContext.agentId);
      if (target) {
        setSelectedAgent(target);
      }
    }
  }, [navigationContext?.agentId, agents]);

  // Show error toast when error occurs
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Handle tag selection
  const handleTagSelect = (tag: string) => {
    setSettings((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag) ? prev.selectedTags.filter((t) => t !== tag) : [...prev.selectedTags, tag],
    }));
  };

  // Filtered and sorted agents
  const filteredAgents = useMemo(() => {
    return agents
      .filter((agent) => {
        const matchesSearch = search === "" || agent.name.toLowerCase().includes(search.toLowerCase()) || agent.description?.toLowerCase().includes(search.toLowerCase());
        const matchesTags = settings.selectedTags.length === 0 || (agent.tags && settings.selectedTags.every((tag) => agent.tags?.includes(tag)));
        return matchesSearch && matchesTags;
      })
      .sort((a, b) => {
        const direction = settings.sort.direction === "asc" ? 1 : -1;
        if (settings.sort.field === "name") {
          return direction * a.name.localeCompare(b.name);
        }
        if (settings.sort.field === "version") {
          return direction * (a.version || "").localeCompare(b.version || "");
        }
        const aDate = settings.sort.field === "created_at" ? a.created_at : a.updated_at;
        const bDate = settings.sort.field === "created_at" ? b.created_at : b.updated_at;
        return direction * (new Date(bDate).getTime() - new Date(aDate).getTime());
      });
  }, [agents, search, settings.selectedTags, settings.sort]);

  // Handle delete with confirmation
  const handleDelete = async (agent: AgentType) => {
    if (window.confirm(`Delete agent '${agent.name}'?`)) {
      try {
        await deleteAgent(agent.id);
        toast.success(`Agent '${agent.name}' deleted successfully`);
      } catch (error) {
        console.error("Failed to delete agent:", error);
        // Error toast is handled by the store's error state
      }
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    if (currentProfile?.id) {
      fetchAgents(currentProfile.id);
    }
  };

  // Handle edit
  const handleEdit = (agent: AgentType) => {
    setSelectedAgent(agent);
  };

  // Handle favorite toggle
  const handleToggleFavorite = async (agent: AgentType) => {
    if (!currentProfile?.id) {
      toast.error("No profile selected");
      return;
    }

    try {
      await updateAgent(currentProfile.id, agent.id, {
        favorite: !agent.favorite,
      });
      toast.success(`Agent ${agent.favorite ? "removed from" : "added to"} favorites`);
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      // Error toast is handled by the store's error state
    }
  };

  // Show loading state if no profile is available
  if (!currentProfile) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-muted-foreground">Please select a profile to view agents</p>
      </div>
    );
  }

  // If an agent is selected, show the ToolList view
  if (selectedAgent) {
    return (
      <EditAgentPage
        agent={selectedAgent}
        onBack={() => {
          setSelectedAgent(null);
          clearNavigationContext();
        }}
        returnTo={navigationContext?.returnTo}
      />
    );
  }

  return (
    <div className="flex h-full overflow-y-auto">
      <AgentSidebar agents={agents} selectedTags={settings.selectedTags} onTagSelect={handleTagSelect} />

      <div className="flex flex-1 flex-col">
        {/* Header with filters and controls */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="flex items-center gap-1 p-4">
            <h1 className="font-bold mr-auto title flex items-center gap-2">Agents</h1>

            {/* Search */}
            <div className="relative w-full max-w-sm">
              <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search agents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>

            {/* Refresh */}
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading} title="Refresh Agents">
              <LuRefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>

            {/* View Settings */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="Grid Settings">
                  <LuSettings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Cards per row</label>
                    <span className="text-xs text-muted-foreground">{settings.view.cardsPerRow}</span>
                  </div>
                  <Slider
                    value={[settings.view.cardsPerRow]}
                    min={2}
                    max={6}
                    step={1}
                    onValueChange={([value]) =>
                      setSettings((prev: AgentPageSettings) => ({
                        ...prev,
                        view: {
                          ...prev.view,
                          cardsPerRow: value,
                        },
                      }))
                    }
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort */}
            <Select
              value={`${settings.sort.field}-${settings.sort.direction}`}
              onValueChange={(value) => {
                const [field, direction] = value.split("-") as [typeof settings.sort.field, typeof settings.sort.direction];
                setSettings((prev: AgentPageSettings) => ({ ...prev, sort: { field, direction } }));
              }}
            >
              <SelectTrigger noChevron className={buttonVariants({ variant: "outline", size: "icon" })} title="Sort Agents">
                <LuAArrowDown className="h-4 w-4" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                <SelectItem value="version-asc">Version (Low-High)</SelectItem>
                <SelectItem value="version-desc">Version (High-Low)</SelectItem>
                <SelectItem value="updated_at-desc">Recently Updated</SelectItem>
                <SelectItem value="created_at-desc">Recently Created</SelectItem>
              </SelectContent>
            </Select>

            {/* Add Agent Button */}
            <Button onClick={() => setAddDialogOpen(true)} className="bg-primary hover:bg-primary/90">
              <LuCpu className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <p className="text-muted-foreground">Loading agents...</p>
            </div>
          ) : filteredAgents.length > 0 ? (
            <div className="space-y-6 py-1">
              <div className="p-4">
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${settings.view.cardsPerRow}, minmax(0, 1fr))`,
                  }}
                >
                  {filteredAgents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} cardSize={settings.view.cardSize} onEdit={handleEdit} onDelete={handleDelete} onToggleFavorite={handleToggleFavorite} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center h-[calc(100vh-250px)]">
              <div className="rounded-full bg-muted p-4 mb-4">
                <LuBot className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-1">{search || settings.selectedTags.length > 0 ? "No agents match your filters" : "No agents found"}</h3>
              <p className="text-base text-muted-foreground mt-1 mb-6 max-w-md">
                {search || settings.selectedTags.length > 0 ? "Try adjusting your search or filter settings." : "Get started by creating your first AI agent!"}
              </p>
              <Button variant="default" size="lg" onClick={() => setAddDialogOpen(true)} className="bg-primary hover:bg-primary/90">
                <LuCpu size={20} className="mr-2" /> Create Your First Agent
              </Button>
            </div>
          )}
        </div>

        {/* Add Agent Dialog */}
        <AddAgentDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      </div>
    </div>
  );
}
