import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useProfile } from "@/hooks/ProfileContext";
import { useCharacterActions, useCharacterById } from "@/hooks/characterStore";
import { useMultipleImageUrls } from "@/hooks/useImageUrl";
import { cn } from "@/lib/utils";
import { Character, Expression } from "@/schema/characters-schema";
import { saveExpressionImage } from "@/services/file-system-service";
import { appDataDir, basename, join } from "@tauri-apps/api/path";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readFile, remove } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { Edit, Folder, Plus, RefreshCw, Trash2 } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useState } from "react";
// Helper function to convert binary array to data URL
function binaryToDataUrl(binaryData: Uint8Array, mimeType: string): string {
  let binaryString = "";
  for (let i = 0; i < binaryData.length; i++) {
    binaryString += String.fromCharCode(binaryData[i]);
  }
  const base64 = btoa(binaryString);
  return `data:${mimeType};base64,${base64}`;
}

// Helper to get mime type from file extension
function getMimeType(filePath: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase() || "";
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream"; // Fallback
  }
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
  const { currentProfile } = useProfile();
  // Memoize getter functions for useMultipleImageUrls
  const getExpressionPath = useCallback((expression: Expression) => expression.image_path, []);
  const getExpressionId = useCallback((expression: Expression) => expression.id, []);

  // Use our custom hook to efficiently load all expression images
  const {
    urlMap: expressionUrls,
    isLoading,
    reloadAll,
  } = useMultipleImageUrls(
    expressions ?? [], // Provide default empty array
    getExpressionPath, // Use memoized function
    getExpressionId, // Use memoized function
  );

  // --- Drag and Drop Event Listener (Tauri v2) ---
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      const currentWindow = getCurrentWebviewWindow();
      // Listen to the window's drag-drop events
      unlisten = await currentWindow.onDragDropEvent(async (event) => {
        // Check payload type and access paths directly
        if (event.payload.type === "drop" && Array.isArray(event.payload.paths)) {
          if (!character) {
            return; // Need character context
          }

          setIsProcessingDrop(true);
          const droppedFilePaths = event.payload.paths; // Access paths directly
          const currentExpressions = [...(expressions ?? [])];
          let needsUpdate = false;

          // Map to track new expressions to be created - using Map to prevent duplicates
          const newExpressionsMap = new Map<
            string,
            {
              fileName: string;
              dataUrl: string;
              id: string;
            }
          >();

          try {
            // First pass - process all files and categorize them
            for (const filePath of droppedFilePaths) {
              try {
                const fileNameWithExt = await basename(filePath);
                const fileExtMatch = fileNameWithExt.match(/\.(\w+)$/);
                const fileExt = fileExtMatch ? fileExtMatch[1].toLowerCase() : "";
                const fileName = fileNameWithExt.replace(/\.\w+$/, "");

                // Skip non-image files based on extension
                if (!["png", "jpg", "jpeg", "webp"].includes(fileExt)) {
                  continue;
                }

                const lowerCaseFileName = fileName.toLowerCase();

                // Check if expression exists (case-insensitive)
                const existingExpressionIndex = currentExpressions.findIndex((exp) => exp.name.toLowerCase() === lowerCaseFileName);

                // --- Read file content (common step) ---
                const fileContent = await readFile(filePath);
                const mimeType = getMimeType(filePath);
                const dataUrl = binaryToDataUrl(fileContent, mimeType);
                // -----------------------------------------

                if (existingExpressionIndex !== -1) {
                  // Update existing expression
                  const expressionToUpdate = currentExpressions[existingExpressionIndex];
                  console.log(`Updating existing expression: ${expressionToUpdate.name}`);
                  const savedPath = await saveExpressionImage(dataUrl, expressionToUpdate.name, character_id);
                  currentExpressions[existingExpressionIndex] = { ...expressionToUpdate, image_path: savedPath };
                  needsUpdate = true;
                } else if (!newExpressionsMap.has(lowerCaseFileName)) {
                  // Only add to the map if not already present (prevents duplicates)
                  const newExpressionId = nanoid();
                  newExpressionsMap.set(lowerCaseFileName, {
                    fileName,
                    dataUrl,
                    id: newExpressionId,
                  });
                }
              } catch (fileProcessingError) {
                console.error(`Error processing dropped file ${filePath}:`, fileProcessingError);
                // Optionally inform user about the specific file error
              }
            }

            // Convert map to array for processing
            const newExpressionsToCreate = Array.from(newExpressionsMap.values());

            // If we have new expressions to create, show a single confirmation dialog
            if (newExpressionsToCreate.length > 0) {
              const expressionNames = newExpressionsToCreate.map((item) => item.fileName).join("\n• ");
              const confirmMessage = `Create ${newExpressionsToCreate.length} new expressions?\n\n• ${expressionNames}`;
              const confirmed = await confirm(confirmMessage);

              if (!confirmed) {
                return;
              }
              // Process all confirmed new expressions
              for (const { fileName, dataUrl, id } of newExpressionsToCreate) {
                const savedPath = await saveExpressionImage(dataUrl, fileName, character_id);
                const newExpression: Expression = {
                  id,
                  name: fileName,
                  image_path: savedPath,
                };
                currentExpressions.push(newExpression);
                needsUpdate = true;
              }
            }

            // Perform batch update if changes were made
            if (needsUpdate) {
              await updateCharacter(currentProfile!.id, character_id, { expressions: currentExpressions });
            }
          } catch (error) {
            console.error("Error handling file drop:", error);
          } finally {
            setIsProcessingDrop(false);
          }
        }
      });
    };

    setupListener();

    // Cleanup listener on unmount
    return () => {
      unlisten?.();
    };
  }, [character_id, expressions, updateCharacter, character]); // Add dependencies
  // -------------------------------------

  const onRefresh = () => {
    reloadAll();
  };

  const onOpenFolder = async () => {
    try {
      const appDataDirPath = await appDataDir();
      // Corrected path based on file-system-service.ts
      const expressionsFolderPath = await join(appDataDirPath, "images", "characters", character_id);

      console.log(`Attempting to open folder: ${expressionsFolderPath}`);
      await openPath(expressionsFolderPath);
    } catch (error) {
      console.error("Failed to open expressions folder:", error);
      // TODO: Show user-friendly error message
    }
  };

  const onEdit = async (expressionToEdit: Expression) => {
    try {
      // 1. Open file dialog to select a new image
      const selectedPath = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });

      if (!selectedPath || typeof selectedPath !== "string") {
        console.log("No new image selected or dialog cancelled.");
        return;
      }

      // Optional: Prompt to rename (Skipping for now, focusing on image replace)
      // const newName = prompt("Enter new name (leave blank to keep current):", expressionToEdit.name);
      // const finalName = newName?.trim() || expressionToEdit.name;

      // 2. Read the selected file content
      const fileContent = await readFile(selectedPath);
      const mimeType = getMimeType(selectedPath);
      const dataUrl = binaryToDataUrl(fileContent, mimeType);

      // 3. Save the new image, overwriting the old one using the same expression ID
      const savedPath = await saveExpressionImage(dataUrl, expressionToEdit.id, character_id);

      // 4. Update character state
      const updatedExpressions = (expressions ?? []).map((exp) => {
        if (exp.id === expressionToEdit.id) {
          return { ...exp, image_path: savedPath /*, name: finalName */ };
        }
        return exp;
      });

      await updateCharacter(currentProfile!.id, character_id, { expressions: updatedExpressions });

      // 5. Refresh the image URLs - Removed explicit reloadAll, useEffect should handle it
      // await reloadAll();
    } catch (error) {
      console.error("Failed to edit expression:", error);
      // TODO: Show user-friendly error message
    }
  };

  const onDelete = async (expressionToDelete: Expression) => {
    // Optional: Add confirmation dialog here
    if (!confirm(`Are you sure you want to delete the expression "${expressionToDelete.name}"?`)) {
      return;
    }

    try {
      // 1. Update character state by filtering out the expression
      const updatedExpressions = (expressions ?? []).filter((exp) => exp.id !== expressionToDelete.id);
      await updateCharacter(currentProfile!.id, character_id, { expressions: updatedExpressions });

      // 2. Attempt to delete the associated image file
      if (expressionToDelete.image_path) {
        try {
          const appData = await appDataDir();
          const filePath = await join(appData, expressionToDelete.image_path);
          await remove(filePath);
          console.log(`Deleted expression image: ${filePath}`);
          // Removed explicit reloadAll - state update should trigger useEffect in useMultipleImageUrls
          // reloadAll();
        } catch (fileError) {
          // Log error but don't block the state update if file deletion fails
          console.error(`Failed to delete expression image file (${expressionToDelete.image_path}):`, fileError);
        }
      }
      // No need to call reloadAll - state update triggers re-render
    } catch (error) {
      console.error("Failed to delete expression:", error);
      // TODO: Show user-friendly error message
    }
  };

  const onAdd = async () => {
    try {
      // 1. Open file dialog to select an image
      const selectedPath = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });

      if (!selectedPath || typeof selectedPath !== "string") {
        console.log("No image selected or dialog cancelled.");
        return;
      }

      // 2. Prompt for expression name (simple prompt for now)
      const expressionName = prompt("Enter a name for the new expression:", "new_expression");
      if (!expressionName) {
        console.log("Expression name cancelled.");
        return;
      }

      // 3. Read the selected file content
      const fileContent = await readFile(selectedPath);
      const mimeType = getMimeType(selectedPath);
      const dataUrl = binaryToDataUrl(fileContent, mimeType);

      // 4. Create new expression object (initially without path)
      const newExpressionId = nanoid();
      const newExpression: Expression = {
        id: newExpressionId,
        name: expressionName,
        image_path: null, // Will be set after saving
      };

      // 5. Save the image using the file service
      const savedPath = await saveExpressionImage(dataUrl, newExpression.id, character_id);
      newExpression.image_path = savedPath; // Set the correct relative path

      // 6. Update character state
      const updatedExpressions = [...(expressions ?? []), newExpression];
      await updateCharacter(currentProfile!.id, character_id, { expressions: updatedExpressions });

      // 7. Optionally refresh the view or rely on state update
      reloadAll(); // Refresh to attempt loading the new image
    } catch (error) {
      console.error("Failed to add expression:", error);
      // TODO: Show user-friendly error message
    }
  };

  const onDeleteAll = async () => {
    // Confirm the action with the user
    const confirmed = await confirm("Are you sure you want to delete all expressions? This action cannot be undone.");

    if (!confirmed) {
      return;
    }

    try {
      // 1. Delete all associated image files (optional)
      if (expressions && expressions.length > 0) {
        const appData = await appDataDir();
        for (const expression of expressions) {
          if (expression.image_path) {
            try {
              const filePath = await join(appData, expression.image_path);
              await remove(filePath);
              console.log(`Deleted expression image: ${filePath}`);
            } catch (fileError) {
              console.error(`Failed to delete expression image file (${expression.image_path}):`, fileError);
            }
          }
        }
      }

      // 2. Update character state to remove all expressions
      await updateCharacter(currentProfile!.id, character_id, { expressions: [] });

      // 3. Refresh the view
      reloadAll();
    } catch (error) {
      console.error("Failed to delete all expressions:", error);
      // TODO: Show user-friendly error message
    }
  };

  return (
    <Card className="overflow-hidden bg-gradient-to-b from-card/50 to-card border-none shadow-xl">
      <div className="p-1 space-y-1">
        {/* Processing Dialog using shadcn UI */}
        <Dialog open={isProcessingDrop} modal>
          <DialogContent className="sm:max-w-md">
            <div className="flex flex-col items-center justify-center gap-3 py-4">
              <RefreshCw className="h-8 w-8 text-primary animate-spin" />
              <p className="text-lg font-semibold">Processing dropped files...</p>
              <p className="text-sm text-muted-foreground">Please wait while we process your files</p>
            </div>
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
