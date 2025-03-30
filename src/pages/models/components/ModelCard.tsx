import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useModelManifestsActions } from "@/hooks/manifestStore";
import { useFormatTemplate } from "@/hooks/templateStore";
import { Manifest } from "@/schema/model-manifest-schema";
import { EditIcon, InfoIcon, LinkIcon, MoreVertical, ServerIcon, Settings2Icon, Trash2 } from "lucide-react";
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
  const formatTemplate = useFormatTemplate(model.format_template_id || "");

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
      const isUrl = fieldKey.toLowerCase().includes("url") || (fieldDef && fieldDef.field_type === "url");

      return (
        <div className="flex items-center gap-1">
          {isUrl && <LinkIcon className="h-3 w-3" />}
          <span className="font-medium">{label}:</span> {fieldValue}
        </div>
      );
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

  return (
    <>
      <Card className="w-full bg-card hover:bg-accent/30 transition-colors border border-border/60 shadow-sm flex flex-col h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium flex items-center">{model.name}</CardTitle>
            <CardDescription className="text-xs flex items-center gap-1 text-muted-foreground">
              <ServerIcon className="h-3 w-3" />
              {manifestName || model.manifest_id}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setConfigDialogOpen(model)}>
              <Settings2Icon className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none">
                <MoreVertical className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit?.(model)} className="cursor-pointer">
                  <EditIcon className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => onDelete?.(model)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="pt-2 flex-grow">
          <div className="text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <InfoIcon className="h-3 w-3" />
              <span className="font-medium">{getDescription()}</span>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <Settings2Icon className="h-3 w-3" />
              <span className="font-medium">Format:</span> {formatTemplate?.name || "None"}
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-2 pb-3 text-xs text-muted-foreground flex justify-between items-center mt-auto">
          <div className="flex items-center gap-1">
            <InfoIcon className="h-3 w-3" />
            Max Concurrency: {model.max_concurrency}
          </div>
          <div className="italic">Updated: {formatDate(new Date(model.updated_at))}</div>
        </CardFooter>
      </Card>
    </>
  );
}
