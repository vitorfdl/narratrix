import { basename, join } from "@tauri-apps/api/path";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open as openDialog, confirm as tauriConfirm } from "@tauri-apps/plugin-dialog";
import { readFile, remove } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { Edit, Folder, Plus, RefreshCw, Trash2 } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shared/Dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCharacterActions, useCharacterById } from "@/hooks/characterStore";
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useMultipleImageUrls } from "@/hooks/useImageUrl";
import { cn } from "@/lib/utils";
import type { Character, Expression } from "@/schema/characters-schema";
import { getAppDataDir, saveExpressionImageFromBinary } from "@/services/file-system-service";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const IMAGE_FILTERS = [{ name: "Images", extensions: IMAGE_EXTENSIONS }];

function getFileExtension(filePath: string): string {
  return filePath.split(".").pop()?.toLowerCase() || "";
}

interface ExpressionPackPreviewProps {
  character_id: string;
  expressions: Expression[];
}

export function ExpressionPackPreview({ character_id }: ExpressionPackPreviewProps) {
  const { updateCharacter } = useCharacterActions();
  const character = useCharacterById(character_id) as Character | undefined;
  const expressions = character?.expressions;
  const [isProcessingDrop, setIsProcessingDrop] = useState(false);
  const currentProfile = useCurrentProfile();

  // Prompt dialog state (replaces native prompt())
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [promptValue, setPromptValue] = useState("new_expression");
  const promptResolveRef = useRef<((value: string | null) => void) | null>(null);

  // Stable refs so the drag-drop effect doesn't re-subscribe on every expressions change
  const expressionsRef = useRef(expressions);
  expressionsRef.current = expressions;
  const characterRef = useRef(character);
  characterRef.current = character;

  const getExpressionPath = useCallback((expression: Expression) => expression.image_path, []);
  const getExpressionId = useCallback((expression: Expression) => expression.id, []);

  const { urlMap: expressionUrls, isLoading, reloadAll } = useMultipleImageUrls(expressions ?? [], getExpressionPath, getExpressionId);

  /** Opens the controlled prompt dialog and returns user input (or null if cancelled). */
  const showPromptDialog = useCallback((defaultValue = "new_expression"): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(defaultValue);
      promptResolveRef.current = resolve;
      setPromptDialogOpen(true);
    });
  }, []);

  const handlePromptConfirm = useCallback(() => {
    const trimmed = promptValue.trim();
    promptResolveRef.current?.(trimmed || null);
    promptResolveRef.current = null;
    setPromptDialogOpen(false);
  }, [promptValue]);

  const handlePromptCancel = useCallback(() => {
    promptResolveRef.current?.(null);
    promptResolveRef.current = null;
    setPromptDialogOpen(false);
  }, []);

  // --- Drag and Drop Event Listener (Tauri v2) ---
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      const currentWindow = getCurrentWebviewWindow();
      unlisten = await currentWindow.onDragDropEvent(async (event) => {
        if (event.payload.type !== "drop" || !Array.isArray(event.payload.paths)) {
          return;
        }
        if (!characterRef.current) {
          return;
        }

        setIsProcessingDrop(true);
        const droppedFilePaths = event.payload.paths;
        const currentExpressions = [...(expressionsRef.current ?? [])];
        let needsUpdate = false;

        const newExpressionsMap = new Map<string, { fileName: string; data: Uint8Array; ext: string; id: string }>();

        try {
          for (const filePath of droppedFilePaths) {
            try {
              const fileNameWithExt = await basename(filePath);
              const fileExt = getFileExtension(fileNameWithExt);
              const fileName = fileNameWithExt.replace(/\.\w+$/, "");

              if (!IMAGE_EXTENSIONS.includes(fileExt)) {
                continue;
              }

              const lowerCaseFileName = fileName.toLowerCase();
              const existingExpressionIndex = currentExpressions.findIndex((exp) => exp.name.toLowerCase() === lowerCaseFileName);

              const fileContent = await readFile(filePath);

              if (existingExpressionIndex !== -1) {
                const expressionToUpdate = currentExpressions[existingExpressionIndex];
                const savedPath = await saveExpressionImageFromBinary(fileContent, fileExt, expressionToUpdate.name, character_id);
                currentExpressions[existingExpressionIndex] = { ...expressionToUpdate, image_path: savedPath };
                needsUpdate = true;
              } else if (!newExpressionsMap.has(lowerCaseFileName)) {
                newExpressionsMap.set(lowerCaseFileName, {
                  fileName,
                  data: fileContent,
                  ext: fileExt,
                  id: nanoid(),
                });
              }
            } catch (fileProcessingError) {
              console.error(`Error processing dropped file ${filePath}:`, fileProcessingError);
              toast.error(`Failed to process file: ${filePath}`);
            }
          }

          const newExpressionsToCreate = Array.from(newExpressionsMap.values());

          if (newExpressionsToCreate.length > 0) {
            const expressionNames = newExpressionsToCreate.map((item) => item.fileName).join("\n- ");
            const confirmed = await tauriConfirm(`Create ${newExpressionsToCreate.length} new expression(s)?\n\n- ${expressionNames}`, {
              title: "Add Expressions",
              kind: "info",
            });

            if (!confirmed) {
              return;
            }

            for (const { fileName, data, ext, id } of newExpressionsToCreate) {
              const savedPath = await saveExpressionImageFromBinary(data, ext, fileName, character_id);
              currentExpressions.push({ id, name: fileName, image_path: savedPath });
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            await updateCharacter(currentProfile!.id, character_id, { expressions: currentExpressions });
          }
        } catch (error) {
          console.error("Error handling file drop:", error);
          toast.error(`Failed to process dropped files: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
          setIsProcessingDrop(false);
        }
      });
    };

    setupListener();

    return () => {
      unlisten?.();
    };
  }, [character_id, updateCharacter, currentProfile]);

  const onRefresh = () => {
    reloadAll();
  };

  const onOpenFolder = async () => {
    try {
      const appData = await getAppDataDir();
      const expressionsFolderPath = await join(appData, "images", "characters", character_id);
      await openPath(expressionsFolderPath);
    } catch (error) {
      console.error("Failed to open expressions folder:", error);
      toast.error("Failed to open expressions folder");
    }
  };

  const onEdit = async (expressionToEdit: Expression) => {
    try {
      const selectedPath = await openDialog({
        multiple: false,
        directory: false,
        filters: IMAGE_FILTERS,
      });

      if (!selectedPath || typeof selectedPath !== "string") {
        return;
      }

      const fileContent = await readFile(selectedPath);
      const ext = getFileExtension(selectedPath);
      const savedPath = await saveExpressionImageFromBinary(fileContent, ext, expressionToEdit.id, character_id);

      const updatedExpressions = (expressions ?? []).map((exp) => {
        if (exp.id === expressionToEdit.id) {
          return { ...exp, image_path: savedPath };
        }
        return exp;
      });

      await updateCharacter(currentProfile!.id, character_id, { expressions: updatedExpressions });
      reloadAll();
    } catch (error) {
      console.error("Failed to edit expression:", error);
      toast.error(`Failed to edit expression: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const onDelete = async (expressionToDelete: Expression) => {
    const confirmed = await tauriConfirm(`Are you sure you want to delete the expression "${expressionToDelete.name}"?`, {
      title: "Delete Expression",
      kind: "warning",
    });
    if (!confirmed) {
      return;
    }

    try {
      const updatedExpressions = (expressions ?? []).filter((exp) => exp.id !== expressionToDelete.id);
      await updateCharacter(currentProfile!.id, character_id, { expressions: updatedExpressions });

      if (expressionToDelete.image_path) {
        try {
          const appData = await getAppDataDir();
          const filePath = await join(appData, expressionToDelete.image_path);
          await remove(filePath);
        } catch (fileError) {
          console.error(`Failed to delete expression image file (${expressionToDelete.image_path}):`, fileError);
        }
      }
    } catch (error) {
      console.error("Failed to delete expression:", error);
      toast.error(`Failed to delete expression: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const onAdd = async () => {
    try {
      const selectedPath = await openDialog({
        multiple: false,
        directory: false,
        filters: IMAGE_FILTERS,
      });

      if (!selectedPath || typeof selectedPath !== "string") {
        return;
      }

      const expressionName = await showPromptDialog("new_expression");
      if (!expressionName) {
        return;
      }

      const fileContent = await readFile(selectedPath);
      const ext = getFileExtension(selectedPath);
      const newExpressionId = nanoid();
      const savedPath = await saveExpressionImageFromBinary(fileContent, ext, newExpressionId, character_id);

      const newExpression: Expression = {
        id: newExpressionId,
        name: expressionName,
        image_path: savedPath,
      };

      const updatedExpressions = [...(expressions ?? []), newExpression];
      await updateCharacter(currentProfile!.id, character_id, { expressions: updatedExpressions });
      reloadAll();
    } catch (error) {
      console.error("Failed to add expression:", error);
      toast.error(`Failed to add expression: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const onDeleteAll = async () => {
    const confirmed = await tauriConfirm("Are you sure you want to delete all expressions? This action cannot be undone.", {
      title: "Delete All Expressions",
      kind: "warning",
    });
    if (!confirmed) {
      return;
    }

    try {
      if (expressions && expressions.length > 0) {
        const appData = await getAppDataDir();
        for (const expression of expressions) {
          if (expression.image_path) {
            try {
              const filePath = await join(appData, expression.image_path);
              await remove(filePath);
            } catch (fileError) {
              console.error(`Failed to delete expression image file (${expression.image_path}):`, fileError);
            }
          }
        }
      }

      await updateCharacter(currentProfile!.id, character_id, { expressions: [] });
      reloadAll();
    } catch (error) {
      console.error("Failed to delete all expressions:", error);
      toast.error(`Failed to delete all expressions: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <Card className="overflow-hidden bg-gradient-to-b from-card/50 to-card border-none shadow-xl">
      <div className="p-1 space-y-1">
        {/* Processing Dialog */}
        <Dialog open={isProcessingDrop}>
          <DialogContent className="sm:max-w-md">
            <div className="flex flex-col items-center justify-center gap-3 py-4">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
              <p className="text-lg font-semibold">Processing dropped files...</p>
              <p className="text-sm text-muted-foreground">Please wait while we process your files</p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Expression Name Prompt Dialog */}
        <Dialog
          open={promptDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              handlePromptCancel();
            }
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>New Expression</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="expression-name">Expression Name</Label>
              <Input
                id="expression-name"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePromptConfirm();
                  }
                }}
                placeholder="e.g. happy, sad, angry"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={handlePromptCancel}>
                Cancel
              </Button>
              <Button onClick={handlePromptConfirm} disabled={!promptValue.trim()}>
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-card/50 rounded-full p-1 backdrop-blur-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  onRefresh();
                }}
                className="h-8 rounded-full hover:bg-white/10 transition-colors flex items-center gap-1"
                title="Refresh expressions"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-primary" : ""}`} />
                <span className="text-xs">Refresh</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenFolder();
                }}
                className="h-8 rounded hover:bg-white/10 transition-colors flex items-center gap-1"
                title="Open expressions folder"
              >
                <Folder className="h-4 w-4" />
                <span className="text-xs">Open Folder</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  onDeleteAll();
                }}
                className="h-8 rounded hover:bg-destructive/80 transition-colors flex items-center gap-1"
                title="Delete all expressions"
              >
                <Trash2 className="h-4 w-4" />
                <span className="text-xs">Delete All</span>
              </Button>
            </div>
          </div>
          <div className="px-3 py-1 rounded bg-card/50 backdrop-blur-sm">
            <span className="text-sm font-medium text-muted-foreground">{(expressions ?? []).length} expressions</span>
          </div>
        </div>

        {/* Grid Section */}
        {!isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
            {(expressions ?? []).map((expression) => (
              <Card
                key={expression.id}
                className="group relative aspect-square overflow-hidden border-none bg-card/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:ring-1 hover:ring-primary/20"
              >
                {expressionUrls[expression.id] ? (
                  <img
                    src={expressionUrls[expression.id]}
                    alt={expression.name}
                    className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='18' x='3' y='3' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='9' cy='9' r='2'%3E%3C/circle%3E%3Cpath d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'%3E%3C/path%3E%3C/svg%3E";
                      e.currentTarget.classList.add("p-6", "opacity-30");
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted/30">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="40%"
                      height="40%"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="opacity-30"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3">
                  <p className="text-sm font-medium text-white">{expression.name}</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 backdrop-blur-sm transition-all duration-150 group-hover:opacity-100">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault();
                      onEdit(expression);
                    }}
                    className="h-9 w-9 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault();
                      onDelete(expression);
                    }}
                    className="h-9 w-9 rounded-full border border-white/20 bg-white/10 hover:bg-destructive/80 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
            <Card
              onClick={onAdd}
              className={cn(
                "flex aspect-square cursor-pointer items-center justify-center",
                "border-2 border-dashed border-muted transition-colors hover:border-primary/50",
                "bg-card/50 hover:bg-card group",
              )}
            >
              <Plus className="h-8 w-8 text-muted-foreground transition-colors group-hover:text-primary" />
            </Card>
          </div>
        )}
      </div>
    </Card>
  );
}
