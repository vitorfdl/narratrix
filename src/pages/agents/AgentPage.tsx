import { useEffect, useMemo, useState } from "react";
import { LuAArrowDown, LuBot, LuCpu, LuRefreshCw, LuSearch, LuX } from "react-icons/lu";
import { toast } from "sonner";
import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
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

const agentGridMinWidthBySize: Record<AgentPageSettings["view"]["cardSize"], number> = {
  small: 18,
  medium: 24,
  large: 30,
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
  const [agentToDelete, setAgentToDelete] = useState<AgentType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  const handleTagSelect = (tag: string) => {
    setSettings((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag) ? prev.selectedTags.filter((t) => t !== tag) : [...prev.selectedTags, tag],
    }));
  };

  const handleClearTags = () => {
    setSettings((prev) => ({
      ...prev,
      selectedTags: [],
    }));
  };

  const handleClearFilters = () => {
    setSearch("");
    handleClearTags();
  };

  const filteredAgents = useMemo(() => {
    return agents
      .filter((agent) => {
        const matchesSearch = search === "" || agent.name.toLowerCase().includes(search.toLowerCase()) || agent.description?.toLowerCase().includes(search.toLowerCase());
        const matchesTags = settings.selectedTags.length === 0 || settings.selectedTags.every((tag) => (agent.tags ?? []).includes(tag));
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

  const hasActiveFilters = search.trim().length > 0 || settings.selectedTags.length > 0;
  const gridTemplateColumns = useMemo(() => {
    const minWidth = agentGridMinWidthBySize[settings.view.cardSize];
    return `repeat(auto-fit, minmax(min(100%, ${minWidth}rem), 1fr))`;
  }, [settings.view.cardSize]);
  const loadingSkeletonKeys = useMemo(() => Array.from({ length: 8 }, (_, itemIndex) => `agent-loading-${itemIndex}`), []);

  const handleDelete = async (agent: AgentType) => {
    setAgentToDelete(agent);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!agentToDelete) {
      return;
    }

    try {
      await deleteAgent(agentToDelete.id);
    } catch (error) {
      console.error("Failed to delete agent:", error);
      // Error toast is handled by the store's error state
    } finally {
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
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
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      // Error toast is handled by the store's error state
    }
  };

  // Show loading state if no profile is available
  if (!currentProfile) {
    return (
      <div className="flex h-full items-center justify-center bg-background px-6 text-center">
        <div className="max-w-sm rounded-3xl border border-border/60 bg-card/70 p-8 shadow-xl shadow-black/5">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
            <LuBot className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No profile selected</h3>
          <p className="mt-2 text-sm text-muted-foreground">Select a profile to view agents.</p>
        </div>
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
    <div className="flex h-full overflow-hidden bg-background">
      <AgentSidebar agents={agents} selectedTags={settings.selectedTags} onTagSelect={handleTagSelect} onClearTags={handleClearTags} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="space-y-4 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-1 rounded-full bg-primary" />
                  <h1 className="title font-bold">Agents</h1>
                </div>
              </div>

              <Button onClick={() => setAddDialogOpen(true)} className="shrink-0">
                <LuCpu className="h-4 w-4" />
                Create Agent
              </Button>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative min-w-0 flex-1">
                <LuSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search agents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 rounded-md border border-border/60 bg-muted/20 pl-9 font-sans text-sm"
                />
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="icon" className="bg-background" onClick={handleRefresh} disabled={isLoading} title="Refresh Agents">
                  <LuRefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>

                <Select
                  value={`${settings.sort.field}-${settings.sort.direction}`}
                  onValueChange={(value) => {
                    const [field, direction] = value.split("-") as [typeof settings.sort.field, typeof settings.sort.direction];
                    setSettings((prev: AgentPageSettings) => ({ ...prev, sort: { field, direction } }));
                  }}
                >
                  <SelectTrigger noChevron className={buttonVariants({ variant: "outline", size: "icon", className: "bg-background" })} title="Sort Agents">
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

                {hasActiveFilters && (
                  <Button variant="ghost" className="h-9 gap-2 text-muted-foreground" onClick={handleClearFilters}>
                    <LuX className="h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-muted/10 to-background">
          {isLoading ? (
            <div className="grid gap-3 p-5" style={{ gridTemplateColumns }}>
              {loadingSkeletonKeys.map((skeletonKey) => (
                <div key={skeletonKey} className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm">
                  <div className="mb-5 flex items-start gap-3">
                    <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-16 animate-pulse rounded bg-muted/70" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-muted/70" />
                    <div className="h-5 w-40 animate-pulse rounded bg-muted/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAgents.length > 0 ? (
            <div className="p-5">
              <div className="grid gap-3" style={{ gridTemplateColumns }}>
                {filteredAgents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} cardSize={settings.view.cardSize} onEdit={handleEdit} onDelete={handleDelete} onToggleFavorite={handleToggleFavorite} />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center p-8 text-center">
              <div className="max-w-sm rounded-3xl border border-border/60 bg-card/70 p-8 shadow-xl shadow-black/5">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
                  <LuBot className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">{hasActiveFilters ? "No agents match your filters" : "No agents yet"}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {hasActiveFilters ? "Try another search or clear the active tag filters." : "Create an agent to automate a workflow in this profile."}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {hasActiveFilters ? (
                    <Button variant="outline" onClick={handleClearFilters}>
                      <LuX className="h-4 w-4" />
                      Clear filters
                    </Button>
                  ) : (
                    <Button onClick={() => setAddDialogOpen(true)}>
                      <LuCpu className="h-4 w-4" />
                      Create Agent
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <AddAgentDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
        <DestructiveConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Agent"
          description={
            <p>
              Are you sure you want to delete <span className="font-semibold">{agentToDelete?.name}</span>? This action cannot be undone.
            </p>
          }
          onConfirm={confirmDelete}
        />
      </div>
    </div>
  );
}
