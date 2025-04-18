import { getImageSourceType } from "@/services/file-system-service";

/**
 * Downloads an image from a remote URL and converts it to a data URL (base64 encoded).
 * @param url - The image URL (must be http/https)
 * @returns Promise resolving to a data URL string
 * @throws Error if the fetch or conversion fails
 */
export async function fetchImageAsDataUrl(url: string): Promise<string> {
  if (getImageSourceType(url) !== "url") {
    throw new Error("Provided string is not a valid URL.");
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to convert image blob to data URL."));
        }
      };
      reader.onerror = () => reject(new Error("FileReader error while converting image to data URL."));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    throw new Error(`Error downloading or converting image: ${error instanceof Error ? error.message : String(error)}`);
  }
}
