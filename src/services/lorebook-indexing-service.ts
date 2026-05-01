import { embedText, embedTexts } from "./embedding-service";
import { clearLorebookVectors, getIndexingStatus, getLorebookById, getLorebookEntryById, listLorebookEntries, updateLorebookEntry } from "./lorebook-service";

export type { IndexingStatus } from "./lorebook-service";

export async function indexLorebookEntry(lorebookId: string, entryId: string): Promise<void> {
  const lorebook = await getLorebookById(lorebookId);
  if (!lorebook?.rag_enabled || !lorebook.embedding_model_id) {
    throw new Error("RAG is not enabled or no embedding model configured for this lorebook");
  }

  const entry = await getLorebookEntryById(entryId);
  if (!entry) {
    throw new Error(`Lorebook entry not found: ${entryId}`);
  }

  const textToEmbed = entry.content;
  if (!textToEmbed.trim()) {
    // Clear any stale vector so an entry whose content was emptied stops triggering on old semantics.
    if (entry.vector_content) {
      await updateLorebookEntry(entryId, { vector_content: null });
    }
    return;
  }

  const result = await embedText(lorebook.embedding_model_id, textToEmbed);
  const vectorJson = JSON.stringify(result.embedding);

  await updateLorebookEntry(entryId, { vector_content: vectorJson });
}

export type IndexProgressCallback = (indexed: number, total: number) => void;

export async function indexAllLorebookEntries(lorebookId: string, onProgress?: IndexProgressCallback): Promise<{ indexed: number; skipped: number; total: number }> {
  const lorebook = await getLorebookById(lorebookId);
  if (!lorebook?.rag_enabled || !lorebook.embedding_model_id) {
    throw new Error("RAG is not enabled or no embedding model configured for this lorebook");
  }

  const entries = await listLorebookEntries(lorebook.profile_id, { lorebook_id: lorebookId, enabled: true });
  const entriesToIndex = entries.filter((e) => e.content.trim().length > 0);
  const total = entriesToIndex.length;

  if (total === 0) {
    return { indexed: 0, skipped: entries.length - total, total: entries.length };
  }

  const texts = entriesToIndex.map((e) => e.content);
  const batchSize = 50;
  let indexedCount = 0;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batchTexts = texts.slice(i, i + batchSize);
    const batchEntries = entriesToIndex.slice(i, i + batchSize);

    const result = await embedTexts(lorebook.embedding_model_id, batchTexts);

    const updatePromises = batchEntries.map((entry, idx) => {
      const vectorJson = JSON.stringify(result.embeddings[idx]);
      return updateLorebookEntry(entry.id, { vector_content: vectorJson });
    });

    await Promise.all(updatePromises);
    indexedCount += batchEntries.length;
    onProgress?.(indexedCount, total);
  }

  return { indexed: indexedCount, skipped: entries.length - total, total: entries.length };
}

export async function clearLorebookIndex(lorebookId: string): Promise<void> {
  await clearLorebookVectors(lorebookId);
}

export { getIndexingStatus };

export function parseStoredVector(vectorContent: string | null | undefined): number[] | null {
  if (!vectorContent) {
    return null;
  }
  try {
    const parsed = JSON.parse(vectorContent);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "number") {
      return parsed;
    }
    console.warn("parseStoredVector: vector_content is not a non-empty number array; treating as unindexed");
    return null;
  } catch (error) {
    console.error("parseStoredVector: failed to JSON.parse vector_content; treating as unindexed:", error);
    return null;
  }
}
