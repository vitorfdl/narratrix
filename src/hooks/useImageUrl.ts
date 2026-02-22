import { useCallback, useEffect, useRef, useState } from "react";
import { getImageUrl } from "@/services/file-system-service";

/**
 * Hook for loading image URLs from file paths via Tauri's asset protocol.
 *
 * With `convertFileSrc` the URL construction is near-instant (no file I/O),
 * so a module-level cache is unnecessary — the browser caches asset:// responses.
 * A `version` counter is used for cache-busting on explicit reloads.
 */
export function useImageUrl(imagePath: string | null | undefined) {
  const [url, setUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!imagePath) {
      setUrl("");
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getImageUrl(imagePath, version || undefined)
      .then((imageUrl) => {
        if (!cancelled) {
          setUrl(imageUrl);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load image URL:", err);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imagePath, version]);

  const reload = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  return { url, isLoading, error, reload };
}

/**
 * Hook for loading multiple image URLs in parallel via Tauri's asset protocol.
 *
 * @param items - Array of objects that have an image path property
 * @param pathGetter - Function to extract the image path from an item
 * @param keyGetter - Function to extract a unique key from an item
 */
export function useMultipleImageUrls<T>(items: T[], pathGetter: (item: T) => string | null | undefined, keyGetter: (item: T) => string) {
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [version, setVersion] = useState(0);
  const loadIdRef = useRef(0);

  useEffect(() => {
    const currentLoadId = ++loadIdRef.current;

    if (!items.length) {
      setUrlMap({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const promises = items.map(async (item) => {
      const path = pathGetter(item);
      const key = keyGetter(item);
      if (!path) {
        return { key, url: "" };
      }
      try {
        const url = await getImageUrl(path, version || undefined);
        return { key, url };
      } catch (error) {
        console.error(`Failed to load image for ${key}:`, error);
        return { key, url: "" };
      }
    });

    Promise.all(promises).then((results) => {
      if (currentLoadId !== loadIdRef.current) {
        return;
      }
      const newUrlMap: Record<string, string> = {};
      for (const { key, url } of results) {
        newUrlMap[key] = url;
      }
      setUrlMap(newUrlMap);
      setIsLoading(false);
    });
  }, [items, pathGetter, keyGetter, version]);

  const reloadAll = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  return { urlMap, isLoading, reloadAll };
}
