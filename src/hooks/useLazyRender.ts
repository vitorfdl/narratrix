import { useEffect, useRef, useState } from "react";

/**
 * Returns a ref to attach to a DOM element and a boolean indicating whether
 * that element has ever been near the viewport.
 *
 * Once `hasBeenVisible` flips to `true` it stays `true` permanently, so
 * expensive content rendered on first visibility is never torn down when the
 * user scrolls away.
 *
 * @param rootMargin - Extra margin around the viewport used by IntersectionObserver.
 *   A generous value (e.g. "300px") pre-renders content slightly before it
 *   scrolls into view, preventing a visible blank flash.
 */
export function useLazyRender<T extends HTMLElement>(rootMargin = "300px 0px") {
  const ref = useRef<T>(null);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    // Already visible from a previous render cycle -- no observer needed
    if (hasBeenVisible) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasBeenVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [hasBeenVisible, rootMargin]);

  return { ref, hasBeenVisible };
}
