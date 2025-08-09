import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog";
import { EditNameDialog } from "@/components/shared/EditNameDialog";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { sortTemplatesByFavoriteAndName } from "@/utils/sorting";
import { basename, extname } from "@tauri-apps/api/path";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { ChevronsUpDown, CopyPlus, Edit, FileDown, FileUp, MoreHorizontal, Plus, Trash } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export interface Template {
  id: string;
  name: string;
  favorite?: boolean;
}

export interface TemplatePickerProps {
  templates?: Template[];
  selectedTemplateId: string | null;
  onTemplateSelect: (templateId: string | null) => void;
  onDelete: (templateId: string) => void;
  onNewTemplate: (name: string, sourceTemplateId?: string) => void;
  onEditName: (templateId: string, name: string) => void;
  onFavoriteChange?: (templateId: string, favorite: boolean) => void;
  onImport?: (fileName: string, templateData: { [key: string]: any }) => void;
  onExport?: (templateId: string) => void;
  compact?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
}

export function TemplatePicker({
  templates = [],
  selectedTemplateId,
  onTemplateSelect,
  onDelete,
  onNewTemplate,
  onEditName,
  onFavoriteChange,
  onImport,
  onExport,
  clearable = false,
  compact = false,
  disabled = false,
  className,
}: TemplatePickerProps): JSX.Element {
  const hasTemplates = templates.length > 0;
  const selectedTemplate = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) : null;

  // Modal states
  const [isNewTemplateDialogOpen, setIsNewTemplateDialogOpen] = useState(false);
  const [isEditTemplateDialogOpen, setIsEditTemplateDialogOpen] = useState(false);
  const [isDuplicateTemplateDialogOpen, setIsDuplicateTemplateDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isDropdownOpen, setisDropdownOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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

  const handleDuplicateClick = () => {
    if (selectedTemplateId) {
      setIsDuplicateTemplateDialogOpen(true);
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

  const handleCreateDuplicateTemplate = (newName: string) => {
    if (selectedTemplateId && newName.trim()) {
      onNewTemplate(newName.trim(), selectedTemplateId);
      setIsDuplicateTemplateDialogOpen(false);
    }
  };

  const handleConfirmDelete = () => {
    if (selectedTemplateId) {
      onDelete(selectedTemplateId);
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleExport = () => {
    if (selectedTemplateId && onExport) {
      onExport(selectedTemplateId);
    }
  };

  const handleFavoriteToggle = useCallback(
    (templateId: string, currentFavorite: boolean) => {
      if (onFavoriteChange) {
        onFavoriteChange(templateId, !currentFavorite);
      }
    },
    [onFavoriteChange],
  );

  // File import functionality
  const handleImportClick = useCallback(async () => {
    if (isImporting || !onImport) {
      return;
    }

    try {
      setIsImporting(true);

      const selectedPath = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "JSON Files", extensions: ["json"] }],
      });

      if (selectedPath && typeof selectedPath === "string") {
        const fileContentBinary = await readFile(selectedPath);
        const decoder = new TextDecoder("utf-8");
        const fileContentString = decoder.decode(fileContentBinary);

        try {
          const templateData = JSON.parse(fileContentString);
          // Use Node.js path module for robust, cross-platform file name extraction (without extension)
          const fileBaseName = await basename(selectedPath);
          const fileExtName = await extname(selectedPath);
          const fileName = fileBaseName.slice(0, fileBaseName.length - fileExtName.length - 1) || "Untitled";
          onImport(fileName, templateData);
        } catch (parseError) {
          console.error("JSON parse error:", parseError);
          toast.error("Invalid JSON file", {
            description: "The selected file does not contain valid JSON data.",
          });
        }
      }
    } catch (error) {
      console.error("Error importing template:", error);
      toast.error("Import failed", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsImporting(false);
    }
  }, [onImport, isImporting]);

  // Map templates to ComboboxItem format with favorites at the top
  const comboboxItems: ComboboxItem[] = sortTemplatesByFavoriteAndName(templates).map((template) => ({
    value: template.id,
    label: template.name,
    favorite: template.favorite,
    onFavoriteToggle: () => handleFavoriteToggle(template.id, template.favorite || false),
  }));

  return (
    <>
      <div className={cn("flex items-center space-x-1.5", className)}>
        <div className="flex-1">
          <Combobox
            items={comboboxItems}
            onChange={onTemplateSelect}
            selectedValue={selectedTemplateId}
            placeholder="Search templates..."
            clearable={clearable}
            trigger={
              <Button
                variant="outline"
                role="combobox"
                className={cn(
                  "w-full h-8 justify-between bg-muted text-sm text-foreground ring-1 ring-primary/25 transition duration-150 ease-in-out hover:bg-accent/60 hover:ring-primary hover:scale-x-[1.02] shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1",
                  selectedTemplate && "bg-accent/50",
                )}
                disabled={!hasTemplates || disabled}
              >
                <span className="truncate text-left flex-1 min-w-0 text-ellipsis">{selectedTemplate ? selectedTemplate.name : hasTemplates ? "Select Template" : "No templates available"}</span>
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
                    setisDropdownOpen(false);
                    handleDuplicateClick();
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
                    handleImportClick();
                  }}
                  disabled={!onImport || isImporting}
                >
                  <FileDown className="h-3.5 w-3.5 mr-1.5" />
                  {isImporting ? "Importing..." : "Import"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setisDropdownOpen(false);
                    handleExport();
                  }}
                  disabled={!selectedTemplateId || !onExport}
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
                {/* New Template Button */}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setisDropdownOpen(false);
                    handleDuplicateClick();
                  }}
                  disabled={!selectedTemplateId}
                  className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}
                >
                  {/* Duplicate Button */}
                  <CopyPlus className="h-3.5 w-3.5 mr-1.5" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setisDropdownOpen(false);
                    handleImportClick();
                  }}
                  disabled={!onImport || isImporting}
                >
                  <FileDown className="h-3.5 w-3.5 mr-1.5" />
                  {isImporting ? "Importing..." : "Import"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setisDropdownOpen(false);
                    handleExport();
                  }}
                  disabled={!selectedTemplateId || !onExport}
                  className={!selectedTemplateId ? "opacity-50 pointer-events-none" : ""}
                >
                  {/* Export Button */}
                  <FileUp className="h-3.5 w-3.5 mr-1.5" />
                  Export
                </DropdownMenuItem>

                {/* Delete Button */}
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

      {/* Duplicate Template Dialog */}
      <EditNameDialog
        open={isDuplicateTemplateDialogOpen}
        onOpenChange={setIsDuplicateTemplateDialogOpen}
        initialName={selectedTemplate ? `${selectedTemplate.name} Copy` : ""}
        onSave={handleCreateDuplicateTemplate}
        title="Duplicate Template"
        description="Enter a name for the duplicated template."
        label="Name"
        placeholder="Template name"
        saveButtonText="Duplicate"
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
