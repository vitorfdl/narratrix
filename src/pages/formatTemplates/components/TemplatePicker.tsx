import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, FileDown, FileUp, MoreHorizontal, Plus, Trash } from "lucide-react";
import { useState } from "react";

export interface Template {
  id: string;
  name: string;
}

export interface TemplatePickerProps {
  templates?: Template[];
  selectedTemplateId: string | null;
  onTemplateSelect: (templateId: string) => void;
  onDelete: (templateId: string) => void;
  onNewTemplate: (name: string) => void;
  onEditName: (templateId: string, name: string) => void;
  onImport: () => void;
  onExport: (templateId: string) => void;
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
  const selectedTemplate = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) : null;

  // Modal states
  const [isNewTemplateDialogOpen, setIsNewTemplateDialogOpen] = useState(false);
  const [isEditTemplateDialogOpen, setIsEditTemplateDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [editedTemplateName, setEditedTemplateName] = useState("");

  // Handler functions
  const handleNewTemplateClick = () => {
    setNewTemplateName("");
    setIsNewTemplateDialogOpen(true);
  };

  const handleEditNameClick = () => {
    if (selectedTemplate) {
      setEditedTemplateName(selectedTemplate.name);
      setIsEditTemplateDialogOpen(true);
    }
  };

  const handleDeleteClick = () => {
    if (selectedTemplateId) {
      setIsDeleteConfirmOpen(true);
    }
  };

  const handleCreateTemplate = () => {
    if (newTemplateName.trim()) {
      onNewTemplate(newTemplateName.trim());
      setIsNewTemplateDialogOpen(false);
      setNewTemplateName("");
    }
  };

  const handleUpdateTemplateName = () => {
    if (selectedTemplateId && editedTemplateName.trim()) {
      onEditName(selectedTemplateId, editedTemplateName.trim());
      setIsEditTemplateDialogOpen(false);
      setEditedTemplateName("");
    }
  };

  const handleConfirmDelete = () => {
    if (selectedTemplateId) {
      onDelete(selectedTemplateId);
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleExport = () => {
    if (selectedTemplateId) {
      onExport(selectedTemplateId);
    }
  };

  return (
    <>
      <div className="flex items-center space-x-1.5">
        <div className="flex-1">
          <Select value={selectedTemplateId ?? undefined} onValueChange={onTemplateSelect} disabled={!hasTemplates}>
            <SelectTrigger className="w-full h-8 text-xs">
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
              <DropdownMenuItem onClick={handleNewTemplateClick}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New Template
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleEditNameClick}
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
                onClick={handleExport}
                disabled={!selectedTemplateId || true}
                className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}
              >
                <FileUp className="h-3.5 w-3.5 mr-1.5" />
                Export
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDeleteClick}
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
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleEditNameClick}
              disabled={!selectedTemplateId}
              title="Edit Template Name"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>

            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handleNewTemplateClick} title="Create New Template">
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
                  onClick={handleExport}
                  disabled={!selectedTemplateId || true}
                  className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}
                >
                  <FileUp className="h-3.5 w-3.5 mr-1.5" />
                  Export
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDeleteClick}
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

      {/* New Template Dialog */}
      <Dialog open={isNewTemplateDialogOpen} onOpenChange={setIsNewTemplateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Create New Template</DialogTitle>
            <DialogDescription className="text-base mt-2">Enter a name for your new template.</DialogDescription>
          </DialogHeader>
          <div className="py-2 flex flex-col space-y-2">
            <div className="flex items-center gap-4">
              <Label htmlFor="name" className="min-w-10">
                Name:
              </Label>
              <Input
                id="name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="flex-1"
                placeholder="Template name"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsNewTemplateDialogOpen(false)} className="min-w-24">
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate} disabled={!newTemplateName.trim()} className="min-w-24 bg-primary hover:bg-primary/90">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Name Dialog */}
      <Dialog open={isEditTemplateDialogOpen} onOpenChange={setIsEditTemplateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Edit Template Name</DialogTitle>
            <DialogDescription className="text-base mt-2">Update the name of your template.</DialogDescription>
          </DialogHeader>
          <div className="py-2 flex flex-col space-y-2">
            <div className="flex items-center gap-4">
              <Label htmlFor="edit-name" className="min-w-10">
                Name:
              </Label>
              <Input
                id="edit-name"
                value={editedTemplateName}
                onChange={(e) => setEditedTemplateName(e.target.value)}
                className="flex-1"
                placeholder="Template name"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditTemplateDialogOpen(false)} className="min-w-24">
              Cancel
            </Button>
            <Button onClick={handleUpdateTemplateName} disabled={!editedTemplateName.trim()} className="min-w-24 bg-primary hover:bg-primary/90">
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this template? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
