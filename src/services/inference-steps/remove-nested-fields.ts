/**
 * Removes nested fields from specified keys and places them at the root level
 * @param obj The source object to transform
 * @param keysToFlatten Array of nested field keys to flatten
 * @returns A new object with the specified nested fields moved to the root
 */
export function removeNestedFields<T extends Record<string, any>>(
  obj: T,
  keysToFlatten: string[] = ["dry", "reasoning", "xtc", "smoothing_sampling"],
): Record<string, any> {
  const result = { ...obj };

  for (const key of keysToFlatten) {
    if (obj[key] && typeof obj[key] === "object") {
      // Copy all properties from the nested object to the root
      Object.assign(result, obj[key]);
      // Remove the original nested field
      delete result[key];
    }
  }

  return result;
}
