import { CharacterManifest, characterManifestSchema } from "@/schema/character-manifest-schema";
import { Manifest, ManifestSchema } from "@/schema/model-manifest-schema";
import { BaseDirectory, readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

/**
 * Manifest types supported by the service
 */
export type ManifestType = "model" | "character";

/**
 * Path to the manifests directory relative to the resource directory
 */
const MANIFEST_PATHS: Record<ManifestType, string> = {
  model: "resources/manifests/models",
  character: "resources/manifests/characters",
};

/**
 * Schema validators for each manifest type
 */
const MANIFEST_VALIDATORS = {
  model: ManifestSchema,
  character: characterManifestSchema,
};

/**
 * Type definition for generic manifest content based on type
 */
export type ManifestContent<T extends ManifestType> = T extends "model" ? Manifest : T extends "character" ? CharacterManifest : never;

/**
 * Retrieves a list of all available manifest files for a specific type
 * @param type - The type of manifest to retrieve
 * @returns Promise with an array of manifest filenames
 */
export async function getManifestFiles<T extends ManifestType>(type: T): Promise<string[]> {
  try {
    const entries = await readDir(MANIFEST_PATHS[type], {
      baseDir: BaseDirectory.Resource,
    });
    return entries.filter((entry) => entry.name?.endsWith(".jsonc")).map((entry) => entry.name as string);
  } catch (error) {
    console.error(`Failed to read ${type} manifests directory:`, error);
    throw new Error(`Failed to read ${type} manifests directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Reads and parses a specific manifest file
 * @param type - The type of manifest to retrieve
 * @param filename - The name of the manifest file to read
 * @returns Promise with the parsed manifest data
 */
export async function getManifest<T extends ManifestType>(type: T, filename: string): Promise<ManifestContent<T>> {
  try {
    const filePath = `${MANIFEST_PATHS[type]}/${filename}`;
    const content = await readTextFile(filePath, {
      baseDir: BaseDirectory.Resource,
    });
    const parsedData = JSON.parse(content);
    // Validate the data against the schema
    return MANIFEST_VALIDATORS[type].parse(parsedData) as ManifestContent<T>;
  } catch (error) {
    console.error(`Failed to read ${type} manifest file ${filename}:`, error);
    throw new Error(`Failed to read ${type} manifest file ${filename}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Reads and parses all available manifest files of a specific type
 * @param type - The type of manifest to retrieve
 * @returns Promise with an array of all successfully parsed manifests
 */
export async function getAllManifests<T extends ManifestType>(type: T): Promise<ManifestContent<T>[]> {
  try {
    const filenames = await getManifestFiles(type);
    const results = await Promise.allSettled(filenames.map((filename) => getManifest(type, filename)));

    const validManifests: ManifestContent<T>[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        validManifests.push(result.value);
      } else {
        const filename = filenames[index];
        const error = result.reason;
        toast.error(`Failed to load ${type} manifest: ${filename}`, {
          description: error instanceof Error ? error.message : String(error),
        });
        console.error(`Error loading ${type} manifest ${filename}:`, error);
      }
    });

    return validManifests;
  } catch (error) {
    console.error(`Failed to read all ${type} manifests:`, error);
    toast.error(`Failed to load ${type} manifests`, {
      description: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Failed to read all ${type} manifests: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets a manifest by its ID
 * @param type - The type of manifest to retrieve
 * @param id - The ID of the manifest to retrieve
 * @returns Promise with the manifest if found, null otherwise
 */
export async function getManifestById<T extends ManifestType>(type: T, id: string): Promise<ManifestContent<T> | null> {
  try {
    const manifests = await getAllManifests(type);
    return manifests.find((manifest) => manifest.id === id) || null;
  } catch (error) {
    console.error(`Failed to find ${type} manifest with ID ${id}:`, error);
    throw new Error(`Failed to find ${type} manifest with ID ${id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Convenience functions for model manifests
export const getModelManifestFiles = () => getManifestFiles("model");
export const getModelManifest = (filename: string) => getManifest("model", filename);
export const getAllModelManifests = () => getAllManifests("model");
export const getModelManifestById = (id: string) => getManifestById("model", id);

// Convenience functions for character manifests
export const getCharacterManifestFiles = () => getManifestFiles("character");
export const getCharacterManifest = (filename: string) => getManifest("character", filename);
export const getAllCharacterManifests = () => getAllManifests("character");
export const getCharacterManifestById = (id: string) => getManifestById("character", id);
