import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useModelManifestsActions } from "@/hooks/manifestStore";
import { useModelsActions, useModelsLoading } from "@/hooks/modelsStore";
import { NewModelParams } from "@/services/model-service";
import { useLocalModelsPageSettings } from "@/utils/local-storage";
import { Brain, Database, Grid2X2, Grid3X3, Image, List, Music, Plus, RefreshCw, Search, Settings2, SortAsc } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Model, ModelType } from "../../schema/models-schema";
import { ModelCard } from "./components/ModelCard";
import { ModelConfigDialog } from "./components/ModelConfigDialog";
import { ModelForm } from "./components/ModelForm";

export type ModelsPageSettings = {
  view: {
    mode: "grid" | "list";
    gridColumns: number;
  };
  sort: {
    field: "name" | "type" | "updated_at" | "created_at";
    direction: "asc" | "desc";
  };
  filter: {
    type: ModelType | "all";
  };
};

interface ModelGroup {
  type: ModelType;
  title: string;
  models: Model[];
}

export default function Models() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const currentProfile = useCurrentProfile();
  const { getModelsByProfileGroupedByType, deleteModel, updateModel, createModel } = useModelsActions();
  const { fetchManifests } = useModelManifestsActions();
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [allModels, setAllModels] = useState<Model[]>([]);
  const isLoading = useModelsLoading();
  const [isUpdating, setIsUpdating] = useState(false);
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useLocalModelsPageSettings();

  useEffect(() => {
    const loadModels = async () => {
      if (currentProfile?.id) {
        const groupedModels = await getModelsByProfileGroupedByType(currentProfile.id);

        // Transform the record into an array of groups for rendering
        const groups: ModelGroup[] = Object.entries(groupedModels).map(([type, models]) => ({
          type: type as ModelType,
          title: getModelTypeTitle(type as ModelType),
          models,
        }));

        setModelGroups(groups);

        // Flatten all models for filtering
        const flattened = groups.flatMap((group) => group.models);
        setAllModels(flattened);
      }
    };

    // Fetch manifests as they might be needed for model details
    fetchManifests();
    loadModels();
  }, [currentProfile?.id]);

  const getModelTypeTitle = (type: ModelType): string => {
    const titles: Record<ModelType, string> = {
      llm: "Language Models",
      audio: "Audio Models",
      image: "Image Generation Models",
      database: "Database Models",
    };
    return titles[type] || "Other Models";
  };

  const getModelTypeIcon = (type: ModelType): React.ReactNode => {
    const icons: Record<ModelType, React.ReactNode> = {
      llm: <Brain className="h-4 w-4 text-primary" />,
      audio: <Music className="h-4 w-4 text-primary" />,
      image: <Image className="h-4 w-4 text-primary" />,
      database: <Database className="h-4 w-4 text-primary" />,
    };
    return icons[type] || <Brain className="h-4 w-4" />;
  };

  // Filter and sort models
  const filteredAndSortedModels = useMemo(() => {
    let filtered = allModels;

    // Apply search filter
    if (search) {
      filtered = filtered.filter(
        (model) => model.name.toLowerCase().includes(search.toLowerCase()) || model.manifest_id.toLowerCase().includes(search.toLowerCase()),
      );
    }

    // Apply type filter
    if (settings.filter.type !== "all") {
      filtered = filtered.filter((model) => model.type === settings.filter.type);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      const direction = settings.sort.direction === "asc" ? 1 : -1;

      switch (settings.sort.field) {
        case "name":
          return direction * a.name.localeCompare(b.name);
        case "type":
          return direction * a.type.localeCompare(b.type);
        case "created_at":
          return direction * (new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        case "updated_at":
          return direction * (new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        default:
          return 0;
      }
    });

    return sorted;
  }, [allModels, search, settings.filter.type, settings.sort]);

  // Group filtered models by type for display
  const filteredGroups = useMemo(() => {
    if (settings.filter.type !== "all") {
      // Single type view
      return [
        {
          type: settings.filter.type,
          title: getModelTypeTitle(settings.filter.type),
          models: filteredAndSortedModels,
        },
      ];
    }

    // Group by type
    const grouped: Record<ModelType, Model[]> = {
      llm: [],
      audio: [],
      image: [],
      database: [],
    };

    filteredAndSortedModels.forEach((model) => {
      if (grouped[model.type]) {
        grouped[model.type].push(model);
      }
    });

    return Object.entries(grouped)
      .filter(([_, models]) => models.length > 0)
      .map(([type, models]) => ({
        type: type as ModelType,
        title: getModelTypeTitle(type as ModelType),
        models,
      }));
  }, [filteredAndSortedModels, settings.filter.type]);

  const handleEdit = async (model: Model) => {
    setSelectedModel(model);
    setEditDialogOpen(true);
  };

  const handleDelete = async (model: Model) => {
    setSelectedModel(model);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedModel) {
      return;
    }

    try {
      const success = await deleteModel(selectedModel.id);
      if (success && currentProfile?.id) {
        refreshModels();
      }
    } catch (error) {
      console.error("Failed to delete model:", error);
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const refreshModels = async () => {
    if (currentProfile?.id) {
      // Refresh the models list
      const groupedModels = await getModelsByProfileGroupedByType(currentProfile.id);
      const groups: ModelGroup[] = Object.entries(groupedModels).map(([type, models]) => ({
        type: type as ModelType,
        title: getModelTypeTitle(type as ModelType),
        models,
      }));
      setModelGroups(groups);

      const flattened = groups.flatMap((group) => group.models);
      setAllModels(flattened);

      // Update selectedModel if it exists
      if (selectedModel) {
        // Find the updated version of the selected model
        const updatedModel = flattened.find((m) => m.id === selectedModel.id);
        if (updatedModel) {
          setSelectedModel(updatedModel);
        }
      }
    }
  };

  const handleConfigSave = async (modelId: string, updates: { max_concurrency: number; inference_template_id?: string | null }) => {
    setIsUpdating(true);
    try {
      await updateModel(modelId, updates);
      await refreshModels();

      // Update the selected model to reflect changes
      if (selectedModel && selectedModel.id === modelId) {
        const updatedModel = {
          ...selectedModel,
          ...updates,
        };
        setSelectedModel(updatedModel);
      }
    } catch (error) {
      console.error("Failed to update model configuration:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfigOpen = (model: Model) => {
    setSelectedModel(model);
    setConfigDialogOpen(true);
  };

  const handleDuplicate = async (model: Model) => {
    if (!currentProfile?.id) {
      console.error("No current profile available for duplication");
      return;
    }

    try {
      setIsUpdating(true);

      // Prepare the model data for duplication
      const duplicateModelData: NewModelParams = {
        profile_id: currentProfile.id,
        name: `${model.name} (Copy)`,
        type: model.type,
        config: { ...model.config }, // Deep copy the config
        manifest_id: model.manifest_id,
        inference_template_id: model.inference_template_id!,
      };

      // Create the duplicate model in the database
      const isDuplicate = true;
      const duplicatedModel = await createModel(duplicateModelData, isDuplicate);

      // Refresh the models list to show the new duplicate
      await refreshModels();

      // Set the newly created model as selected and open edit dialog
      setSelectedModel(duplicatedModel);
      setEditDialogOpen(true);
    } catch (error) {
      console.error("Failed to duplicate model:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with filters and controls */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-1 p-4">
          <h1 className=" font-bold mr-auto title">Models</h1>

          {/* Search */}
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search models..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>

          {/* Refresh */}
          <Button variant="outline" size="icon" onClick={refreshModels} disabled={isLoading} title="Refresh Models">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Button
              variant={settings.view.mode === "grid" ? "ghost" : "secondary"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setSettings((prev: ModelsPageSettings) => ({ ...prev, view: { ...prev.view, mode: "grid" } }))}
              title="Grid View"
            >
              {settings.view.gridColumns === 3 ? <Grid3X3 className="h-4 w-4" /> : <Grid2X2 className="h-4 w-4" />}
            </Button>
            <Button
              variant={settings.view.mode === "list" ? "ghost" : "secondary"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setSettings((prev: ModelsPageSettings) => ({ ...prev, view: { ...prev.view, mode: "list" } }))}
              title="List View"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* View Settings */}
          {settings.view.mode === "grid" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="Grid Columns">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Grid columns</label>
                    <span className="text-xs text-muted-foreground">{settings.view.gridColumns}</span>
                  </div>
                  <Slider
                    value={[settings.view.gridColumns]}
                    min={2}
                    max={5}
                    step={1}
                    onValueChange={([value]) =>
                      setSettings((prev: ModelsPageSettings) => ({
                        ...prev,
                        view: {
                          ...prev.view,
                          gridColumns: value,
                        },
                      }))
                    }
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Sort */}
          <Select
            value={`${settings.sort.field}-${settings.sort.direction}`}
            onValueChange={(value) => {
              const [field, direction] = value.split("-") as [typeof settings.sort.field, typeof settings.sort.direction];
              setSettings((prev: ModelsPageSettings) => ({ ...prev, sort: { field, direction } }));
            }}
          >
            <SelectTrigger noChevron className={buttonVariants({ variant: "outline", size: "icon" })} title="Sort Models">
              <SortAsc className="h-4 w-4" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="type-asc">Type (A-Z)</SelectItem>
              <SelectItem value="type-desc">Type (Z-A)</SelectItem>
              <SelectItem value="updated_at-desc">Recently Updated</SelectItem>
              <SelectItem value="created_at-desc">Recently Created</SelectItem>
            </SelectContent>
          </Select>

          {/* Add Model Button */}
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Model
          </Button>
        </div>

        {/* Type Filter Tabs */}
        <div className="px-4 pb-3">
          <Tabs
            value={settings.filter.type}
            onValueChange={(value) => setSettings((prev: ModelsPageSettings) => ({ ...prev, filter: { type: value as ModelType | "all" } }))}
          >
            <TabsList className="w-full justify-start h-auto p-1 bg-muted/50">
              <TabsTrigger value="all" className="gap-2">
                All Models
                <span className="text-xs bg-background px-1.5 py-0.5 rounded-full">{allModels.length}</span>
              </TabsTrigger>
              <TabsTrigger value="llm" className="gap-2">
                {getModelTypeIcon("llm")} Language
                <span className="text-xs bg-background px-1.5 py-0.5 rounded-full">
                  {modelGroups.find((g) => g.type === "llm")?.models.length || 0}
                </span>
              </TabsTrigger>
              <TabsTrigger value="image" className="gap-2">
                {getModelTypeIcon("image")} Image
                <span className="text-xs bg-background px-1.5 py-0.5 rounded-full">
                  {modelGroups.find((g) => g.type === "image")?.models.length || 0}
                </span>
              </TabsTrigger>
              <TabsTrigger value="audio" className="gap-2">
                {getModelTypeIcon("audio")} Audio
                <span className="text-xs bg-background px-1.5 py-0.5 rounded-full">
                  {modelGroups.find((g) => g.type === "audio")?.models.length || 0}
                </span>
              </TabsTrigger>
              <TabsTrigger value="database" className="gap-2">
                {getModelTypeIcon("database")} Database
                <span className="text-xs bg-background px-1.5 py-0.5 rounded-full">
                  {modelGroups.find((g) => g.type === "database")?.models.length || 0}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto page-container">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <p className="text-muted-foreground">Loading models...</p>
          </div>
        ) : filteredAndSortedModels.length > 0 ? (
          <div className="space-y-6 py-1">
            {settings.view.mode === "grid" ? (
              // Grid View
              filteredGroups.map((group) => (
                <div key={group.type} className="space-y-3">
                  {settings.filter.type === "all" && (
                    <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                      {getModelTypeIcon(group.type)}
                      {group.title}
                      <span className="text-sm font-normal text-muted-foreground">({group.models.length})</span>
                    </h2>
                  )}
                  <div
                    className="grid gap-4"
                    style={{
                      gridTemplateColumns: `repeat(${settings.view.gridColumns}, minmax(0, 1fr))`,
                    }}
                  >
                    {group.models.map((model) => (
                      <ModelCard
                        key={model.id}
                        model={model}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                        setConfigDialogOpen={() => handleConfigOpen(model)}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              // List View - TODO: Implement ModelListItem component
              <div className="space-y-2">
                {filteredAndSortedModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    setConfigDialogOpen={() => handleConfigOpen(model)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center h-[calc(100vh-250px)]">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-1">
              {search || settings.filter.type !== "all" ? "No models match your filters" : "No models found"}
            </h3>
            <p className="text-base text-muted-foreground mt-1 mb-6 max-w-md">
              {search || settings.filter.type !== "all"
                ? "Try adjusting your search or filter settings."
                : "Get started by adding your first model to this profile."}
            </p>
            <Button variant="default" size="lg" onClick={() => setAddDialogOpen(true)}>
              <Plus size={20} className="mr-2" /> Create Model
            </Button>
          </div>
        )}
      </div>

      {/* Add Model Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Model</DialogTitle>
          </DialogHeader>
          <ModelForm
            mode="add"
            onSuccess={() => {
              setAddDialogOpen(false);
              refreshModels();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Model Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Model</DialogTitle>
          </DialogHeader>
          {selectedModel && (
            <ModelForm
              mode="edit"
              model={selectedModel}
              onSuccess={() => {
                setEditDialogOpen(false);
                refreshModels();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DestructiveConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Confirm Deletion"
        description={
          <>
            <p>Are you sure you want to delete {selectedModel?.name}?</p>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          </>
        }
        onConfirm={confirmDelete}
      />

      {selectedModel && (
        <ModelConfigDialog
          model={selectedModel}
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          onSave={handleConfigSave}
          isUpdating={isUpdating}
        />
      )}
    </div>
  );
}
