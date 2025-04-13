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
import { useProfile } from "@/hooks/ProfileContext";
import { useLorebookStoreActions, useLorebooks } from "@/hooks/lorebookStore";
import { Lorebook } from "@/schema/lorebook-schema";
import { importLorebook, parseLorebookContent, validateAndTransformLorebookData } from "@/services/lorebook-import-service";
import { basename } from "@tauri-apps/api/path";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { Upload } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";

interface LorebookImportProps {
  onImportComplete?: (lorebook: Lorebook) => void;
  className?: string;
}

// Add an imperative handle type
export interface LorebookImportHandle {
  handleImport: (filePath: string) => Promise<void>;
}

export const LorebookImport = forwardRef<LorebookImportHandle, LorebookImportProps>(({ onImportComplete, className = "" }, ref) => {
  const { currentProfile } = useProfile();
  const { loadLorebooks } = useLorebookStoreActions();
  const lorebooks = useLorebooks();
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importingFileRef = useRef<string | null>(null);
  const importTimeoutRef = useRef<number | null>(null);
  const [duplicateConfirm, setDuplicateConfirm] = useState<{
    show: boolean;
    name: string;
    filePath: string;
    validationResult: any;
  }>({ show: false, name: "", filePath: "", validationResult: null });

  const processImport = useCallback(
    async (filePath: string, validationResult: any, force = false) => {
      if (!currentProfile?.id) {
        return;
      }

      try {
        // Check for duplicate name if not forcing import
        if (!force) {
          const lorebookName = validationResult.data.name;
          const duplicate = lorebooks.find((book) => book.name.toLowerCase() === lorebookName.toLowerCase());

          if (duplicate) {
            setDuplicateConfirm({
              show: true,
              name: lorebookName,
              filePath,
              validationResult,
            });
            return;
          }
        }

        // Import the lorebook
        const importedLorebook = await importLorebook(validationResult.data, currentProfile.id);

        // Refresh the lorebook list
        await loadLorebooks(currentProfile.id);

        toast.success("Lorebook imported successfully", {
          description: `${importedLorebook.name} (Format: ${validationResult.format}) has been imported with ${validationResult.data.entries?.length || 0} entries.`,
        });

        // Callback for parent component
        if (onImportComplete) {
          onImportComplete(importedLorebook);
        }
      } catch (error) {
        console.error("Import error:", error);
        let description = "An unexpected error occurred during import.";
        if (error instanceof Error) {
          description = error.message;
        }
        toast.error(`Import failed for ${await basename(filePath)}`, { description });
      } finally {
        setIsImporting(false);
        if (importTimeoutRef.current) {
          window.clearTimeout(importTimeoutRef.current);
        }
        importTimeoutRef.current = window.setTimeout(() => {
          importingFileRef.current = null;
        }, 1000);
      }
    },
    [currentProfile, loadLorebooks, lorebooks, onImportComplete],
  );

  const handleImport = useCallback(
    async (filePath: string) => {
      // Prevent duplicate imports of the same file in quick succession
      if (isImporting || importingFileRef.current === filePath) {
        return;
      }

      if (!currentProfile?.id) {
        toast.error("No profile selected", { description: "Please select a profile before importing." });
        return;
      }

      // Set the current file being imported
      importingFileRef.current = filePath;
      setIsImporting(true);
      let fileName = "Unknown File"; // Default filename

      try {
        fileName = await basename(filePath);

        // Check file type extension
        if (!fileName.toLowerCase().endsWith(".json")) {
          toast.error("Invalid file type", {
            description: "Please select a JSON file (.json)",
          });
          setIsImporting(false);
          return;
        }

        // Read the file content
        const fileContentBinary = await readFile(filePath);
        const decoder = new TextDecoder("utf-8");
        const fileContentString = decoder.decode(fileContentBinary);

        // Parse the file content (can throw)
        const parsedData = parseLorebookContent(fileContentString);

        // Validate the file content and transform if necessary
        const validationResult = validateAndTransformLorebookData(parsedData, fileName);

        if (!validationResult.valid || !validationResult.data) {
          toast.error("Invalid lorebook file", {
            description: `Format: ${validationResult.format}. Errors: ${validationResult.errors.join("; ")}`,
          });
          setIsImporting(false);
          return;
        }

        // Process the import (with duplicate check)
        await processImport(filePath, validationResult);
      } catch (error) {
        console.error("Import error:", error);
        // Improved error reporting
        let description = "An unexpected error occurred during import.";
        if (error instanceof Error) {
          // Include parsing errors or other specific messages
          description = error.message;
        }
        toast.error(`Import failed for ${fileName}`, { description });
        setIsImporting(false);
      }
    },
    [currentProfile, processImport, isImporting],
  );

  // Expose the handleImport method via ref
  useImperativeHandle(ref, () => ({
    handleImport,
  }));

  // --- Tauri Drag and Drop Event Listener ---
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      const currentWindow = getCurrentWebviewWindow();
      try {
        unlisten = await currentWindow.onDragDropEvent(async (event) => {
          if (event.payload.type === "drop" && Array.isArray(event.payload.paths)) {
            setIsDragging(false);
            // Handle only the first dropped file for simplicity
            if (event.payload.paths.length > 0 && !isImporting) {
              const filePath = event.payload.paths[0];
              await handleImport(filePath);
            }
          } else if (event.payload.type === "enter" || event.payload.type === "over") {
            setIsDragging(true);
          } else if (event.payload.type === "leave") {
            setIsDragging(false);
          }
        });
      } catch (e) {
        console.error("Failed to set up drag and drop listener:", e);
        toast.error("Drag and drop setup failed", { description: "Could not initialize drag and drop functionality." });
      }
    };

    setupListener();

    // Cleanup function
    return () => {
      if (unlisten) {
        try {
          unlisten();
        } catch (e) {
          console.warn("Failed to unlisten drag and drop event:", e);
        }
      }

      if (importTimeoutRef.current) {
        window.clearTimeout(importTimeoutRef.current);
      }
    };
  }, [handleImport]);

  // --- Click-to-Browse Functionality ---
  const handleBrowseClick = useCallback(async () => {
    // Prevent opening dialog if already importing
    if (isImporting) {
      return;
    }

    try {
      const selectedPath = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "Lorebook JSON", extensions: ["json"] }],
      });

      if (selectedPath && typeof selectedPath === "string") {
        await handleImport(selectedPath);
      }
      // Handle cases where the user cancels the dialog (selectedPath is null or array) - no action needed.
    } catch (error) {
      console.error("Error opening file dialog:", error);
      toast.error("Could not open file dialog", { description: error instanceof Error ? error.message : undefined });
    }
  }, [handleImport, isImporting]);
  // -------------------------------------

  return (
    <div className={`relative ${className}`}>
      <div
        className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center transition-colors duration-200 min-h-[120px] ${
          isImporting ? "cursor-not-allowed opacity-60" : "cursor-pointer" // Disable interaction during import
        } ${
          isDragging
            ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background" // Enhanced dragging visual
            : "border-border bg-card hover:bg-accent/50 hover:border-accent-foreground/50" // Use card/accent colors
        }`}
        onClick={handleBrowseClick} // Click handler remains
        role="button" // Add role for accessibility
        tabIndex={isImporting ? -1 : 0} // Make it focusable unless importing
        aria-label="Import Lorebook area"
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isImporting) {
            handleBrowseClick();
          }
        }} // Keyboard accessibility
      >
        <Upload className={`h-8 w-8 mb-2 transition-colors duration-200 ${isDragging ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
        <p className="font-medium text-center mb-1 text-foreground">{isDragging ? "Drop to import" : "Import Lorebook"}</p>
        <p className="text-sm text-muted-foreground text-center">Drag & drop a lorebook JSON file or click to browse</p>
        <p className="text-xs text-muted-foreground/80 text-center mt-1">(Supports V1 and V2 formats)</p> {/* Added format info */}
      </div>
      {isImporting && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg backdrop-blur-sm z-10">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2" />
            <p className="text-sm font-medium text-foreground">Importing...</p>
          </div>
        </div>
      )}

      <AlertDialog open={duplicateConfirm.show} onOpenChange={(open) => !open && setDuplicateConfirm((prev) => ({ ...prev, show: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Lorebook Name</AlertDialogTitle>
            <AlertDialogDescription>
              A lorebook named "{duplicateConfirm.name}" already exists. Do you want to import this lorebook anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                processImport(duplicateConfirm.filePath, duplicateConfirm.validationResult, true);
                setDuplicateConfirm((prev) => ({ ...prev, show: false }));
              }}
            >
              Import Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
