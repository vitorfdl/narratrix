import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog";
import { EditNameDialog } from "@/components/shared/EditNameDialog";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, CopyPlus, Edit, FileDown, FileUp, MoreHorizontal, Plus, Trash } from "lucide-react";
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
  onNewTemplate: (name: string, sourceTemplateId?: string) => void;
  onEditName: (templateId: string, name: string) => void;
  onImport: () => void;
  onExport: (templateId: string) => void;
  compact?: boolean;
  disabled?: boolean;
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
  disabled = false,
}: TemplatePickerProps): JSX.Element {
  const hasTemplates = templates.length > 0;
  const selectedTemplate = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) : null;

  // Modal states
  const [isNewTemplateDialogOpen, setIsNewTemplateDialogOpen] = useState(false);
  const [isEditTemplateDialogOpen, setIsEditTemplateDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isDropdownOpen, setisDropdownOpen] = useState(false);

  // Handler functions
  const handleNewTemplateClick = () => {
    setNewTemplateName("");
    setIsNewTemplateDialogOpen(true);
  };

  const handleEditNameClick = () => {
    if (selectedTemplate) {
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

  const handleUpdateTemplateName = (newName: string) => {
    if (selectedTemplateId && newName.trim()) {
      onEditName(selectedTemplateId, newName.trim());
      setIsEditTemplateDialogOpen(false);
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

  // Map templates to ComboboxItem format
  const comboboxItems: ComboboxItem[] = templates.map((template) => ({
    value: template.id,
    label: template.name,
  }));

  return (
    <>
      <div className="flex items-center space-x-1.5">
        <div className="flex-1">
          <Combobox
            items={comboboxItems}
            onChange={onTemplateSelect}
            selectedValue={selectedTemplateId ?? undefined}
            placeholder="Search templates..."
            trigger={
              <Button
                variant="outline"
                role="combobox"
                className={cn(
                  "w-full h-8 justify-between bg-muted text-sm text-foreground focus:border-none ring-primary/25 ring-1",
                  selectedTemplate && "bg-primary/10 text-primary",
                )}
                disabled={!hasTemplates || disabled}
              >
                {selectedTemplate ? selectedTemplate.name : hasTemplates ? "Select Template" : "No templates available"}
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            }
          />
        </div>

        {compact ? (
          <DropdownMenu>
            <DropdownMenu open={isDropdownOpen} onOpenChange={setisDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Options" disabled={disabled}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-sm">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setisDropdownOpen(false);
                    handleNewTemplateClick();
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  New Template
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();

                    if (selectedTemplateId) {
                      onNewTemplate(selectedTemplate?.name || "Unnamed Template", selectedTemplateId);
                      setisDropdownOpen(false);
                    }
                  }}
                  disabled={!selectedTemplateId}
                  className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}
                >
                  <CopyPlus className="h-3.5 w-3.5 mr-1.5" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setisDropdownOpen(false);
                    handleEditNameClick();
                  }}
                  disabled={!selectedTemplateId}
                  className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}
                >
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  Edit Name
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setisDropdownOpen(false);
                    onImport();
                  }}
                  disabled={true}
                >
                  <FileDown className="h-3.5 w-3.5 mr-1.5" />
                  Import
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setisDropdownOpen(false);
                    handleExport();
                  }}
                  disabled={!selectedTemplateId || true}
                  className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}
                >
                  <FileUp className="h-3.5 w-3.5 mr-1.5" />
                  Export
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setisDropdownOpen(false);
                    handleDeleteClick();
                  }}
                  disabled={!selectedTemplateId}
                  className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}
                >
                  <Trash className="h-3.5 w-3.5 mr-1.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </DropdownMenu>
        ) : (
          <div className="flex items-center space-x-0.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.preventDefault();
                setisDropdownOpen(false);
                handleEditNameClick();
              }}
              disabled={!selectedTemplateId || disabled}
              title="Edit Template Name"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.preventDefault();
                setisDropdownOpen(false);
                handleNewTemplateClick();
              }}
              title="Create New Template"
              disabled={disabled}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>

            <DropdownMenu open={isDropdownOpen} onOpenChange={setisDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="More Options">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="text-sm">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    if (selectedTemplateId) {
                      onNewTemplate(selectedTemplate?.name || "Unnamed Template", selectedTemplateId);
                      setisDropdownOpen(false);
                    }
                  }}
                  disabled={!selectedTemplateId}
                  className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}
                >
                  <CopyPlus className="h-3.5 w-3.5 mr-1.5" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setisDropdownOpen(false);
                    onImport();
                  }}
                  disabled={true}
                >
                  <FileDown className="h-3.5 w-3.5 mr-1.5" />
                  Import
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setisDropdownOpen(false);
                    handleExport();
                  }}
                  disabled={!selectedTemplateId || true}
                  className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}
                >
                  <FileUp className="h-3.5 w-3.5 mr-1.5" />
                  Export
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setisDropdownOpen(false);
                    handleDeleteClick();
                  }}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTemplateName.trim()) {
                    handleCreateTemplate();
                  }
                }}
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
      <EditNameDialog
        open={isEditTemplateDialogOpen}
        onOpenChange={setIsEditTemplateDialogOpen}
        initialName={selectedTemplate?.name ?? ""}
        onSave={handleUpdateTemplateName}
        title="Edit Template Name"
        description="Update the name of your template."
        label="Name"
        placeholder="Template name"
        saveButtonText="Update"
      />

      {/* Delete Confirmation Dialog */}
      <DestructiveConfirmDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        onConfirm={handleConfirmDelete}
        title="Delete Template"
        description="Are you sure you want to delete this template? This action cannot be undone."
        confirmText="Delete"
      />
    </>
  );
}
