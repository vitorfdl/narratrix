import Fuse, { type IFuseOptions } from "fuse.js";

/**
 * Finds the closest match for a search term within a list of options using fuzzy search.
 *
 * @param searchTerm The string to search for (e.g., LLM output).
 * @param optionsList The array of strings to search within (e.g., available expressions).
 * @param defaultValue The value to return if no suitable match is found.
 * @param threshold Optional fuse.js search threshold (0.0 requires a perfect match, 1.0 matches anything).
 * Defaults to 0.4, allowing some flexibility.
 * @returns The closest matching string from optionsList or the defaultValue.
 */
export function findClosestExpressionMatch(searchTerm: string, optionsList: string[], defaultValue = "neutral", threshold = 0.4): string {
  if (!optionsList || optionsList.length === 0) {
    return defaultValue;
  }

  // Basic Fuse configuration - search directly on the string array
  const fuseOptions: IFuseOptions<string> = {
    includeScore: true,
    threshold: threshold,
    isCaseSensitive: false,
    // No keys needed when searching an array of strings
  };

  const fuse = new Fuse(optionsList, fuseOptions);
  const results = fuse.search(searchTerm.trim().toLowerCase());

  // Return the best match if found, otherwise the default
  if (results.length > 0 && results[0].item) {
    return results[0].item;
  }

  return defaultValue;
}
