export function trimToEndSentence(input: string) {
  if (!input) {
    return "";
  }

  const isEmoji = (x: string) => /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu.test(x);
  const punctuation = new Set([".", "!", "?", "*", '"', ")", "}", "`", "]", "$", "。", "！", "？", "”", "）", "】", "’", "」", "_"]); // extend this as you see fit
  let last = -1;

  const characters = Array.from(input);
  for (let i = characters.length - 1; i >= 0; i--) {
    const char = characters[i];
    const emoji = isEmoji(char);

    if (punctuation.has(char) || emoji) {
      if (!emoji && i > 0 && /[\s\n]/.test(characters[i - 1])) {
        last = i - 1;
      } else {
        last = i;
      }
      break;
    }
  }

  if (last === -1) {
    return input.trimEnd();
  }

  return characters
    .slice(0, last + 1)
    .join("")
    .trimEnd();
}
