import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useModelManifestsActions } from "@/hooks/manifestStore";
import { useModelsActions, useModelsLoading } from "@/hooks/modelsStore";
import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Model, ModelType } from "../../schema/models-schema";
import { ModelCard } from "./components/ModelCard";
import { ModelConfigDialog } from "./components/ModelConfigDialog";
import { ModelForm } from "./components/ModelForm";

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
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const currentProfile = useCurrentProfile();
  const { getModelsByProfileGroupedByType, deleteModel, updateModel } = useModelsActions();
  const { fetchManifests } = useModelManifestsActions();
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const isLoading = useModelsLoading();
  const [isUpdating, setIsUpdating] = useState(false);

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

      // Update selectedModel if it exists
      if (selectedModel) {
        // Find the updated version of the selected model
        for (const group of groups) {
          const updatedModel = group.models.find((m) => m.id === selectedModel.id);
          if (updatedModel) {
            setSelectedModel(updatedModel);
            break;
          }
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
    // Remove the id property to ensure a new one is generated
    const { id, ...duplicateWithoutId } = model;

    // Create a duplicate model with the correct types
    setSelectedModel({
      ...duplicateWithoutId,
      id: "",
      name: `${model.name} (Copy)`,
      // Let the backend handle timestamps
    } as Model);

    setDuplicateDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex-1 space-y-4 page-container overflow-y-auto pb-16">
        <h1 className="title">Models List</h1>
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <p className="text-muted-foreground">Loading models...</p>
          </div>
        ) : modelGroups.length > 0 ? (
          modelGroups.map((group) => (
            <div key={group.type} className="space-y-2">
              <h2 className="text-base font-semibold tracking-tight">{group.title}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          <div className="flex flex-col items-center justify-center p-8 text-center h-[calc(100vh-250px)]">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-1">No models found</h3>
            <p className="text-base text-muted-foreground mt-1 mb-6 max-w-md">Get started by adding your first model to this profile.</p>
            <Button variant="default" size="lg" onClick={() => setAddDialogOpen(true)}>
              <Plus size={20} className="mr-2" /> Create Model
            </Button>
          </div>
        )}
      </div>

      {/* Add Model Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogTrigger asChild>
          {modelGroups.length > 0 && (
            <Button className="sticky bottom-0 w-full h-14 rounded-none border-t" size="lg">
              <Plus className="mr-2 h-5 w-5" />
              Add Model
            </Button>
          )}
        </DialogTrigger>
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

      {/* Duplicate Model Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Model</DialogTitle>
          </DialogHeader>
          {selectedModel && (
            <ModelForm
              mode="duplicate"
              model={selectedModel}
              onSuccess={() => {
                setDuplicateDialogOpen(false);
                refreshModels();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

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
