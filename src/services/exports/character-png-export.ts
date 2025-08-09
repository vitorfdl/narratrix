import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import PNGtext from "png-chunk-text";
import encodeChunks from "png-chunks-encode";
import extractChunks from "png-chunks-extract";
import { toast } from "sonner";
import { readImageAsDataUrl } from "@/services/file-system-service";

/**
 * PNG chunk keyword for embedding character data
 */
const METADATA_KEYWORD = "chara";

/**
 * Helper: Uint8Array to base64 (for proper UTF-8 encoding)
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper: Convert data URL to Uint8Array
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    throw new Error("Invalid data URL format");
  }

  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

/**
 * Helper: Convert JPEG data URL to PNG data URL using Canvas
 */
function convertJpegToPng(jpegDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        // Create a canvas with the same dimensions as the image
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;

        // Draw the image onto the canvas
        ctx.drawImage(img, 0, 0);

        // Convert canvas to PNG data URL
        const pngDataUrl = canvas.toDataURL("image/png");
        resolve(pngDataUrl);
      } catch (error) {
        reject(new Error(`Failed to convert JPEG to PNG: ${error instanceof Error ? error.message : String(error)}`));
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image for conversion"));
    };

    img.src = jpegDataUrl;
  });
}

/**
 * Embeds character JSON data into a PNG file using tEXt chunks
 * @param pngBuffer - The original PNG file as Uint8Array
 * @param characterData - The character data to embed (will be wrapped in internal format)
 * @returns The modified PNG file as Uint8Array with embedded character data
 */
export function embedCharacterDataInPng(pngBuffer: Uint8Array, characterData: any): Uint8Array {
  try {
    // Extract existing chunks from the PNG
    const chunks = extractChunks(pngBuffer);

    // Create the character data in internal format (not chara_card_v2)
    const internalCharacterData = {
      export_type: "character",
      ...characterData,
    };

    // Convert character data to JSON string
    const jsonStr = JSON.stringify(internalCharacterData, null, 2);

    // Remove any existing character metadata chunks (chara and ccv3)
    const tEXtChunks = chunks.filter((chunk) => chunk.name === "tEXt");
    for (const tEXtChunk of tEXtChunks) {
      try {
        const decodedText = PNGtext.decode(tEXtChunk.data);
        if (decodedText.keyword.toLowerCase() === "chara" || decodedText.keyword.toLowerCase() === "ccv3") {
          chunks.splice(chunks.indexOf(tEXtChunk), 1);
        }
      } catch {
        // Keep chunks that can't be decoded
      }
    }

    // Encode JSON string as UTF-8 and convert to base64
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const base64Data = uint8ArrayToBase64(jsonBytes);

    // Create and add the new tEXt chunk before IEND (using splice(-1, 0, ...))
    const newChunk = PNGtext.encode(METADATA_KEYWORD, base64Data);
    chunks.splice(-1, 0, newChunk);

    // Encode the chunks back into a PNG buffer
    return new Uint8Array(encodeChunks(chunks));
  } catch (error) {
    throw new Error(`Failed to embed character data in PNG: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Exports a character as a PNG file with embedded JSON data
 * @param characterData - The character data to export
 * @param avatarPath - The path to the character's avatar image
 * @param defaultFileName - Default filename for the export
 * @returns Promise<boolean> - Returns true if export was successful, false otherwise
 */
export async function exportCharacterToPng(characterData: any, avatarPath: string | null, defaultFileName = "character"): Promise<boolean> {
  try {
    if (!avatarPath) {
      toast.error("Export failed", {
        description: "Character must have an avatar image to export as PNG.",
      });
      return false;
    }

    // Read the avatar image as data URL
    const avatarDataUrl = await readImageAsDataUrl(avatarPath);

    // Check if it's a supported image format and convert to PNG if needed
    let finalPngDataUrl: string;

    if (avatarDataUrl.startsWith("data:image/png;base64,")) {
      // Already PNG, use as-is
      finalPngDataUrl = avatarDataUrl;
    } else if (avatarDataUrl.startsWith("data:image/jpeg;base64,") || avatarDataUrl.startsWith("data:image/jpg;base64,")) {
      // Convert JPEG to PNG
      try {
        finalPngDataUrl = await convertJpegToPng(avatarDataUrl);
      } catch (error) {
        toast.error("Export failed", {
          description: `Failed to convert JPEG to PNG: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
        return false;
      }
    } else {
      toast.error("Export failed", {
        description: "Avatar must be a PNG or JPEG image to export as PNG with embedded data.",
      });
      return false;
    }

    // Convert data URL to Uint8Array
    const pngBuffer = dataUrlToUint8Array(finalPngDataUrl);

    // Embed character data into the PNG
    const modifiedPngBuffer = embedCharacterDataInPng(pngBuffer, characterData);

    // Open save dialog
    const filePath = await saveDialog({
      defaultPath: `${defaultFileName}.png`,
      filters: [
        {
          name: "PNG Files",
          extensions: ["png"],
        },
      ],
    });

    // If user cancelled the dialog
    if (!filePath) {
      return false;
    }

    // Write the modified PNG file
    await writeFile(filePath, modifiedPngBuffer);

    // Show success toast
    toast.success("PNG export successful", {
      description: `Character exported to ${filePath.split(/[/\\]/).pop()}`,
    });

    return true;
  } catch (error) {
    console.error("PNG export failed:", error);

    // Show error toast
    toast.error("PNG export failed", {
      description: error instanceof Error ? error.message : "An unexpected error occurred during PNG export.",
    });

    return false;
  }
}
