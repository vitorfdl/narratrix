import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useProfile } from "@/hooks/ProfileContext";
import { useManifestStore } from "@/hooks/manifestStore";
import { useModelsStore } from "@/hooks/modelsStore";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Model, ModelType } from "../../schema/models-schema";
import { ModelCard } from "./components/ModelCard";
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
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const profile = useProfile();
  const { getModelsByProfileGroupedByType, deleteModel, isLoading } = useModelsStore();
  const { fetchManifests } = useManifestStore();
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);

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
  }, [profile.currentProfile?.id, getModelsByProfileGroupedByType, fetchManifests]);

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

  return (
    <div className="flex flex-col h-full page-container">
      <div className="flex-1 space-y-4">
        <h1 className="title">Models List</h1>
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <p className="text-muted-foreground">Loading models...</p>
          </div>
        ) : modelGroups.length > 0 ? (
          modelGroups.map((group) => (
            <div key={group.type} className="space-y-2">
              <h2 className="text-base font-semibold tracking-tight">{group.title}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {group.models.map((model) => (
                  <ModelCard key={model.id} model={model} onEdit={handleEdit} onDelete={handleDelete} />
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
          <Button className="w-full rounded-none h-14 bg-accent hover:bg-accent/90 text-accent-foreground" size="lg">
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
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p>Are you sure you want to delete {selectedModel?.name}?</p>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
