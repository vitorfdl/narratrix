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
import { useLorebookStoreActions, useLorebooks } from "@/hooks/lorebookStore";
import { Lorebook } from "@/schema/lorebook-schema";
import { importLorebook, parseLorebookContent, validateAndTransformLorebookData } from "@/services/imports/import-lorebook";
import { basename } from "@tauri-apps/api/path";
import { readFile } from "@tauri-apps/plugin-fs";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";

interface LorebookImportProps {
  onImportComplete?: (lorebook: Lorebook) => void;
  className?: string;
}

// Add an imperative handle type
export interface LorebookImportHandle {
  handleImport: (filePath: string) => Promise<void>;
}

export const LorebookImport = forwardRef<LorebookImportHandle, LorebookImportProps>(({ onImportComplete }, ref) => {
  const currentProfile = useCurrentProfile();
  const { loadLorebooks } = useLorebookStoreActions();
  const lorebooks = useLorebooks();
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
        const lorebookName = validationResult.data.name;
        if (!force) {
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
        const importedLorebook = await importLorebook(validationResult.data, currentProfile.id);
        await loadLorebooks(currentProfile.id);
        toast.success("Lorebook imported successfully", {
          description: `${importedLorebook.name} (Format: ${validationResult.format}) has been imported with ${validationResult.data.entries?.length || 0} entries.`,
        });
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
      if (isImporting || importingFileRef.current === filePath) {
        return;
      }
      if (!currentProfile?.id) {
        toast.error("No profile selected", { description: "Please select a profile before importing." });
        return;
      }
      importingFileRef.current = filePath;
      setIsImporting(true);
      let fileName = "Unknown File";
      try {
        fileName = await basename(filePath);
        if (!fileName.toLowerCase().endsWith(".json")) {
          toast.error("Invalid file type", {
            description: "Please select a JSON file (.json)",
          });
          setIsImporting(false);
          return;
        }
        const fileContentBinary = await readFile(filePath);
        const decoder = new TextDecoder("utf-8");
        const fileContentString = decoder.decode(fileContentBinary);
        const parsedData = parseLorebookContent(fileContentString);
        const validationResult = validateAndTransformLorebookData(parsedData, fileName);
        if (!validationResult.valid || !validationResult.data) {
          toast.error("Invalid lorebook file", {
            description: `Format: ${validationResult.format}. Errors: ${validationResult.errors.join("; ")}`,
          });
          setIsImporting(false);
          return;
        }
        await processImport(filePath, validationResult);
      } catch (error) {
        console.error("Import error:", error);
        let description = "An unexpected error occurred during import.";
        if (error instanceof Error) {
          description = error.message;
        }
        toast.error(`Import failed for ${fileName}`, { description });
        setIsImporting(false);
      }
    },
    [currentProfile, processImport, isImporting],
  );

  useImperativeHandle(ref, () => ({
    handleImport,
  }));

  // Only render the duplicate dialog if needed
  return (
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
  );
});
