const cancelledChatGenerations = new Set<string>();

export function cancelChatGeneration(chatId: string): void {
  cancelledChatGenerations.add(chatId);
}

export function clearChatGenerationCancellation(chatId: string): void {
  cancelledChatGenerations.delete(chatId);
}

export function isChatGenerationCancelled(chatId: string): boolean {
  return cancelledChatGenerations.has(chatId);
}
