import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { IconType } from "react-icons";
import { LuArrowDownAZ, LuBrain, LuDatabase, LuFileSearch, LuImage, LuMusic, LuPlus, LuRefreshCw, LuSearch } from "react-icons/lu";
import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmbeddingManifests, useEmbeddingManifestsActions, useModelManifests, useModelManifestsActions } from "@/hooks/manifestStore";
import { useModelsActions, useModelsLoading } from "@/hooks/modelsStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import type { NewModelParams } from "@/services/model-service";
import { useLocalModelsPageSettings } from "@/utils/local-storage";
import type { Model, ModelType } from "../../schema/models-schema";
import { ModelCard } from "./components/ModelCard";
import { ModelDialog } from "./components/ModelDialog";

export type ModelsPageSettings = {
  view: {
    cardsPerRow: number;
  };
  sort: {
    field: "name" | "type" | "engine" | "updated_at" | "created_at";
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

const MODEL_TYPE_ORDER: ModelType[] = ["llm", "image", "audio", "embedding", "database"];

const MODEL_TYPE_DETAILS: Record<ModelType, { title: string; label: string; icon: IconType }> = {
  llm: {
    title: "Language Models",
    label: "Language",
    icon: LuBrain,
  },
  image: {
    title: "Image Generation Models",
    label: "Image",
    icon: LuImage,
  },
  audio: {
    title: "Audio Models",
    label: "Audio",
    icon: LuMusic,
  },
  embedding: {
    title: "Embedding Models",
    label: "Embedding",
    icon: LuFileSearch,
  },
  database: {
    title: "Database Models",
    label: "Database",
    icon: LuDatabase,
  },
};

const getModelTypeTitle = (type: ModelType): string => MODEL_TYPE_DETAILS[type]?.title ?? "Other Models";

const getModelTypeIcon = (type: ModelType, className = "h-4 w-4 text-primary"): ReactNode => {
  const Icon = MODEL_TYPE_DETAILS[type]?.icon ?? LuBrain;
  return <Icon className={className} />;
};

export default function Models() {
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [modelDialogMode, setModelDialogMode] = useState<"add" | "edit">("add");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const currentProfile = useCurrentProfile();
  const { getModelsByProfileGroupedByType, deleteModel, createModel } = useModelsActions();
  const { fetchManifests } = useModelManifestsActions();
  const { fetchManifests: fetchEmbeddingManifests } = useEmbeddingManifestsActions();
  const manifests = useModelManifests();
  const embeddingManifests = useEmbeddingManifests();
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [allModels, setAllModels] = useState<Model[]>([]);
  const isLoading = useModelsLoading();
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useLocalModelsPageSettings();

  useEffect(() => {
    const loadModels = async () => {
      if (currentProfile?.id) {
        const groupedModels = await getModelsByProfileGroupedByType(currentProfile.id);

        const groups: ModelGroup[] = Object.entries(groupedModels).map(([type, models]) => ({
          type: type as ModelType,
          title: getModelTypeTitle(type as ModelType),
          models,
        }));

        setModelGroups(groups);

        const flattened = groups.flatMap((group) => group.models);
        setAllModels(flattened);
      }
    };

    fetchManifests();
    fetchEmbeddingManifests();
    loadModels();
  }, [currentProfile?.id, fetchEmbeddingManifests, fetchManifests, getModelsByProfileGroupedByType]);

  const filteredAndSortedModels = useMemo(() => {
    let filtered = allModels;

    if (search) {
      filtered = filtered.filter((model) => model.name.toLowerCase().includes(search.toLowerCase()) || model.manifest_id.toLowerCase().includes(search.toLowerCase()));
    }

    if (settings.filter.type !== "all") {
      filtered = filtered.filter((model) => model.type === settings.filter.type);
    }

    const sorted = [...filtered].sort((a, b) => {
      const direction = settings.sort.direction === "asc" ? 1 : -1;

      switch (settings.sort.field) {
        case "name":
          return direction * a.name.localeCompare(b.name);
        case "type":
          return direction * a.type.localeCompare(b.type);
        case "engine": {
          const engineA = (manifests.find((m) => m.id === a.manifest_id) ?? embeddingManifests.find((m) => m.id === a.manifest_id))?.engine ?? "";
          const engineB = (manifests.find((m) => m.id === b.manifest_id) ?? embeddingManifests.find((m) => m.id === b.manifest_id))?.engine ?? "";
          return direction * engineA.localeCompare(engineB);
        }
        case "created_at":
          return direction * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case "updated_at":
          return direction * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
        default:
          return 0;
      }
    });

    return sorted;
  }, [allModels, search, settings.filter.type, settings.sort, manifests, embeddingManifests]);

  const filteredGroups = useMemo(() => {
    if (settings.filter.type !== "all") {
      return [
        {
          type: settings.filter.type,
          title: getModelTypeTitle(settings.filter.type),
          models: filteredAndSortedModels,
        },
      ];
    }

    const grouped: Record<ModelType, Model[]> = {
      llm: [],
      audio: [],
      image: [],
      embedding: [],
      database: [],
    };

    for (const model of filteredAndSortedModels) {
      if (grouped[model.type]) {
        grouped[model.type].push(model);
      }
    }

    return MODEL_TYPE_ORDER.filter((type) => grouped[type].length > 0).map((type) => ({
      type,
      title: getModelTypeTitle(type),
      models: grouped[type],
    }));
  }, [filteredAndSortedModels, settings.filter.type]);

  const modelCounts = useMemo(() => {
    const counts: Record<ModelType, number> = {
      llm: 0,
      image: 0,
      audio: 0,
      embedding: 0,
      database: 0,
    };

    for (const group of modelGroups) {
      counts[group.type] = group.models.length;
    }

    return counts;
  }, [modelGroups]);

  const hasActiveFilters = search.length > 0 || settings.filter.type !== "all";

  const openAddDialog = () => {
    setSelectedModel(null);
    setModelDialogMode("add");
    setModelDialogOpen(true);
  };

  const openEditDialog = (model: Model) => {
    setSelectedModel(model);
    setModelDialogMode("edit");
    setModelDialogOpen(true);
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
      const groupedModels = await getModelsByProfileGroupedByType(currentProfile.id);
      const groups: ModelGroup[] = Object.entries(groupedModels).map(([type, models]) => ({
        type: type as ModelType,
        title: getModelTypeTitle(type as ModelType),
        models,
      }));
      setModelGroups(groups);

      const flattened = groups.flatMap((group) => group.models);
      setAllModels(flattened);

      if (selectedModel) {
        const updatedModel = flattened.find((m) => m.id === selectedModel.id);
        if (updatedModel) {
          setSelectedModel(updatedModel);
        }
      }
    }
  };

  const handleDuplicate = async (model: Model) => {
    if (!currentProfile?.id) {
      console.error("No current profile available for duplication");
      return;
    }

    try {
      const duplicateModelData: NewModelParams = {
        profile_id: currentProfile.id,
        name: `${model.name} (Copy)`,
        type: model.type,
        config: { ...model.config },
        manifest_id: model.manifest_id,
        max_concurrency: model.max_concurrency,
        inference_template_id: model.inference_template_id!,
      };

      const isDuplicate = true;
      const duplicatedModel = await createModel(duplicateModelData, isDuplicate);

      await refreshModels();
      openEditDialog(duplicatedModel);
    } catch (error) {
      console.error("Failed to duplicate model:", error);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="space-y-4 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-6 w-1 rounded-full bg-primary" />
                <h1 className="title font-bold">Models</h1>
              </div>
            </div>

            <Button onClick={openAddDialog} className="shrink-0">
              <LuPlus className="h-4 w-4" />
              Add Model
            </Button>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <LuSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or manifest..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 rounded-md border border-border/60 bg-muted/20 pl-9 font-sans text-sm"
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="icon" onClick={refreshModels} disabled={isLoading} title="Refresh Models" className="bg-background">
                <LuRefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>

              <Select
                value={`${settings.sort.field}-${settings.sort.direction}`}
                onValueChange={(value) => {
                  const [field, direction] = value.split("-") as [typeof settings.sort.field, typeof settings.sort.direction];
                  setSettings((prev: ModelsPageSettings) => ({ ...prev, sort: { field, direction } }));
                }}
              >
                <SelectTrigger noChevron className={buttonVariants({ variant: "outline", size: "icon", className: "bg-background" })} title="Sort Models">
                  <LuArrowDownAZ className="h-4 w-4" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                  <SelectItem value="type-asc">Type (A-Z)</SelectItem>
                  <SelectItem value="type-desc">Type (Z-A)</SelectItem>
                  <SelectItem value="engine-asc">Engine (A-Z)</SelectItem>
                  <SelectItem value="engine-desc">Engine (Z-A)</SelectItem>
                  <SelectItem value="updated_at-desc">Recently Updated</SelectItem>
                  <SelectItem value="created_at-desc">Recently Created</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={settings.filter.type} onValueChange={(value) => setSettings((prev: ModelsPageSettings) => ({ ...prev, filter: { type: value as ModelType | "all" } }))}>
            <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0">
              <TabsTrigger
                value="all"
                className="h-8 gap-2 rounded-full border border-transparent px-3 text-xs data-[state=active]:border-border data-[state=active]:bg-muted data-[state=active]:shadow-none"
              >
                All
                <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">{allModels.length}</span>
              </TabsTrigger>
              {MODEL_TYPE_ORDER.map((type) => (
                <TabsTrigger
                  key={type}
                  value={type}
                  className="h-8 gap-2 rounded-full border border-transparent px-3 text-xs data-[state=active]:border-border data-[state=active]:bg-muted data-[state=active]:shadow-none"
                >
                  {getModelTypeIcon(type, "h-3.5 w-3.5 text-primary")}
                  {MODEL_TYPE_DETAILS[type].label}
                  <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">{modelCounts[type]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full min-h-[420px] items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading models...</p>
          </div>
        ) : filteredAndSortedModels.length > 0 ? (
          <div className="w-full px-5 py-5">
            <div className="space-y-8">
              {filteredGroups.map((group) => (
                <section key={group.type} className="space-y-3">
                  <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {getModelTypeIcon(group.type, "h-3.5 w-3.5 text-primary")}
                      {group.title}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {group.models.length} {group.models.length === 1 ? "model" : "models"}
                    </span>
                  </div>

                  <div className="grid grid-cols-[repeat(auto-fill,minmax(26rem,1fr))] gap-3">
                    {group.models.map((model) => (
                      <ModelCard key={model.id} model={model} onDelete={handleDelete} onDuplicate={handleDuplicate} onOpenSettings={openEditDialog} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[420px] items-center justify-center px-6 text-center">
            <div className="max-w-sm">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border bg-muted/30">
                <LuSearch className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold">{hasActiveFilters ? "No models match your filters" : "No models yet"}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{hasActiveFilters ? "Try another search or model type." : "Add a model to make it available in this profile."}</p>
              {!hasActiveFilters && (
                <Button className="mt-5" onClick={openAddDialog}>
                  <LuPlus className="h-4 w-4" />
                  Add Model
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <ModelDialog
        mode={modelDialogMode}
        model={modelDialogMode === "edit" ? (selectedModel ?? undefined) : undefined}
        open={modelDialogOpen}
        onOpenChange={setModelDialogOpen}
        onSuccess={refreshModels}
      />

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
    </div>
  );
}
