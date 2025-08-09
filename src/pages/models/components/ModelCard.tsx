import { Brain, Clock, Copy, Cpu, Edit, GitBranch, Network, Server, Trash2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useModelManifestsActions } from "@/hooks/manifestStore";
import { useInferenceTemplate } from "@/hooks/templateStore";
import { Model } from "../../../schema/models-schema";

interface ModelCardProps {
  model: Model;
  onEdit?: (model: Model) => void;
  onDelete?: (model: Model) => void;
  onDuplicate?: (model: Model) => void;
  setConfigDialogOpen: (model: Model) => void;
}

export function ModelCard({ model, onEdit, onDelete, onDuplicate, setConfigDialogOpen }: ModelCardProps) {
  const { getManifestById } = useModelManifestsActions();
  const [manifestName, setManifestName] = useState<string>("");
  const inferenceTemplate = useInferenceTemplate(model.inference_template_id || "");

  // For demonstration purposes, you can replace these with actual model properties
  const isNew = model.created_at && new Date().getTime() - new Date(model.created_at).getTime() < 15 * 60 * 60 * 1000; // 15 hours
  const isPopular = false; // Replace with actual logic if you have popularity metrics

  useEffect(() => {
    // Fetch manifest information to display the manifest name
    const fetchManifestInfo = async () => {
      try {
        const manifest = await getManifestById(model.manifest_id);
        if (manifest) {
          setManifestName(manifest.name);
        }
      } catch (error) {
        console.error("Failed to fetch manifest:", error);
      }
    };

    fetchManifestInfo();
  }, [model.manifest_id, getManifestById]);

  // Parse config to extract relevant display info
  const config = typeof model.config === "string" ? JSON.parse(model.config) : model.config;
  let urlValue: string | undefined;
  let modelValue: string | undefined;
  let fallbackValue: string | undefined;

  if (config) {
    const configEntries = Object.entries(config);
    for (const [key, value] of configEntries) {
      const lowerKey = key.toLowerCase();
      const isSensitive = lowerKey.includes("key") || lowerKey.includes("secret") || lowerKey.includes("token");

      if (typeof value === "string" && !isSensitive) {
        if (lowerKey.includes("url")) {
          urlValue = value;
        } else if (lowerKey.includes("model")) {
          modelValue = value;
        } else if (!fallbackValue) {
          fallbackValue = value; // Store the first non-sensitive string as fallback
        }
      }
    }
  }

  // Generate capabilities based on model type and inference template
  const getCapabilities = () => {
    const capabilities = [];
    capabilities.push(model.type.toUpperCase());

    if (inferenceTemplate) {
      capabilities.push("Text Completion");
    } else {
      capabilities.push("Chat");
    }

    return capabilities;
  };

  // Get model type icon
  const getModelIcon = () => {
    const type = model.type.toLowerCase();
    if (type.includes("chat") || type.includes("gpt")) {
      return Brain;
    }
    if (type.includes("embedding")) {
      return Network;
    }
    if (type.includes("completion")) {
      return GitBranch;
    }
    return Cpu;
  };

  const ModelIcon = getModelIcon();

  return (
    <Card
      onClick={() => setConfigDialogOpen(model)}
      className="group relative overflow-hidden flex flex-col h-full bg-gradient-to-br from-background to-accent/10 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 cursor-pointer"
    >
      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ModelIcon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base line-clamp-1">{model.name}</h3>
              <p className="text-xs text-muted-foreground">{manifestName || model.manifest_id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status badges */}
            {isNew && (
              <Badge variant="default" className="text-xxs flex items-center text-primary-foreground">
                <Zap className="h-3 w-3 mr-1" />
                New
              </Badge>
            )}
            {isPopular && (
              <Badge variant="secondary" className="text-xxs flex items-center">
                Popular
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {/* Model configuration details */}
        <div className="space-y-2">
          {urlValue && (
            <div className="flex items-center gap-2 text-xs">
              <Server className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono text-muted-foreground truncate" title={urlValue}>
                {urlValue}
              </span>
            </div>
          )}
          {modelValue && (
            <div className="flex items-center gap-2 text-xs">
              <Brain className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono text-muted-foreground truncate" title={modelValue}>
                {modelValue}
              </span>
            </div>
          )}
          {!urlValue && !modelValue && fallbackValue && (
            <div className="flex items-center gap-2 text-xs">
              <Cpu className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono text-muted-foreground truncate">{fallbackValue}</span>
            </div>
          )}
        </div>

        {/* Model stats */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span>Max: {model.max_concurrency}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Cpu className="h-3 w-3" />
            <span>{model.type.toUpperCase()}</span>
          </div>
        </div>

        {/* Capabilities */}
        <div className="flex flex-wrap gap-1">
          {getCapabilities().map((capability, index) => (
            <Badge key={index} variant="outline" className="text-xxs py-0.5 px-1.5">
              {capability}
            </Badge>
          ))}
          {inferenceTemplate && (
            <Badge variant="secondary" className="text-xxs py-0.5 px-1.5 text-primary">
              {inferenceTemplate.name}
            </Badge>
          )}
        </div>
      </CardContent>

      {/* Action buttons - shown on hover */}
      <div className="absolute right-2 top-2  flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(model);
          }}
          title="Edit Model"
        >
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate?.(model);
          }}
          title="Duplicate Model"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="destructive"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(model);
          }}
          title="Delete Model"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <CardFooter className="p-3 pt-0 text-xs text-muted-foreground mt-auto">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Updated {new Date(model.updated_at).toLocaleDateString()}</span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
