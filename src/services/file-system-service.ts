import { appDataDir, join, sep } from "@tauri-apps/api/path";
import { BaseDirectory, exists, mkdir, readFile, remove, writeFile } from "@tauri-apps/plugin-fs";

/**
 * Constants for file system paths and directories
 */
const PROFILES_DIR = "profiles";
const IMAGES_DIR = "images";
const AVATAR_PREFIX = "avatar_";
const CHARACTERS_DIR = "characters";

/**
 * Convert a data URL to a binary array
 * @param dataUrl - The data URL to convert
 * @returns Binary array of the image data
 */
function dataUrlToBinary(dataUrl: string): Uint8Array {
  // Extract the base64 part of the data URL
  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    throw new Error("Invalid data URL format");
  }

  // Convert base64 to binary
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

/**
 * Extract the file extension from a data URL
 * @param dataUrl - The data URL
 * @returns The file extension (jpg, png, etc.)
 */
function getExtensionFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/data:image\/(\w+);base64/);
  return match ? match[1] : "jpg"; // Default to jpg if no match
}

/**
 * Ensure the required directories exist
 */
async function ensureDirectories(): Promise<void> {
  const appData = await appDataDir();

  // Ensure profiles directory exists
  const profilesPath = await join(appData, PROFILES_DIR);
  const profilesDirExists = await exists(profilesPath, { baseDir: BaseDirectory.AppData });

  if (!profilesDirExists) {
    await mkdir(profilesPath, { baseDir: BaseDirectory.AppData, recursive: true });
  }

  // Ensure images directory exists
  const imagesPath = await join(appData, IMAGES_DIR);
  const imagesDirExists = await exists(imagesPath, { baseDir: BaseDirectory.AppData });

  if (!imagesDirExists) {
    await mkdir(imagesPath, { baseDir: BaseDirectory.AppData, recursive: true });
  }
}

/**
 * Save an avatar image from a data URL to the app data directory
 * @param dataUrl - The image data URL or path URL
 * @param nameID - The ID to use in the filename
 * @returns The path to the saved image
 */
export async function saveAvatarImage(dataUrl: string, nameID: string): Promise<string> {
  // If dataUrl is already a path URL (not a data URL), return it as is
  if (!dataUrl.startsWith("data:")) {
    return dataUrl;
  }

  await ensureDirectories();

  const imageId = `${AVATAR_PREFIX}${nameID}`;
  const extension = getExtensionFromDataUrl(dataUrl);
  const fileName = `${imageId}.${extension}`;

  const appData = await appDataDir();
  const filePath = await join(appData, PROFILES_DIR, fileName);

  // Convert data URL to binary data
  const binaryData = dataUrlToBinary(dataUrl);

  // Write the file
  await writeFile(filePath, binaryData, { baseDir: BaseDirectory.AppData });

  // Return the relative path for storing in the database
  const separator = await sep();
  return `${PROFILES_DIR}${separator}${fileName}`;
}

/**
 * Read an image file from app data directory and convert to data URL
 * @param relativePath - The relative path to the image (from appData)
 * @returns The image as a data URL
 */
export async function readImageAsDataUrl(relativePath: string): Promise<string> {
  try {
    // For backward compatibility - handle both full paths and relative paths
    const isRelative = !relativePath.includes(":");

    // If it's a relative path, join with appDataDir
    let path = relativePath;
    if (isRelative) {
      const appData = await appDataDir();
      path = await join(appData, relativePath);
    }

    // Get file extension
    const extension = relativePath.split(".").pop() || "jpg";
    const mimeType = `image/${extension}`;

    // Read binary data
    const data = await readFile(path, { baseDir: BaseDirectory.AppData });

    // Convert to base64
    let binary = "";
    const bytes = new Uint8Array(data);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // Return as data URL
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error("Error reading image file:", error);
    throw new Error(`Failed to read image: ${error}`);
  }
}

/**
 * Save a general image to the app data directory
 * @param dataUrl - The image data URL
 * @param subDirectory - Optional subdirectory within images/ to save to
 * @returns The path to the saved image
 */
export async function saveImage(dataUrl: string, nameID: string, subDirectory?: string): Promise<string> {
  // If dataUrl is already a path URL (not a data URL), return it as is
  if (!dataUrl.startsWith("data:")) {
    return dataUrl;
  }
  await ensureDirectories();

  const imageId = `${nameID}`;
  const extension = getExtensionFromDataUrl(dataUrl);
  const fileName = `${imageId}.${extension}`;

  const appData = await appDataDir();
  let directory = IMAGES_DIR;

  // If subdirectory is specified, make sure it exists
  if (subDirectory) {
    directory = await join(IMAGES_DIR, subDirectory);
    const subDirPath = await join(appData, directory);
    const subDirExists = await exists(subDirPath, { baseDir: BaseDirectory.AppData });

    if (!subDirExists) {
      await mkdir(subDirPath, { baseDir: BaseDirectory.AppData, recursive: true });
    }
  }

  const filePath = await join(appData, directory, fileName);

  // Convert data URL to binary data
  const binaryData = dataUrlToBinary(dataUrl);

  // Write the file
  await writeFile(filePath, binaryData, { baseDir: BaseDirectory.AppData, create: true });

  // Return the relative path for storing in the database
  const separator = await sep();
  return `${directory}${separator}${fileName}`;
}

/**
 * Save an expression image to the app data directory
 * @param dataUrl - The image data URL
 * @param nameID - The ID to use in the filename
 * @param characterId - The ID of the character
 * @returns The path to the saved expression image
 */
export async function saveExpressionImage(dataUrl: string, nameID: string, characterId: string): Promise<string> {
  if (!dataUrl.startsWith("data:")) {
    return dataUrl;
  }

  await ensureDirectories();

  const extension = getExtensionFromDataUrl(dataUrl);
  const fileName = `${nameID}.${extension}`;
  const appData = await appDataDir();

  // Construct the character-specific directory path
  const characterImageDir = await join(IMAGES_DIR, CHARACTERS_DIR, characterId);
  const fullDirPath = await join(appData, characterImageDir);

  // Ensure the character-specific directory exists
  const dirExists = await exists(fullDirPath, { baseDir: BaseDirectory.AppData });
  if (!dirExists) {
    await mkdir(fullDirPath, { baseDir: BaseDirectory.AppData, recursive: true });
  }

  const filePath = await join(fullDirPath, fileName);

  // Convert data URL to binary data
  const binaryData = dataUrlToBinary(dataUrl);

  // Write the file
  await writeFile(filePath, binaryData, { baseDir: BaseDirectory.AppData, create: true });

  // Return the relative path for storing in the database
  const separator = await sep();
  return `${characterImageDir}${separator}${fileName}`;
}

/**
 * Utility to determine the type of image source
 * @param source - Image source that could be a URL, data URL, or file path
 * @returns The type of image source
 */
export function getImageSourceType(source: string): "url" | "data-url" | "file-path" | "empty" {
  if (!source) {
    return "empty";
  }

  if (source.startsWith("data:image/")) {
    return "data-url";
  }

  if (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("asset://") || source.startsWith("file://")) {
    return "url";
  }

  return "file-path";
}

/**
 * Get a properly formatted URL for an image that can be used directly in <img> tags
 * This now uses readImageAsDataUrl for local files to ensure cache invalidation.
 *
 * @param imagePath - The path to the image (relative to appData, absolute, URL, or data URL)
 * @returns A URL (likely a data: URL for local files) that can be used in an img src attribute
 */
export async function getImageUrl(imagePath: string): Promise<string> {
  try {
    if (!imagePath) {
      return "";
    }

    // If it's already a URL or data URL, return it as is
    const sourceType = getImageSourceType(imagePath);
    if (sourceType === "url" || sourceType === "data-url") {
      return imagePath;
    }

    // For file paths, read the image as a data URL to bypass caching
    if (sourceType === "file-path") {
      return await readImageAsDataUrl(imagePath);
    }

    // Fallback or handle unexpected types if necessary, though should be covered
    console.warn("Unexpected image path type in getImageUrl:", imagePath);
    return ""; // Return empty string for unhandled cases
  } catch (error) {
    console.error("Error creating image URL:", error);
    return "";
  }
}

/**
 * Remove a file from the app data directory.
 * @param relativePath - The relative path to the file (from app data root)
 */
export async function removeFile(relativePath: string): Promise<void> {
  try {
    const appData = await appDataDir();
    const filePath = await join(appData, relativePath);
    await remove(filePath);
    console.info(`File deleted: ${filePath}`);
  } catch (error) {
    console.error(`Failed to delete file (${relativePath}):`, error);
    throw new Error(`Failed to delete file: ${relativePath}`);
  }
}

/**
 * Remove a directory and all its contents recursively from the app data directory.
 * @param relativeDirPath - The relative path to the directory (from app data root)
 */
export async function removeDirectoryRecursive(relativeDirPath: string): Promise<void> {
  try {
    const appData = await appDataDir();
    const dirPath = await join(appData, relativeDirPath);
    await remove(dirPath, { recursive: true });
    console.info(`Directory deleted recursively: ${dirPath}`);
  } catch (error) {
    console.error(`Failed to delete directory (${relativeDirPath}):`, error);
    throw new Error(`Failed to delete directory: ${relativeDirPath}`);
  }
}
