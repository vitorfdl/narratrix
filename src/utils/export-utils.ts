import { getVersion } from "@tauri-apps/api/app";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

export type ExportType = "chat_template" | "format_template" | "instruction_template" | "lorebook" | "character";

/**
 * Export data to a JSON file with metadata
 *
 * @param data - The data to export (object or array)
 * @param exportType - The type of export (e.g., "chat_template", "format_template", etc.)
 * @param defaultFileName - Default filename for the export (without extension)
 * @returns Promise<boolean> - Returns true if export was successful, false otherwise
 */
export async function exportToJsonFile<T = any>(data: T, exportType: ExportType, defaultFileName = "export"): Promise<boolean> {
  try {
    // Get the app version
    const appVersion = await getVersion();

    const exportData = {
      export_type: exportType,
      ...data,
      app_version: appVersion,
    };

    // Open save dialog
    const filePath = await saveDialog({
      defaultPath: `${defaultFileName}.json`,
      filters: [
        {
          name: "JSON Files",
          extensions: ["json"],
        },
      ],
    });

    // If user cancelled the dialog
    if (!filePath) {
      return false;
    }

    // Convert to JSON string with proper formatting
    const jsonContent = JSON.stringify(exportData, null, 2);

    // Write the file with explicit UTF-8 encoding
    const encoder = new TextEncoder(); // TextEncoder defaults to UTF-8
    await writeFile(filePath, encoder.encode(jsonContent));

    // Show success toast
    toast.success("Export successful", {
      description: `Data exported to ${filePath.split(/[/\\]/).pop()}`,
    });

    return true;
  } catch (error) {
    console.error("Export failed:", error);

    // Show error toast
    toast.error("Export failed", {
      description: error instanceof Error ? error.message : "An unexpected error occurred during export.",
    });

    return false;
  }
}

/**
 * Export a single item
 *
 * @param item - Single item to export
 * @param exportType - The type of export
 * @param defaultFileName - Default filename for the export
 * @returns Promise<boolean> - Returns true if export was successful
 */
export async function exportSingleToJsonFile<T = any>(item: T, exportType: ExportType, defaultFileName = "export"): Promise<boolean> {
  return exportToJsonFile(item, exportType, defaultFileName);
}
