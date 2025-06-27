/**
 * Replaces SillyTavern in-line functions with this app's syntax.
 *
 * - {{roll:1d2+1}} → {{roll$$1d2+1}}
 * - {{random:C,A,B}} → {{C|A|B}}
 *
 * @param message - The input string containing SillyTavern functions
 * @returns The string with functions replaced to app syntax
 */
export function replaceSillytavernFunctions(message: string): string {
  if (!message) {
    return message;
  }

  let newMessage = structuredClone(message);

  // Replace {{random:...}} with {{...}} using | as separator
  // Only match if inside double curly braces
  newMessage = newMessage.replace(/\{\{random:([^}]+)\}\}/g, (_match, expr) => {
    // Split by comma, trim whitespace, join with |
    const options = expr
      .split(",")
      .map((opt: string) => opt.trim())
      .join("|");
    return `{{${options}}}`;
  });

  newMessage = newMessage.replace(/\{\{persona\}\}/g, "{{user.personality}}");
  newMessage = newMessage.replace(/\{\{description\}\}/g, "{{character.personality}}");
  newMessage = newMessage.replace(/\{\{scenario\}\}/g, "{{chapter.scenario}}");

  return newMessage;
}
