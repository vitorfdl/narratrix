import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useModelManifestsActions } from "@/hooks/manifestStore";
import { useInferenceTemplate } from "@/hooks/templateStore";
import { Manifest } from "@/schema/model-manifest-schema";
import { Clock, Cpu, EditIcon, MoreVertical, Settings2Icon, Trash2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Model } from "../../../schema/models-schema";

interface ModelCardProps {
  model: Model;
  onEdit?: (model: Model) => void;
  onDelete?: (model: Model) => void;
  setConfigDialogOpen: (model: Model) => void;
}

export function ModelCard({ model, onEdit, onDelete, setConfigDialogOpen }: ModelCardProps) {
  const { getManifestById } = useModelManifestsActions();
  const [manifestName, setManifestName] = useState<string>("");
  const [manifestFields, setManifestFields] = useState<Manifest["fields"]>([]);
  const inferenceTemplate = useInferenceTemplate(model.inference_template_id || "");
  // For demonstration purposes, you can replace these with actual model properties
  const isNew = model.created_at && new Date().getTime() - new Date(model.created_at).getTime() < 7 * 24 * 60 * 60 * 1000; // 7 days
  const isPopular = false; // Replace with actual logic if you have popularity metrics

  useEffect(() => {
    // Fetch manifest information to display the manifest name
    const fetchManifestInfo = async () => {
      try {
        const manifest = await getManifestById(model.manifest_id);
        if (manifest) {
          setManifestName(manifest.name);
          setManifestFields(manifest.fields);
        }
      } catch (error) {
        console.error("Failed to fetch manifest:", error);
      }
    };

    fetchManifestInfo();
  }, [model.manifest_id, getManifestById]);

  // Get description with label from config, giving preference to URL or Model fields
  const getDescription = () => {
    // Parse config if needed
    const config = typeof model.config === "string" ? JSON.parse(model.config) : model.config;
    if (!config) {
      return `${model.type.toUpperCase()} model`;
    }

    // Try to find fields in this preference order: url, model, other non-secret fields
    const configEntries = Object.entries(config);
    let fieldKey: string | undefined;
    let fieldValue: string | undefined;

    // First pass - look for URL or model fields
    for (const [key, value] of configEntries) {
      const lowerKey = key.toLowerCase();
      if (
        (lowerKey.includes("url") || lowerKey.includes("model")) &&
        typeof value === "string" &&
        !lowerKey.includes("key") &&
        !lowerKey.includes("secret") &&
        !lowerKey.includes("token")
      ) {
        fieldKey = key;
        fieldValue = value as string;
        break;
      }
    }

    // Second pass - if no URL/model found, take first non-secret string value
    if (!fieldKey) {
      const firstValue = configEntries.find(([key, value]) => {
        const lowerKey = key.toLowerCase();
        return !lowerKey.includes("key") && !lowerKey.includes("secret") && !lowerKey.includes("token") && typeof value === "string";
      });

      if (firstValue) {
        fieldKey = firstValue[0];
        fieldValue = firstValue[1] as string;
      }
    }

    if (fieldKey && fieldValue) {
      // Try to find the matching label from manifest fields
      const fieldDef = manifestFields.find((field) => field.key === fieldKey);
      const label = fieldDef?.label || fieldKey;
      return fieldValue;
    }

    return `${model.type.toUpperCase()} model`;
  };

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
      <Card className="bg-background border-border hover:border-primary/50 transition-all overflow-hidden group h-full flex flex-col">
        <CardHeader className="pb-2 flex flex-row justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-foreground">{model.name}</CardTitle>
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
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => setConfigDialogOpen(model)}>
              <Settings2Icon className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border">
                <DropdownMenuItem onClick={() => onEdit?.(model)} className="cursor-pointer">
                  <EditIcon className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => onDelete?.(model)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="pb-2 flex-grow">
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <Cpu className="h-4 w-4 mr-2 text-muted-foreground/70" />
              <span className="text-muted-foreground">Model:</span>
              <span className="ml-2 text-card-foreground font-mono">{getDescription()}</span>
            </div>

            <div className="flex flex-wrap gap-1">
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

        <CardFooter className="pt-2 flex justify-between text-sm text-muted-foreground mt-auto">
          <div className="flex items-center">
            <Zap className="h-3 w-3 mr-1" />
            <span>Max: {model.max_concurrency}</span>
          </div>
          <div className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            <span>Updated: {formatDate(new Date(model.updated_at))}</span>
          </div>
        </CardFooter>

        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent-foreground transform translate-y-1 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-100" />
      </Card>
    </>
  );
}
