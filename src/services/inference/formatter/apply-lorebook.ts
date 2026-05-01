import { cosineSimilarity } from "ai";
import { InferenceMessage } from "@/schema/inference-engine-schema";
import type { Lorebook, LorebookEntry } from "@/schema/lorebook-schema";
import { embedText } from "../../embedding-service";
import { parseStoredVector } from "../../lorebook-indexing-service";
import { getLorebookById } from "../../lorebook-service";
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

// Additive boost applied to RAG similarity when one of the entry's keywords matches the recent
// chat window. Sized so a typical match (boost + low-to-moderate similarity) crosses the default
// thresholds (0.35–0.7) without making keyword presence an unconditional trigger at very high thresholds.
export const KEYWORD_MATCH_BOOST = 0.5;

/**
 * Matches keywords in a given text based on entry settings.
 */
export function matchKeywords(text: string, keywords: string[], caseSensitive: boolean, matchPartialWords: boolean): boolean {
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

function entryKeywordMatches(entry: LorebookEntry, reversedMessages: { text: string }[]): boolean {
  if (entry.keywords.length === 0) {
    return false;
  }
  const scanDepth = entry.depth > 0 ? Math.min(entry.depth, reversedMessages.length) : reversedMessages.length;
  if (scanDepth === 0) {
    return false;
  }
  for (const message of reversedMessages.slice(0, scanDepth)) {
    if (matchKeywords(message.text, entry.keywords, entry.case_sensitive, entry.match_partial_words)) {
      return true;
    }
  }
  return false;
}

export async function getLorebookContent(orderedLorebookIds: string[], budget: number, Messages: InferenceMessage[], lorebookSeparator = "\n---\n"): Promise<LorebookContentResponse> {
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
      break;
    }

    const candidateEntries: LorebookEntry[] = [];
    let lorebookBudgetConsumed = 0;
    const lorebookMaxTokens = lorebook.max_tokens > 0 ? lorebook.max_tokens : Number.POSITIVE_INFINITY;

    const enabledEntries = lorebook.entries.filter((entry) => entry.enabled);

    // RAG uses lorebook.max_depth as the scan window for the query (per-entry depth is irrelevant when matching by similarity).
    let queryEmbedding: number[] | null = null;
    if (lorebook.rag_enabled && lorebook.embedding_model_id) {
      const ragScanDepth = lorebook.max_depth > 0 ? Math.min(lorebook.max_depth, reversedMessages.length) : reversedMessages.length;
      const ragMessages = reversedMessages.slice(0, ragScanDepth);
      const queryText = ragMessages.map((m) => m.text).join("\n");
      if (queryText.trim()) {
        try {
          const embedResult = await embedText(lorebook.embedding_model_id, queryText);
          queryEmbedding = embedResult.embedding;
        } catch (error) {
          console.error(`Failed to embed query for lorebook "${lorebook.name}" (${lorebook.id}). Falling back to keyword matching for entries with keywords:`, error);
        }
      }
    }

    for (const entry of enabledEntries) {
      let triggered = false;
      if (entry.constant) {
        triggered = true;
      } else {
        if (messagesLength < entry.min_chat_messages) {
          continue;
        }

        const keywordMatched = entryKeywordMatches(entry, reversedMessages);

        if (queryEmbedding) {
          // Combined RAG + keyword scoring. Keywords act as an additive boost on top of cosine similarity
          // so users can author specific triggers that coexist with semantic matching.
          const entryVector = parseStoredVector(entry.vector_content);
          const similarity = entryVector && entryVector.length === queryEmbedding.length ? cosineSimilarity(queryEmbedding, entryVector) : 0;
          const effectiveScore = keywordMatched ? Math.min(1, similarity + KEYWORD_MATCH_BOOST) : similarity;
          triggered = effectiveScore >= lorebook.similarity_threshold;
        } else {
          // Keyword-only path: RAG disabled or embedding failed.
          triggered = keywordMatched;
        }
      }

      if (!triggered) {
        continue;
      }

      // Per-entry probability gate. Default is 100 (always include).
      if (entry.trigger_chance < 100 && Math.random() * 100 >= entry.trigger_chance) {
        continue;
      }

      candidateEntries.push(entry);
    }

    candidateEntries.sort((a, b) => b.priority - a.priority);

    for (const entry of candidateEntries) {
      if (currentBudget <= 0) {
        break;
      }
      if (lorebookBudgetConsumed >= lorebookMaxTokens) {
        break;
      }

      const entryTokens = estimateTokens(entry.content);

      if (currentBudget >= entryTokens && lorebookBudgetConsumed + entryTokens <= lorebookMaxTokens) {
        currentBudget -= entryTokens;
        lorebookBudgetConsumed += entryTokens;

        switch (entry.insertion_type) {
          case "lorebook_top":
            response.replacers.lorebook_top = response.replacers.lorebook_top ? `${entry.content}${lorebookSeparator}${response.replacers.lorebook_top}` : entry.content;
            break;
          case "lorebook_bottom":
            response.replacers.lorebook_bottom = response.replacers.lorebook_bottom ? `${response.replacers.lorebook_bottom}${lorebookSeparator}${entry.content}` : entry.content;
            break;
          case "user":
          case "assistant":
            response.messages.push({
              role: entry.insertion_type,
              text: entry.content,
              depth: entry.depth,
            });
            break;
          default:
            console.warn(`Unknown insertion type: ${entry.insertion_type}`);
        }
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
