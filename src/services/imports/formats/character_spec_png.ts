import PNGtext from "png-chunk-text";
import extractChunks from "png-chunks-extract";
import { CharaCardV2 } from "./character_spec_v2";

/**
 * PNG chunk type constants
 */
const METADATA_KEYWORDS = ["ccv3", "chara"];

/**
 * Helper: base64 to Uint8Array (for proper UTF-8 decoding)
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Extracts embedded character data from PNG tEXt chunks using png-chunks-extract and png-chunk-text.
 * Supports both chara_card_v2 format and internal character format.
 * @param pngBuffer - The PNG file as ArrayBuffer or Uint8Array
 * @returns The parsed character JSON object (either CharaCardV2 or internal format)
 * @throws If no valid metadata is found or parsing fails
 */
export function extractCharacterSpecV2FromPng(pngBuffer: ArrayBuffer | Uint8Array): any {
  const buffer = pngBuffer instanceof Uint8Array ? pngBuffer : new Uint8Array(pngBuffer);
  const chunks = extractChunks(buffer);

  for (const chunk of chunks) {
    if (chunk.name === "tEXt") {
      const text = PNGtext.decode(chunk.data);
      if (METADATA_KEYWORDS.includes(text.keyword)) {
        try {
          const bytes = base64ToUint8Array(text.text);
          const jsonStr = new TextDecoder("utf-8").decode(bytes);
          const json = JSON.parse(jsonStr);

          // Check for chara_card_v2/v3 format
          if (json && (json.spec === "chara_card_v2" || json.spec === "chara_card_v3")) {
            return json as CharaCardV2;
          }

          // Check for internal character format
          if (json && json.export_type === "character") {
            return json;
          }

          // If it's any other valid JSON, return it for further validation
          if (json && typeof json === "object") {
            return json;
          }

          throw new Error("Decoded JSON is not a valid character format");
        } catch (err) {
          throw new Error(`Failed to decode or parse embedded character data: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }
  throw new Error("No embedded character metadata found in PNG");
}

/**
 * Checks if a PNG contains embedded character metadata.
 * @param pngBuffer - The PNG file as ArrayBuffer or Uint8Array
 * @returns True if metadata is present, false otherwise
 */
export function hasCharacterSpecV2InPng(pngBuffer: ArrayBuffer | Uint8Array): boolean {
  try {
    extractCharacterSpecV2FromPng(pngBuffer);
    return true;
  } catch {
    return false;
  }
}
