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

  // SillyTavern macros are case-insensitive ({{User}}, {{USER}}, {{user}} all match).
  newMessage = newMessage.replace(/\{\{random:([^}]+)\}\}/gi, (_match, expr) => {
    const options = expr
      .split(",")
      .map((opt: string) => opt.trim())
      .join("|");
    return `{{${options}}}`;
  });

  newMessage = newMessage.replace(/\{\{persona\}\}/gi, "{{user.personality}}");
  newMessage = newMessage.replace(/\{\{description\}\}/gi, "{{character.personality}}");
  newMessage = newMessage.replace(/\{\{scenario\}\}/gi, "{{chapter.scenario}}");

  return newMessage;
}
