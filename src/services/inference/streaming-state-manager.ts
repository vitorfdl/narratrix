import { useCallback, useRef } from "react";
import { INITIAL_STREAMING_STATE, StreamingState, StreamingStateChangeCallback } from "./types";

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

interface Subscription {
  callback: StreamingStateChangeCallback;
  chatId?: string;
}

/**
 * Multi-session streaming state manager.
 * Tracks one StreamingState per chatId with requestId-based routing for callbacks.
 */
export function useStreamingStateManager() {
  const sessions = useRef<Map<string, StreamingState>>(new Map());
  const requestToChatMap = useRef<Map<string, string>>(new Map());
  const subscriptions = useRef<Set<Subscription>>(new Set());
  const lastNotifiedStates = useRef<Map<string, StreamingState>>(new Map());

  const notifyForChat = useCallback((chatId: string) => {
    const session = sessions.current.get(chatId) ?? { ...INITIAL_STREAMING_STATE, chatId };
    const lastState = lastNotifiedStates.current.get(chatId);

    if (lastState && shallowEqual(session, lastState)) {
      return;
    }

    const snapshot = { ...session };
    lastNotifiedStates.current.set(chatId, snapshot);

    for (const sub of subscriptions.current) {
      if (sub.chatId !== undefined && sub.chatId !== chatId) {
        continue;
      }
      try {
        sub.callback(snapshot);
      } catch (error) {
        console.error("Error in streaming state change callback:", error);
      }
    }
  }, []);

  const createSession = useCallback(
    (chatId: string, requestId: string) => {
      sessions.current.set(chatId, { ...INITIAL_STREAMING_STATE, chatId, requestId });
      requestToChatMap.current.set(requestId, chatId);
      notifyForChat(chatId);
    },
    [notifyForChat],
  );

  const getSessionByChatId = useCallback((chatId: string): StreamingState | undefined => {
    return sessions.current.get(chatId);
  }, []);

  const getSessionByRequest = useCallback((requestId: string): StreamingState | undefined => {
    const chatId = requestToChatMap.current.get(requestId);
    if (!chatId) {
      return undefined;
    }
    return sessions.current.get(chatId);
  }, []);

  const getChatIdByRequest = useCallback((requestId: string): string | undefined => {
    return requestToChatMap.current.get(requestId);
  }, []);

  const updateSessionByRequest = useCallback(
    (requestId: string, updates: Partial<StreamingState>) => {
      const chatId = requestToChatMap.current.get(requestId);
      if (!chatId) {
        return;
      }

      const current = sessions.current.get(chatId);
      if (!current) {
        return;
      }

      const newState = { ...current, ...updates };
      if (!shallowEqual(newState, current)) {
        sessions.current.set(chatId, newState);
        notifyForChat(chatId);
      }
    },
    [notifyForChat],
  );

  const batchUpdateSessionByRequest = useCallback(
    (requestId: string, updateFn: (currentState: StreamingState) => Partial<StreamingState>) => {
      const chatId = requestToChatMap.current.get(requestId);
      if (!chatId) {
        return;
      }

      const current = sessions.current.get(chatId);
      if (!current) {
        return;
      }

      const updates = updateFn(current);
      const newState = { ...current, ...updates };
      if (!shallowEqual(newState, current)) {
        sessions.current.set(chatId, newState);
        notifyForChat(chatId);
      }
    },
    [notifyForChat],
  );

  const resetSession = useCallback(
    (chatId: string): StreamingState | undefined => {
      const previous = sessions.current.get(chatId);
      if (!previous) {
        return undefined;
      }

      if (previous.requestId) {
        requestToChatMap.current.delete(previous.requestId);
      }
      sessions.current.delete(chatId);
      lastNotifiedStates.current.delete(chatId);

      notifyForChat(chatId);
      return previous;
    },
    [notifyForChat],
  );

  const resetSessionByRequest = useCallback(
    (requestId: string): StreamingState | undefined => {
      const chatId = requestToChatMap.current.get(requestId);
      if (!chatId) {
        return undefined;
      }
      return resetSession(chatId);
    },
    [resetSession],
  );

  /**
   * Subscribe to streaming state changes.
   * @param callback Called with the StreamingState snapshot whenever it changes.
   * @param chatId If provided, only notified for changes to that specific chat.
   */
  const subscribeToStateChanges = useCallback((callback: StreamingStateChangeCallback, chatId?: string) => {
    const entry: Subscription = { callback, chatId };
    subscriptions.current.add(entry);

    return () => {
      subscriptions.current.delete(entry);
    };
  }, []);

  const isStreaming = useCallback((chatId?: string): boolean => {
    if (chatId) {
      const session = sessions.current.get(chatId);
      return !!(session?.requestId && session?.characterId);
    }
    for (const session of sessions.current.values()) {
      if (session.requestId && session.characterId) {
        return true;
      }
    }
    return false;
  }, []);

  const getStreamingState = useCallback((chatId?: string): StreamingState => {
    if (chatId) {
      return { ...(sessions.current.get(chatId) ?? { ...INITIAL_STREAMING_STATE, chatId }) };
    }
    const first = sessions.current.values().next().value;
    return first ? { ...first } : { ...INITIAL_STREAMING_STATE };
  }, []);

  return {
    createSession,
    getSessionByChatId,
    getSessionByRequest,
    getChatIdByRequest,
    updateSessionByRequest,
    batchUpdateSessionByRequest,
    resetSession,
    resetSessionByRequest,
    subscribeToStateChanges,
    isStreaming,
    getStreamingState,
  };
}
