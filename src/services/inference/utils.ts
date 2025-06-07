import { Howl } from "howler";

// Cache Howl instances by sound name to ensure reliable playback across platforms
const beepHowlCache: Record<string, Howl> = {};

/**
 * Play a beep sound notification
 */
export function playBeepSound(beepSound: string): void {
  if (beepSound === "none" || !beepSound) {
    return;
  }

  const soundPath = `/sounds/${beepSound}.mp3`;

  try {
    // Reuse Howl instance if available, otherwise create and cache it
    let beep = beepHowlCache[beepSound];
    if (!beep) {
      beep = new Howl({
        src: [soundPath],
        volume: 0.5,
      });
      beepHowlCache[beepSound] = beep;
    }
    // Stop and play to ensure the sound always plays from the start
    beep.stop();
    beep.play();
  } catch (error) {
    // Log error for debugging
    console.error("Failed to play beep sound:", error);
  }
}

/**
 * Create an optimized debounced update function using requestAnimationFrame for better performance
 */
export const createDebouncedUpdate = () => {
  let rafId: number | null = null;
  let timeoutId: number | null = null;
  let pendingUpdate: (() => void) | null = null;
  let lastUpdateTime = 0;
  const MIN_UPDATE_INTERVAL = 16; // ~60fps

  return (updateFn: () => void, delay = 50) => {
    pendingUpdate = updateFn;
    const now = performance.now();

    // Cancel previous timeout and RAF
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    // If enough time has passed since last update, use RAF for immediate update
    if (now - lastUpdateTime >= MIN_UPDATE_INTERVAL) {
      rafId = requestAnimationFrame(() => {
        if (pendingUpdate) {
          pendingUpdate();
          lastUpdateTime = performance.now();
          pendingUpdate = null;
        }
        rafId = null;
      });
    } else {
      // Otherwise use timeout for debouncing
      timeoutId = setTimeout(() => {
        rafId = requestAnimationFrame(() => {
          if (pendingUpdate) {
            pendingUpdate();
            lastUpdateTime = performance.now();
            pendingUpdate = null;
          }
          rafId = null;
        });
        timeoutId = null;
      }, delay);
    }
  };
};

/**
 * Create a high-performance batch update function for streaming
 */
export const createBatchedUpdate = () => {
  let rafId: number | null = null;
  const pendingUpdates = new Set<() => void>();

  return (updateFn: () => void) => {
    pendingUpdates.add(updateFn);

    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        // Execute all pending updates in a single frame
        pendingUpdates.forEach((fn) => {
          try {
            fn();
          } catch (error) {
            console.error("Error in batched update:", error);
          }
        });

        pendingUpdates.clear();
        rafId = null;
      });
    }
  };
};

// Create optimized updater instances
export const debouncedMessageUpdate = createDebouncedUpdate();
export const batchedStreamingUpdate = createBatchedUpdate();
