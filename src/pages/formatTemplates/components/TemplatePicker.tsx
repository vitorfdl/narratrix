import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, FileDown, FileUp, MoreHorizontal, Plus, Trash } from "lucide-react";

export interface Template {
  id: string;
  name: string;
}

export interface TemplatePickerProps {
  templates?: Template[];
  selectedTemplateId: string | null;
  onTemplateSelect: (templateId: string) => void;
  onDelete: () => void;
  onNewTemplate: () => void;
  onEditName: () => void;
  onImport: () => void;
  onExport: () => void;
  compact?: boolean;
}

export function TemplatePicker({
  templates = [],
  selectedTemplateId,
  onTemplateSelect,
  onDelete,
  onNewTemplate,
  onEditName,
  onImport,
  onExport,
  compact = false,
}: TemplatePickerProps): JSX.Element {
  const hasTemplates = templates.length > 0;

  return (
    <div className="flex items-center space-x-1.5">
      <div className="flex-1">
        <Select value={selectedTemplateId ?? undefined} onValueChange={onTemplateSelect} disabled={!hasTemplates}>
          <SelectTrigger className="w-full bg-muted h-8 text-xs">
            <SelectValue placeholder={hasTemplates ? "Select Template" : "No templates available"} />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id} className="text-xs">
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {compact ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Options">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-sm">
            <DropdownMenuItem onClick={onNewTemplate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Template
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onEditName}
              disabled={!selectedTemplateId}
              className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}
            >
              <Edit className="h-3.5 w-3.5 mr-1.5" />
              Edit Name
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onImport} disabled={true}>
              <FileDown className="h-3.5 w-3.5 mr-1.5" />
              Import
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onExport}
              disabled={!selectedTemplateId || true}
              className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}
            >
              <FileUp className="h-3.5 w-3.5 mr-1.5" />
              Export
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              disabled={!selectedTemplateId}
              className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}
            >
              <Trash className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center space-x-0.5">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={onEditName} disabled={!selectedTemplateId} title="Edit Template Name">
            <Edit className="h-3.5 w-3.5" />
          </Button>

          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={onNewTemplate} title="Create New Template">
            <Plus className="h-3.5 w-3.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="More Options">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-sm">
              <DropdownMenuItem onClick={onImport} disabled={true}>
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                Import
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onExport}
                disabled={!selectedTemplateId || true}
                className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}
              >
                <FileUp className="h-3.5 w-3.5 mr-1.5" />
                Export
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                disabled={!selectedTemplateId}
                className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}
              >
                <Trash className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
