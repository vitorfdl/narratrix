import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useProfile } from "@/hooks/ProfileContext";
import { useModelManifestsActions } from "@/hooks/manifestStore";
import { useModelsActions, useModelsLoading } from "@/hooks/modelsStore";
import { Plus } from "lucide-react";
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
  const profile = useProfile();
  const { getModelsByProfileGroupedByType, deleteModel, updateModel } = useModelsActions();
  const { fetchManifests } = useModelManifestsActions();
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const isLoading = useModelsLoading();
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      if (profile.currentProfile?.id) {
        const groupedModels = await getModelsByProfileGroupedByType(profile.currentProfile.id);

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
  }, [profile.currentProfile?.id]);

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
      if (success && profile.currentProfile?.id) {
        refreshModels();
      }
    } catch (error) {
      console.error("Failed to delete model:", error);
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const refreshModels = async () => {
    if (profile.currentProfile?.id) {
      // Refresh the models list
      const groupedModels = await getModelsByProfileGroupedByType(profile.currentProfile.id);
      const groups: ModelGroup[] = Object.entries(groupedModels).map(([type, models]) => ({
        type: type as ModelType,
        title: getModelTypeTitle(type as ModelType),
        models,
      }));
      setModelGroups(groups);
    }
  };

  const handleConfigSave = async (modelId: string, updates: { max_concurrency: number; inference_template_id?: string | null }) => {
    setIsUpdating(true);
    try {
      await updateModel(modelId, updates);
      await refreshModels();
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
          <div className="flex flex-col items-center justify-center h-64">
            <p className="text-muted-foreground mb-4">No models found for this profile</p>
          </div>
        )}
      </div>

      {/* Add Model Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogTrigger asChild>
          <Button className="sticky bottom-0 w-full h-14 rounded-none border-t" size="lg">
            <Plus className="mr-2 h-5 w-5" />
            Add Model
          </Button>
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
