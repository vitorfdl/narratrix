import { useEffect, useState } from "react";
import { LuCopy, LuTrash2 } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { useEmbeddingManifestsActions, useModelManifestsActions } from "@/hooks/manifestStore";
import { useInferenceTemplate } from "@/hooks/templateStore";
import type { Engine } from "@/schema/model-manifest-schema";
import { getEngineColor, getEngineIcon } from "@/utils/engine-icons";
import type { Model } from "../../../schema/models-schema";

interface ModelCardProps {
  model: Model;
  onDelete?: (model: Model) => void;
  onDuplicate?: (model: Model) => void;
  onOpenSettings: (model: Model) => void;
}

export function ModelCard({ model, onDelete, onDuplicate, onOpenSettings }: ModelCardProps) {
  const { getManifestById } = useModelManifestsActions();
  const { getManifestById: getEmbeddingManifestById } = useEmbeddingManifestsActions();
  const [manifestName, setManifestName] = useState<string>("");
  const [manifestEngine, setManifestEngine] = useState<Engine | undefined>(undefined);
  const inferenceTemplate = useInferenceTemplate(model.inference_template_id || "");

  useEffect(() => {
    const fetchManifestInfo = async () => {
      try {
        const lookup = model.type === "embedding" ? getEmbeddingManifestById : getManifestById;
        const manifest = await lookup(model.manifest_id);
        if (manifest) {
          setManifestName(manifest.name);
          setManifestEngine(manifest.engine);
        }
      } catch (error) {
        console.error("Failed to fetch manifest:", error);
      }
    };

    fetchManifestInfo();
  }, [model.manifest_id, model.type, getManifestById, getEmbeddingManifestById]);

  const config = typeof model.config === "string" ? JSON.parse(model.config) : model.config;
  let modelValue: string | undefined;

  if (config) {
    for (const [key, value] of Object.entries(config)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = lowerKey.includes("key") || lowerKey.includes("secret") || lowerKey.includes("token");
      if (typeof value === "string" && !isSensitive && lowerKey.includes("model")) {
        modelValue = value;
        break;
      }
    }
  }

  const ModelIcon = getEngineIcon(manifestEngine);
  const engineColor = getEngineColor(manifestEngine);

  const inferenceMode = inferenceTemplate ? "Text Completion" : model.type !== "embedding" ? "Chat" : null;

  return (
    <div
      onClick={() => onOpenSettings(model)}
      className="group relative flex items-start gap-3 rounded-lg bg-card p-3.5 shadow-sm ring-1 ring-border/50 transition-all duration-200 hover:shadow-md hover:ring-border cursor-pointer"
    >
      <div
        className="shrink-0 mt-0.5 rounded-md p-2"
        style={engineColor ? { backgroundColor: `${engineColor}12`, color: engineColor } : { backgroundColor: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
      >
        <ModelIcon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold truncate">{model.name}</h3>
          {inferenceMode && <span className="shrink-0 text-[10px] font-medium text-muted-foreground/70 bg-muted/60 rounded px-1.5 py-0.5">{inferenceMode}</span>}
        </div>

        <p className="text-xs text-muted-foreground mt-0.5">{manifestName || model.manifest_id}</p>

        {modelValue && <p className="text-xs text-muted-foreground/60 font-mono mt-1 truncate">{modelValue}</p>}
      </div>

      <div className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate?.(model);
          }}
          title="Duplicate"
        >
          <LuCopy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(model);
          }}
          title="Delete"
        >
          <LuTrash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
