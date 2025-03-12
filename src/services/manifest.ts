import { BaseDirectory, readDir, readTextFile } from "@tauri-apps/plugin-fs";

/**
 * Interface representing a manifest file structure
 */
export interface Manifest {
  id: string;
  name: string;
  description: string;
  website: string;
  type: string;
  inference_type: string[];
  inference_fields: string[];
  engine: string;
  reasoning: {
    enabled: boolean;
    has_budget: boolean;
    has_options: string[];
  };
  fields: {
    key: string;
    description: string;
    required: boolean;
    field_type: string;
    hints?: string[];
  }[];
}

/**
 * Path to the manifests directory relative to the resource directory
 */
const MANIFESTS_PATH = "manifests";

/**
 * Retrieves a list of all available manifest files
 * @returns Promise with an array of manifest filenames
 */
export async function getManifestsList(): Promise<string[]> {
  try {
    const entries = await readDir(MANIFESTS_PATH, {
      baseDir: BaseDirectory.Resource,
    });
    return entries
      .filter((entry) => entry.name && entry.name.endsWith(".json"))
      .map((entry) => entry.name as string);
  } catch (error) {
    console.error("Failed to read manifests directory:", error);
    throw new Error(
      `Failed to read manifests directory: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Reads and parses a specific manifest file
 * @param filename - The name of the manifest file to read
 * @returns Promise with the parsed manifest data
 */
export async function getManifest(filename: string): Promise<Manifest> {
  try {
    const filePath = `${MANIFESTS_PATH}/${filename}`;
    const content = await readTextFile(filePath, {
      baseDir: BaseDirectory.Resource,
    });
    return JSON.parse(content) as Manifest;
  } catch (error) {
    console.error(`Failed to read manifest file ${filename}:`, error);
    throw new Error(
      `Failed to read manifest file ${filename}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Reads and parses all available manifest files
 * @returns Promise with an array of all parsed manifests
 */
export async function getAllManifests(): Promise<Manifest[]> {
  try {
    const filenames = await getManifestsList();
    const manifestPromises = filenames.map((filename) => getManifest(filename));
    return await Promise.all(manifestPromises);
  } catch (error) {
    console.error("Failed to read all manifests:", error);
    throw new Error(
      `Failed to read all manifests: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Gets a manifest by its ID
 * @param id - The ID of the manifest to retrieve
 * @returns Promise with the manifest if found, null otherwise
 */
export async function getManifestById(id: string): Promise<Manifest | null> {
  try {
    const manifests = await getAllManifests();
    return manifests.find((manifest) => manifest.id === id) || null;
  } catch (error) {
    console.error(`Failed to find manifest with ID ${id}:`, error);
    throw new Error(
      `Failed to find manifest with ID ${id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
