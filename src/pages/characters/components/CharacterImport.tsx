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
import { useCurrentProfile } from "@/hooks/ProfileStore";
import { useChatActions } from "@/hooks/chatStore";
import { Character } from "@/schema/characters-schema";
import { saveImage } from "@/services/file-system-service";
import { extractCharacterSpecV2FromPng } from "@/services/imports/formats/character_spec_png";
import { importCharacter, parseCharacterContent, validateAndTransformCharacterData } from "@/services/imports/import-character";
import { basename } from "@tauri-apps/api/path";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { Upload } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";

interface CharacterImportProps {
  onImportComplete?: (character: Character, chatFields?: any) => void;
  className?: string;
}

export interface CharacterImportHandle {
  handleImport: (filePaths: string | string[]) => Promise<void>;
}

export const CharacterImport = forwardRef<CharacterImportHandle, CharacterImportProps>(({ onImportComplete, className = "" }, ref) => {
  const currentProfile = useCurrentProfile();
  const { fetchChatList } = useChatActions();
  const [isImporting, setIsImporting] = useState(false);
  const isImportingRef = useRef(false); // Synchronous import guard
  const importingFileRef = useRef<string | null>(null);
  const importTimeoutRef = useRef<number | null>(null);
  const [chatConfirm, setChatConfirm] = useState<{
    show: boolean;
    chatFields: any;
    characterData: any;
    validationResult: any;
    filePath: string;
  }>({ show: false, chatFields: null, characterData: null, validationResult: null, filePath: "" });
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);

  // Main import logic
  const processImport = useCallback(
    async (filePath: string, validationResult: any, force = false) => {
      if (!currentProfile?.id) {
        return false;
      }
      try {
        // If chatFields are present, ask user if they want to create a chat
        if (validationResult.chatFields && !force) {
          setChatConfirm({
            show: true,
            chatFields: validationResult.chatFields,
            characterData: validationResult.data,
            validationResult,
            filePath,
          });
          setIsImporting(false); // Also reset importing state here
          return true; // Indicate that chat confirm dialog was shown
        }
        // Import the character
        const importedCharacter = await importCharacter(validationResult.data);
        toast.success("Character imported successfully", {
          description: `${importedCharacter.name} (Format: ${validationResult.format}) has been imported.`,
        });
        if (onImportComplete) {
          onImportComplete(importedCharacter, validationResult.chatFields);
        }
      } catch (error) {
        console.error("Import error:", error);
        let description = "An unexpected error occurred during import.";
        if (error instanceof Error) {
          description = error.message;
        }
        toast.error(`Import failed for ${await basename(filePath)}`, { description });
      } finally {
        if (importTimeoutRef.current) {
          window.clearTimeout(importTimeoutRef.current);
        }
        importTimeoutRef.current = window.setTimeout(() => {
          importingFileRef.current = null;
        }, 1000);
      }
      return false;
    },
    [currentProfile, onImportComplete],
  );

  // Handles the actual import, including file type detection (JSON, PNG)
  const handleImport = useCallback(
    async (filePaths: string | string[]) => {
      const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
      if (!currentProfile?.id) {
        toast.error("No profile selected", { description: "Please select a profile before importing." });
        return;
      }
      if (isImportingRef.current) {
        return;
      }
      isImportingRef.current = true;
      setIsImporting(true);
      setImportProgress({ current: 0, total: paths.length });
      let successCount = 0;
      let failCount = 0;
      for (let i = 0; i < paths.length; i++) {
        const filePath = paths[i];
        setImportProgress({ current: i + 1, total: paths.length });
        let fileName = "Unknown File";
        try {
          fileName = await basename(filePath);
          const isPng = fileName.toLowerCase().endsWith(".png");
          const isJson = fileName.toLowerCase().endsWith(".json");
          let validationResult: any = null;
          if (isPng) {
            const fileContentBinary = await readFile(filePath);
            let parsedData: any;
            try {
              parsedData = extractCharacterSpecV2FromPng(fileContentBinary);
            } catch (err) {
              toast.error("PNG does not contain valid character metadata", { description: err instanceof Error ? err.message : String(err) });
              failCount++;
              continue;
            }
            validationResult = validateAndTransformCharacterData(parsedData, currentProfile.id);
            const blob = new Blob([fileContentBinary], { type: "image/png" });
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            const avatarPath = await saveImage(dataUrl, validationResult.data.name, "characters");
            validationResult.data.avatar_path = avatarPath;
          } else if (isJson) {
            const fileContentBinary = await readFile(filePath);
            const decoder = new TextDecoder("utf-8");
            const fileContentString = decoder.decode(fileContentBinary);
            const parsedData = parseCharacterContent(fileContentString);
            validationResult = validateAndTransformCharacterData(parsedData, currentProfile.id);
          } else {
            toast.error("Invalid file type", { description: "Please select a JSON or PNG file (.json, .png)" });
            failCount++;
            continue;
          }

          if (!validationResult.valid || !validationResult.data) {
            toast.error("Invalid character file", {
              description: `Format: ${validationResult.format}. Errors: ${validationResult.errors.join("; ")}`,
            });
            failCount++;
            continue;
          }
          // If chatFields are present, show dialog and pause batch import until user responds
          if (validationResult.chatFields) {
            setChatConfirm({
              show: true,
              chatFields: validationResult.chatFields,
              characterData: validationResult.data,
              validationResult,
              filePath,
            });
            // Store remaining files and exit loop
            setPendingFiles(paths.slice(i + 1));
            isImportingRef.current = false;
            setImportProgress(null);
            return;
          }
          await processImport(filePath, validationResult, true);
          successCount++;
        } catch (error) {
          console.error("Import error:", error);
          let description = "An unexpected error occurred during import.";
          if (error instanceof Error) {
            description = error.message;
          }
          toast.error(`Import failed for ${fileName}`, { description });
          failCount++;
        }
      }
      setIsImporting(false);
      isImportingRef.current = false;
      setImportProgress(null);
      setPendingFiles([]);
      if (successCount > 0) {
        toast.success(`Imported ${successCount} character${successCount > 1 ? "s" : ""} successfully.`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} file${failCount > 1 ? "s" : ""} failed to import.`);
      }
    },
    [currentProfile, processImport],
  );

  // Resume batch import after chat dialog is handled
  useEffect(() => {
    if (!chatConfirm.show && pendingFiles.length > 0) {
      handleImport(pendingFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatConfirm.show]);

  // Expose the handleImport method via ref
  useImperativeHandle(ref, () => ({
    handleImport,
  }));

  // --- Click-to-Browse Functionality ---
  const handleBrowseClick = useCallback(async () => {
    if (isImporting) {
      return;
    }
    try {
      const selectedPath = await openDialog({
        multiple: true,
        directory: false,
        filters: [{ name: "Character Files", extensions: ["json", "png"] }],
      });
      if (selectedPath && Array.isArray(selectedPath) && selectedPath.length > 0) {
        await handleImport(selectedPath);
      } else if (selectedPath && typeof selectedPath === "string") {
        await handleImport(selectedPath);
      }
    } catch (error) {
      console.error("Error opening file dialog:", error);
      toast.error("Could not open file dialog", { description: error instanceof Error ? error.message : undefined });
    }
  }, [handleImport, isImporting]);

  return (
    <div className={`relative ${className}`}>
      <div
        className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center transition-colors duration-200 min-h-[120px] ${
          isImporting ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${
          isImporting
            ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background"
            : "border-border bg-card hover:bg-accent/50 hover:border-accent-foreground/50"
        }`}
        onClick={handleBrowseClick}
        role="button"
        tabIndex={isImporting ? -1 : 0}
        aria-label="Import Character area"
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isImporting) {
            handleBrowseClick();
          }
        }}
      >
        <Upload className={`h-8 w-8 mb-2 transition-colors duration-200 ${isImporting ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
        <p className="font-medium text-center mb-1 text-foreground">{isImporting ? "Importing..." : "Import Character"}</p>
        <p className="text-sm text-muted-foreground text-center">Drag & drop one or more character JSON/PNG files or click to browse</p>
        <p className="text-xs text-muted-foreground/80 text-center mt-1">(Supports Internal, V2, V3, PNG formats)</p>
        {importProgress && (
          <p className="text-xs text-primary mt-2">
            Importing {importProgress.current} of {importProgress.total}...
          </p>
        )}
      </div>
      {isImporting && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg backdrop-blur-sm z-10">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2" />
            <p className="text-sm font-medium text-foreground">Importing...</p>
          </div>
        </div>
      )}
      <AlertDialog open={chatConfirm.show} onOpenChange={(open) => !open && setChatConfirm((prev) => ({ ...prev, show: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chat Data Detected</AlertDialogTitle>
            <AlertDialogDescription>
              This character file contains chat-related fields (greetings, scenario, etc). Do you want to create a chat for this character as well?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={async () => {
                setChatConfirm((prev) => ({ ...prev, show: false }));
                // Proceed with import but skip chatFields
                const importedCharacter = await importCharacter(chatConfirm.characterData);
                toast.success("Character imported successfully", {
                  description: `${importedCharacter.name} (Format: ${chatConfirm.validationResult.format}) has been imported.`,
                });
                if (onImportComplete) {
                  onImportComplete(importedCharacter);
                }
                // Resume batch import if needed
                // (Batch resume handled by useEffect)
              }}
            >
              Skip Chat
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setChatConfirm((prev) => ({ ...prev, show: false }));
                // Proceed with import and pass chatFields to parent
                const importedCharacter = await importCharacter(chatConfirm.characterData, chatConfirm.chatFields);
                fetchChatList(currentProfile!.id);
                toast.success("Character imported successfully", {
                  description: `${importedCharacter.name} (Format: ${chatConfirm.validationResult.format}) has been imported.`,
                });
                if (onImportComplete) {
                  onImportComplete(importedCharacter, chatConfirm.chatFields);
                }
                // Resume batch import if needed
                // (Batch resume handled by useEffect)
              }}
            >
              Import Character & Chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
