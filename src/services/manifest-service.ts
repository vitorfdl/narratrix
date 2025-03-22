import { Manifest, ManifestSchema } from "@/schema/manifest-schema";
import { BaseDirectory, readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

/**
 * Path to the manifests directory relative to the resource directory
 */
const MANIFESTS_PATH = "resources/manifests";

/**
 * Retrieves a list of all available manifest files
 * @returns Promise with an array of manifest filenames
 */
export async function getManifestFiles(): Promise<string[]> {
  try {
    const entries = await readDir(MANIFESTS_PATH, {
      baseDir: BaseDirectory.Resource,
    });
    return entries.filter((entry) => entry.name?.endsWith(".jsonc")).map((entry) => entry.name as string);
  } catch (error) {
    console.error("Failed to read manifests directory:", error);
    throw new Error(`Failed to read manifests directory: ${error instanceof Error ? error.message : String(error)}`);
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
    const parsedData = JSON.parse(content);
    // Validate the data against the schema
    return ManifestSchema.parse(parsedData);
  } catch (error) {
    console.error(`Failed to read manifest file ${filename}:`, error);
    throw new Error(`Failed to read manifest file ${filename}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Reads and parses all available manifest files
 * @returns Promise with an array of all successfully parsed manifests
 */
export async function getAllManifests(): Promise<Manifest[]> {
  try {
    const filenames = await getManifestFiles();
    const results = await Promise.allSettled(filenames.map((filename) => getManifest(filename)));

    const validManifests: Manifest[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        validManifests.push(result.value);
      } else {
        const filename = filenames[index];
        const error = result.reason;
        toast.error(`Failed to load manifest: ${filename}`, {
          description: error instanceof Error ? error.message : String(error),
        });
        console.error(`Error loading manifest ${filename}:`, error);
      }
    });

    return validManifests;
  } catch (error) {
    console.error("Failed to read all manifests:", error);
    toast.error("Failed to load manifests", {
      description: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Failed to read all manifests: ${error instanceof Error ? error.message : String(error)}`);
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
    throw new Error(`Failed to find manifest with ID ${id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
