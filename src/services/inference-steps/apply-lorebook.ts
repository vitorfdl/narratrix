import { InferenceMessage } from "@/schema/inference-engine-schema";
import { Lorebook, LorebookEntry } from "@/schema/lorebook-schema";
import { getLorebookById } from "../lorebook-service";
import { estimateTokens } from "./apply-context-limit";

export interface LorebookContentResponse {
  replacers: {
    // Concatenated lorebook content
    lorebook_top: string;
    // Concatenated lorebook content
    lorebook_bottom: string;
  };
  messages: {
    role: "user" | "assistant";
    text: string;
    depth: number;
  }[];
}

/**
 * Matches keywords in a given text based on entry settings.
 */
function matchKeywords(text: string, keywords: string[], caseSensitive: boolean, matchPartialWords: boolean): boolean {
  if (keywords.length === 0) {
    return false; // No keywords to match
  }

  const flags = caseSensitive ? "g" : "gi";

  for (const keyword of keywords) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // Escape regex special chars
    const pattern = matchPartialWords ? escapedKeyword : `\\b${escapedKeyword}\\b`; // Match whole word if partial not allowed
    const regex = new RegExp(pattern, flags);
    if (regex.test(text)) {
      return true; // Found a match
    }
  }
  return false; // No keywords matched
}

export async function getLorebookContent(
  orderedLorebookIds: string[],
  budget: number,
  Messages: InferenceMessage[],
): Promise<LorebookContentResponse> {
  const response: LorebookContentResponse = {
    replacers: {
      lorebook_top: "",
      lorebook_bottom: "",
    },
    messages: [],
  };

  let currentBudget = budget;
  if (currentBudget <= 0) {
    return response; // No budget available
  }

  // Fetch all lorebooks with their entries upfront
  const lorebooks: (Lorebook & { entries: LorebookEntry[] })[] = [];
  for (const id of orderedLorebookIds) {
    // Assuming getLorebookById(id, true) fetches the lorebook AND its entries
    const lorebook = await getLorebookById(id, true);
    if (lorebook) {
      // Ensure entries array exists, even if empty
      lorebooks.push({ ...lorebook, entries: lorebook.entries || [] });
    } else {
      console.warn(`Lorebook with ID ${id} not found.`);
      // Optionally, decide whether to continue or throw an error
    }
  }

  if (lorebooks.length === 0) {
    return response; // No valid lorebooks found or provided
  }

  const reversedMessages = [...Messages].reverse();
  const messagesLength = Messages.length;

  for (const lorebook of lorebooks) {
    if (currentBudget <= 0) {
      break; // Stop processing lorebooks if global budget is depleted
    }

    const candidateEntries: LorebookEntry[] = [];
    let lorebookBudgetConsumed = 0;
    const lorebookMaxTokens = lorebook.max_tokens > 0 ? lorebook.max_tokens : Number.POSITIVE_INFINITY;

    // Filter enabled entries
    const enabledEntries = lorebook.entries.filter((entry) => entry.enabled);

    for (const entry of enabledEntries) {
      let triggered = false;

      if (entry.constant) {
        triggered = true;
      } else {
        // Check non-constant triggers
        if (messagesLength < entry.min_chat_messages) {
          continue; // Not enough messages yet
        }

        const scanDepth = entry.depth > 0 ? Math.min(entry.depth, reversedMessages.length) : reversedMessages.length;
        if (scanDepth === 0) {
          continue; // No messages to scan based on depth
        }

        const messagesToScan = reversedMessages.slice(0, scanDepth);

        for (const message of messagesToScan) {
          if (matchKeywords(message.text, entry.keywords, entry.case_sensitive, entry.match_partial_words)) {
            triggered = true;
            break; // Entry triggered, no need to check more messages for this entry
          }
        }
      }

      if (triggered) {
        candidateEntries.push(entry);
      }
    }

    // Sort triggered candidates by priority (descending)
    candidateEntries.sort((a, b) => b.priority - a.priority);

    // Apply entries within budget
    for (const entry of candidateEntries) {
      if (currentBudget <= 0) {
        break; // Stop applying entries if global budget depleted mid-lorebook
      }
      if (lorebookBudgetConsumed >= lorebookMaxTokens) {
        break; // Stop applying entries if lorebook budget depleted
      }

      const entryTokens = estimateTokens(entry.content);

      if (currentBudget >= entryTokens && lorebookBudgetConsumed + entryTokens <= lorebookMaxTokens) {
        // Apply the entry
        currentBudget -= entryTokens;
        lorebookBudgetConsumed += entryTokens;

        switch (entry.insertion_type) {
          case "lorebook_top":
            response.replacers.lorebook_top = response.replacers.lorebook_top
              ? `${entry.content}\n${response.replacers.lorebook_top}` // Prepend with newline
              : entry.content;
            break;
          case "lorebook_bottom":
            response.replacers.lorebook_bottom = response.replacers.lorebook_bottom
              ? `${response.replacers.lorebook_bottom}\n${entry.content}` // Append with newline
              : entry.content;
            break;
          case "user":
          case "assistant":
            response.messages.push({
              role: entry.insertion_type,
              text: entry.content,
              depth: entry.depth, // Including depth as per schema
            });
            break;
          default:
            console.warn(`Unknown insertion type: ${entry.insertion_type}`);
        }
      } else {
        // Not enough budget (either global or lorebook-specific) for this entry
        // Since entries are sorted by priority, we can potentially stop processing
        // lower-priority entries for this lorebook if needed, but the outer budget checks
        // already handle the main termination conditions.
      }
    }
  }

  // Sort inserted messages by depth before returning, if needed for specific ordering
  // response.messages.sort((a, b) => a.depth - b.depth); // Or descending? Decide based on requirement

  return response;
}

/**
 * Merges lorebook-generated messages into the original message list based on depth.
 * @param messages The original list of inference messages.
 * @param lorebookMessages Messages generated by lorebook entries with insertion_type 'user' or 'assistant'.
 * @returns A new array of inference messages with lorebook messages inserted at the correct positions.
 */
export function processLorebookMessages(messages: InferenceMessage[], lorebookMessages: LorebookContentResponse["messages"]): InferenceMessage[] {
  // Create a mutable copy of the original messages
  const workingMessages = [...messages];

  // Sort lorebook messages by depth descending to handle insertions correctly
  const sortedLorebookMessages = [...lorebookMessages].sort((a, b) => b.depth - a.depth);

  for (const lorebookMessage of sortedLorebookMessages) {
    // Calculate insertion index: `workingMessages.length - depth`
    // Clamp the index between 0 and the current length of the array.
    const insertionIndex = Math.max(0, Math.min(workingMessages.length, workingMessages.length - lorebookMessage.depth));

    const newInferenceMessage: InferenceMessage = {
      role: lorebookMessage.role,
      text: lorebookMessage.text,
    };

    // Insert the lorebook message into the working array
    workingMessages.splice(insertionIndex, 0, newInferenceMessage);
  }

  return workingMessages;
}
