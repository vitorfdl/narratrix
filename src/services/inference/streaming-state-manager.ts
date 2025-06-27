import { useCallback, useRef } from "react";
import { INITIAL_STREAMING_STATE, StreamingState, StreamingStateChangeCallback } from "./types";

/**
 * Shallow comparison for streaming state to prevent unnecessary notifications
 */
const shallowEqual = (obj1: StreamingState, obj2: StreamingState): boolean => {
  const keys1 = Object.keys(obj1) as (keyof StreamingState)[];
  const keys2 = Object.keys(obj2) as (keyof StreamingState)[];

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) {
      return false;
    }
  }

  return true;
};

/**
 * Hook for managing streaming state and notifications
 */
export function useStreamingStateManager() {
  const streamingState = useRef<StreamingState>({ ...INITIAL_STREAMING_STATE });
  const stateChangeCallbacks = useRef<Set<StreamingStateChangeCallback>>(new Set());
  const lastNotifiedState = useRef<StreamingState>({ ...INITIAL_STREAMING_STATE });

  /**
   * Notify all registered callbacks about streaming state changes (optimized with shallow comparison)
   */
  const notifyStateChange = useCallback(() => {
    const currentState = { ...streamingState.current };

    // Only notify if state actually changed
    if (shallowEqual(currentState, lastNotifiedState.current)) {
      return;
    }

    lastNotifiedState.current = currentState;

    stateChangeCallbacks.current.forEach((callback) => {
      try {
        callback(currentState);
      } catch (error) {
        console.error("Error in streaming state change callback:", error);
      }
    });
  }, []);

  /**
   * Subscribe to streaming state changes
   */
  const subscribeToStateChanges = useCallback((callback: StreamingStateChangeCallback) => {
    stateChangeCallbacks.current.add(callback);

    // Return unsubscribe function
    return () => {
      stateChangeCallbacks.current.delete(callback);
    };
  }, []);

  /**
   * Reset the streaming state
   */
  const resetStreamingState = useCallback(() => {
    const previousState = { ...streamingState.current };
    streamingState.current = { ...INITIAL_STREAMING_STATE };

    // Notify all subscribers about the state change
    notifyStateChange();

    return previousState;
  }, [notifyStateChange]);

  /**
   * Update streaming state with optimized change detection
   */
  const updateStreamingState = useCallback(
    (updates: Partial<StreamingState>) => {
      const newState = { ...streamingState.current, ...updates };

      // Only update if something actually changed
      if (!shallowEqual(newState, streamingState.current)) {
        streamingState.current = newState;
        notifyStateChange();
      }
    },
    [notifyStateChange],
  );

  /**
   * Batch update multiple streaming state properties
   */
  const batchUpdateStreamingState = useCallback(
    (updateFn: (currentState: StreamingState) => Partial<StreamingState>) => {
      const updates = updateFn(streamingState.current);
      updateStreamingState(updates);
    },
    [updateStreamingState],
  );

  /**
   * Get the current streaming state (memoized to prevent unnecessary object creation)
   */
  const getStreamingState = useCallback((): StreamingState => {
    return { ...streamingState.current };
  }, []);

  /**
   * Check if currently streaming
   */
  const isStreaming = useCallback((): boolean => {
    return !!(streamingState.current.requestId && streamingState.current.characterId);
  }, []);

  return {
    streamingState,
    subscribeToStateChanges,
    resetStreamingState,
    updateStreamingState,
    batchUpdateStreamingState,
    getStreamingState,
    isStreaming,
    notifyStateChange,
  };
}
