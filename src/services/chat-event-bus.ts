/**
 * Chat Event Bus
 *
 * A lightweight typed event emitter that broadcasts chat lifecycle events.
 * Components and services emit events; the Agent Trigger Manager subscribes
 * and fires agent workflows in response.
 *
 * Design: simple Map-of-listeners singleton — no external pub/sub library needed.
 */

export type ChatEventType = "before_user_message" | "after_user_message" | "before_participant_message" | "after_participant_message" | "after_all_participants" | "message_count";

export interface ChatEvent {
  type: ChatEventType;
  chatId: string;
  /** Text of the message that triggered the event (if applicable) */
  message?: string;
  /** ID of the participant whose message triggered the event */
  participantId?: string;
  /** Total number of messages in the chat at the time of the event */
  messageCount?: number;
  /**
   * Origin of the event.
   * - "user": emitted by normal user-driven flow (default when omitted).
   * - "system": emitted by the orchestrated generation loop; trigger manager skips these
   *   to prevent double-firing and to ensure agents never trigger other agents.
   */
  source?: "user" | "system";
}

type ChatEventListener = (event: ChatEvent) => void;

class ChatEventBus {
  private readonly listeners = new Map<string, Set<ChatEventListener>>();

  /**
   * Subscribe to all chat events or events for a specific chat.
   *
   * @param listener  Callback invoked for each matching event.
   * @param chatId    When provided, only events for this chat are delivered.
   *                  Pass `"*"` (or omit) to receive events for all chats.
   * @returns Unsubscribe function — call it to stop receiving events.
   */
  subscribe(listener: ChatEventListener, chatId = "*"): () => void {
    if (!this.listeners.has(chatId)) {
      this.listeners.set(chatId, new Set());
    }
    this.listeners.get(chatId)!.add(listener);

    return () => {
      this.listeners.get(chatId)?.delete(listener);
    };
  }

  /**
   * Emit a chat event to all matching subscribers.
   */
  emit(event: ChatEvent): void {
    // Deliver to chat-specific listeners
    const specific = this.listeners.get(event.chatId);
    if (specific) {
      for (const fn of specific) {
        fn(event);
      }
    }
    // Deliver to global listeners
    if (event.chatId !== "*") {
      const global = this.listeners.get("*");
      if (global) {
        for (const fn of global) {
          fn(event);
        }
      }
    }
  }
}

/** Singleton instance shared across the application */
export const chatEventBus = new ChatEventBus();
