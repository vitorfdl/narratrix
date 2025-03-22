import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EditIcon, MoreVertical, Trash2 } from "lucide-react";
import { Model } from "../../../schema/models-schema";

interface ModelCardProps {
  model: Model;
  onEdit?: (model: Model) => void;
  onDelete?: (model: Model) => void;
}

export function ModelCard({ model, onEdit, onDelete }: ModelCardProps) {
  // Get first part of config for description if no description exists
  const getDescription = () => {
    // Since description doesn't exist on Model type, we need to check for config
    const config = typeof model.config === "string" ? JSON.parse(model.config) : model.config;

    // Use the first non-secret value from config as a descriptive text
    if (config) {
      const firstValue = Object.entries(config).find(([key, value]) => {
        return !key.toLowerCase().includes("key") && !key.toLowerCase().includes("secret") && !key.toLowerCase().includes("token") && typeof value === "string";
      });

      if (firstValue) {
        return firstValue[1] as string;
      }
    }

    return `${model.type.toUpperCase()} model`;
  };

  return (
    <Card className="w-full bg-card hover:bg-accent/50 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{model.name}</CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none">
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit?.(model)} className="cursor-pointer">
              <EditIcon className="mr-1" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => onDelete?.(model)}>
              <Trash2 className="mr-1" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground">{getDescription()}</div>
      </CardContent>
    </Card>
  );
}
