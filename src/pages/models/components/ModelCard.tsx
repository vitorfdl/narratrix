import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useModelManifestsActions } from "@/hooks/manifestStore";
import { useInferenceTemplate } from "@/hooks/templateStore";
import { Clock, Copy, Cpu, EditIcon, MoreVertical, Trash2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
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
  // const [manifestFields, setManifestFields] = useState<Manifest["fields"]>([]);
  const inferenceTemplate = useInferenceTemplate(model.inference_template_id || "");
  // For demonstration purposes, you can replace these with actual model properties
  const isNew = model.created_at && new Date().getTime() - new Date(model.created_at).getTime() < 15 * 60 * 60 * 1000; // 3 hours
  const isPopular = false; // Replace with actual logic if you have popularity metrics

  useEffect(() => {
    // Fetch manifest information to display the manifest name
    const fetchManifestInfo = async () => {
      try {
        const manifest = await getManifestById(model.manifest_id);
        if (manifest) {
          setManifestName(manifest.name);
          // setManifestFields(manifest.fields);
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

  // Format the date to a more readable format
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

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

  return (
    <>
      <Card
        onClick={() => setConfigDialogOpen(model)}
        className="bg-card border-border hover:cursor-pointer hover:border-primary/50 transition-all overflow-hidden group h-full flex flex-col"
      >
        <CardHeader className="pb-2 flex flex-row justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="flex w-full justify-between items-center gap-2 text-foreground">{model.name}</CardTitle>
              {isNew && <Badge className="bg-primary hover:bg-primary/80">New</Badge>}
              {isPopular && (
                <Badge variant="outline" className="border-accent-foreground text-accent-foreground">
                  Popular
                </Badge>
              )}
            </div>
            <CardDescription className="flex items-center mt-1">
              <span className="text-muted-foreground">{manifestName || model.manifest_id}</span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(model);
                  }}
                  className="cursor-pointer"
                >
                  <EditIcon className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate?.(model);
                  }}
                  className="cursor-pointer"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(model);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="pb-2 flex-grow">
          <div className="space-y-1.5">
            {urlValue && (
              <div className="flex items-center text-sm">
                <Cpu className="h-4 w-4 mr-2 text-muted-foreground/70 flex-shrink-0" />
                <span className="text-foreground mr-1  font-mono font-bold">URL:</span>
                <span className="text-muted-foreground  truncate" title={urlValue}>
                  {urlValue}
                </span>
              </div>
            )}
            {modelValue && (
              <div className="flex items-center text-sm">
                <Cpu className="h-4 w-4 mr-2 text-muted-foreground/70 flex-shrink-0" />
                <span className="text-foreground mr-1 font-mono font-bold">Model:</span>
                <span className="text-muted-foreground truncate" title={modelValue}>
                  {modelValue}
                </span>
              </div>
            )}
            {!urlValue && !modelValue && (
              <div className="flex items-center text-sm">
                <Cpu className="h-4 w-4 mr-2 text-muted-foreground/70 flex-shrink-0" />
                <span className="text-muted-foreground mr-1">Type:</span>
                <span className="text-card-foreground font-mono">{fallbackValue || model.type.toUpperCase()}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-1 pt-2">
              {getCapabilities().map((capability, index) => (
                <Badge key={index} variant="secondary" className="bg-secondary hover:bg-secondary/80 text-secondary-foreground">
                  {capability}
                </Badge>
              ))}
              {inferenceTemplate && (
                <Badge variant="secondary" className="bg-secondary hover:bg-secondary/80 text-primary">
                  {inferenceTemplate.name}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="py-2 px-6 flex justify-between text-sm text-muted-foreground mt-auto">
          <div className="flex items-center">
            <Zap className="h-3 w-3 mr-1" />
            <span>Max: {model.max_concurrency}</span>
          </div>
          <div className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            <span>Updated: {formatDate(new Date(model.updated_at))}</span>
          </div>
        </CardFooter>

        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent-foreground transform translate-y-1 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500" />
      </Card>
    </>
  );
}
