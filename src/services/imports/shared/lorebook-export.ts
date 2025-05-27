import { getLorebookById } from "@/services/lorebook-service";
import { ExportType, exportSingleToJsonFile } from "@/utils/export-utils";

/**
 * Options for lorebook export
 */
export interface LorebookExportOptions {
  includeLorebooks: boolean;
}

/**
 * Prepares and exports a single lorebook with its entries
 *
 * @param lorebookId - The ID of the lorebook to export
 * @param fileName - Optional custom filename (without extension)
 * @returns Promise<boolean> - Returns true if export was successful
 */
export async function exportLorebook(lorebookId: string, fileName?: string): Promise<boolean> {
  try {
    const lorebook = await getLorebookById(lorebookId, true); // Include entries
    if (!lorebook) {
      throw new Error("Lorebook not found");
    }

    // Prepare the lorebook for export
    const exportedLorebook = structuredClone(lorebook);

    // Clean up the lorebook data for export
    delete exportedLorebook.profile_id;

    // Clean up entries data for export
    if (exportedLorebook.entries) {
      exportedLorebook.entries = exportedLorebook.entries.map((entry) => ({
        ...entry,
        export_type: "lorebook_entry" as ExportType,
        profile_id: undefined,
        id: undefined,
      }));
    }

    // Add export type
    const exportType: ExportType = "lorebook";
    const finalExport = {
      ...exportedLorebook,
      export_type: exportType,
    };

    // Generate filename if not provided
    const defaultFileName = fileName || `lorebook_${lorebook.name.replace(/[^a-zA-Z0-9]/g, "_")}`;

    // Export the lorebook
    return await exportSingleToJsonFile(finalExport, exportType, defaultFileName);
  } catch (error) {
    console.error("Lorebook export error:", error);
    throw error;
  }
}

/**
 * Prepares lorebook data for embedding in other exports (characters, chat templates)
 *
 * @param lorebookId - The ID of the lorebook to prepare
 * @returns Promise<any> - Returns the prepared lorebook data or null if not found
 */
export async function prepareLorebookForEmbedding(lorebookId: string): Promise<any | null> {
  try {
    const lorebook = await getLorebookById(lorebookId, true); // Include entries
    if (!lorebook) {
      return null;
    }

    // Prepare the lorebook for embedding
    const exportType: ExportType = "lorebook";
    const entries = lorebook.entries.map((entry) => ({
      ...entry,
      export_type: exportType,
      profile_id: undefined,
      id: undefined,
    }));

    return {
      ...lorebook,
      entries,
      export_type: exportType,
      profile_id: undefined,
    };
  } catch (error) {
    console.warn(`Failed to prepare lorebook ${lorebookId} for embedding:`, error);
    return null;
  }
}

/**
 * Prepares multiple lorebooks for embedding in exports
 *
 * @param lorebookIds - Array of lorebook IDs to prepare
 * @returns Promise<any[]> - Returns array of prepared lorebook data
 */
export async function prepareLorebooksForEmbedding(lorebookIds: string[]): Promise<any[]> {
  const lorebooks = [];

  for (const lorebookId of lorebookIds) {
    const preparedLorebook = await prepareLorebookForEmbedding(lorebookId);
    if (preparedLorebook) {
      lorebooks.push(preparedLorebook);
    }
  }

  return lorebooks;
}
