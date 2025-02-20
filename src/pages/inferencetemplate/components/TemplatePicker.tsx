import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash, Plus, Edit, FileDown, FileUp } from "lucide-react";

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
}

export function TemplatePicker({ 
  templates = [],
  selectedTemplateId,
  onTemplateSelect,
  onDelete, 
  onNewTemplate, 
  onEditName, 
  onImport, 
  onExport 
}: TemplatePickerProps): JSX.Element {
  const hasTemplates = templates.length > 0;

  return (
    <div className="flex items-center space-x-2">
      <Select
        value={selectedTemplateId ?? undefined}
        onValueChange={onTemplateSelect}
        disabled={!hasTemplates}
      >
        <SelectTrigger className="w-full bg-muted">
          <SelectValue placeholder={hasTemplates ? "Select Template" : "No templates available"} />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center space-x-1">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={onDelete}
          disabled={!selectedTemplateId}
        >
          <Trash className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onEditName}
          disabled={!selectedTemplateId}
          title="Edit Template Name"
        >
          <Edit className="h-4 w-4" />
        </Button>
        
        <Button variant="outline" size="icon" onClick={onNewTemplate} title="Create New Template">
          <Plus className="h-4 w-4" />
        </Button>

        <Button variant="outline" size="icon" onClick={onImport} title="Import Template">
          <FileDown className="h-4 w-4" />
        </Button>
        
        <Button 
          variant="outline" 
          size="icon" 
          onClick={onExport}
          disabled={!selectedTemplateId}
          title="Export Template"
        >
          <FileUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
} 