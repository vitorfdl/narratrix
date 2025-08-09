import { useCallback, useEffect, useState } from "react";
import { getImageUrl } from "@/services/file-system-service";

// Module-level in-memory cache for image data URLs
const imageUrlCache: Map<string, string> = new Map();

/**
 * Hook for efficiently loading and caching image URLs from file paths
 *
 * @param imagePath - The path to the image (relative to appData, absolute path, URL, or data URL)
 * @returns An object containing the image URL and loading state
 */
export function useImageUrl(imagePath: string | null | undefined) {
  const [url, setUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Function to load the image URL, using cache if available
  const loadImageUrl = useCallback(async (path: string) => {
    if (!path) {
      setUrl("");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      // Check cache first
      if (imageUrlCache.has(path)) {
        setUrl(imageUrlCache.get(path)!);
        return;
      }
      const imageUrl = await getImageUrl(path);
      imageUrlCache.set(path, imageUrl);
      setUrl(imageUrl);
    } catch (err) {
      console.error("Failed to load image URL:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load the image URL when the path changes
  useEffect(() => {
    if (imagePath) {
      loadImageUrl(imagePath);
    } else {
      setUrl("");
      setIsLoading(false);
      setError(null);
    }
  }, [imagePath, loadImageUrl]);

  // Function to reload the image URL (bypassing cache)
  const reload = useCallback(() => {
    if (imagePath) {
      imageUrlCache.delete(imagePath);
      loadImageUrl(imagePath);
    }
  }, [imagePath, loadImageUrl]);

  return { url, isLoading, error, reload };
}

/**
 * Hook for efficiently loading and caching multiple image URLs
 *
 * @param items - Array of objects that have an image path property
 * @param pathGetter - Function to extract the image path from an item
 * @param keyGetter - Function to extract a unique key from an item
 * @returns An object containing a map of keys to image URLs and loading state
 */
export function useMultipleImageUrls<T>(items: T[], pathGetter: (item: T) => string | null | undefined, keyGetter: (item: T) => string) {
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load all image URLs when the items change
  useEffect(() => {
    const loadAllImages = async () => {
      if (!items.length) {
        setUrlMap({});
        return;
      }

      setIsLoading(true);
      const newUrlMap: Record<string, string> = {};

      try {
        // Process all items in parallel for better performance
        const promises = items.map(async (item) => {
          const path = pathGetter(item);
          const key = keyGetter(item);

          if (path) {
            try {
              // Check cache first
              if (imageUrlCache.has(path)) {
                return { key, url: imageUrlCache.get(path)! };
              }
              const url = await getImageUrl(path);
              imageUrlCache.set(path, url);
              return { key, url };
            } catch (error) {
              console.error(`Failed to load image for ${key}:`, error);
              return { key, url: "" };
            }
          }
          return { key, url: "" };
        });

        const results = await Promise.all(promises);

        // Populate the URL map with the results
        results.forEach(({ key, url }) => {
          newUrlMap[key] = url;
        });

        setUrlMap(newUrlMap);
      } catch (error) {
        console.error("Failed to load multiple images:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllImages();
  }, [items, pathGetter, keyGetter]);

  // Function to reload all image URLs (bypassing cache)
  const reloadAll = useCallback(async () => {
    if (items.length) {
      setIsLoading(true);
      const newUrlMap: Record<string, string> = {};

      try {
        const promises = items.map(async (item) => {
          const path = pathGetter(item);
          const key = keyGetter(item);

          if (path) {
            try {
              imageUrlCache.delete(path); // Invalidate cache for this path
              const url = await getImageUrl(path);
              imageUrlCache.set(path, url);
              return { key, url };
            } catch (error) {
              console.error(`Failed to load image for ${key}:`, error);
              return { key, url: "" };
            }
          }
          return { key, url: "" };
        });

        const results = await Promise.all(promises);
        results.forEach(({ key, url }) => {
          newUrlMap[key] = url;
        });

        setUrlMap(newUrlMap);
      } catch (error) {
        console.error("Failed to reload multiple images:", error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [items, pathGetter, keyGetter]);

  return { urlMap, isLoading, reloadAll };
}
