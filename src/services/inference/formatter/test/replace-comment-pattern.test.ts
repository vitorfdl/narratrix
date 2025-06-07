import { describe, expect, it } from "vitest";
import { replaceCommentPattern } from "../replace-text";

describe("replaceCommentPattern", () => {
  it("should remove simple comment patterns", () => {
    const input = "I will live {{// this is a note within my text}} forever.";
    const result = replaceCommentPattern(input);

    expect(result).toBe("I will live  forever.");
  });

  it("should remove multiple comment patterns", () => {
    const input = "Hello {{// greeting}} world {{// target}} from {{// source}} me!";
    const result = replaceCommentPattern(input);

    expect(result).toBe("Hello  world  from  me!");
  });

  it("should handle comments with various content", () => {
    const input = "Text {{// simple note}} and {{// note with numbers 123}} and {{// note with symbols !@#$%}} end.";
    const result = replaceCommentPattern(input);

    expect(result).toBe("Text  and  and  end.");
  });

  it("should handle empty comments", () => {
    const input = "Before {{//}} after.";
    const result = replaceCommentPattern(input);

    expect(result).toBe("Before  after.");
  });

  it("should handle comments with only spaces", () => {
    const input = "Before {{//   }} after.";
    const result = replaceCommentPattern(input);

    expect(result).toBe("Before  after.");
  });

  it("should handle long comments", () => {
    const longComment = "this is a very long comment that contains multiple words and should be completely removed from the final text";
    const input = `Start {{// ${longComment}}} end.`;
    const result = replaceCommentPattern(input);

    expect(result).toBe("Start  end.");
  });

  it("should preserve non-comment patterns", () => {
    const input = "Character {{char}} says {{// internal note}} hello to {{user}}.";
    const result = replaceCommentPattern(input);

    // Should preserve {{char}} and {{user}} but remove the comment
    expect(result).toContain("{{char}}");
    expect(result).toContain("{{user}}");
    expect(result).not.toContain("{{// internal note}}");
    expect(result).toBe("Character {{char}} says  hello to {{user}}.");
  });

  it("should handle comments at the beginning of text", () => {
    const input = "{{// opening comment}} This is the main text.";
    const result = replaceCommentPattern(input);

    expect(result).toBe(" This is the main text.");
  });

  it("should handle comments at the end of text", () => {
    const input = "This is the main text. {{// closing comment}}";
    const result = replaceCommentPattern(input);

    expect(result).toBe("This is the main text. ");
  });

  it("should handle comments that span multiple lines conceptually", () => {
    const input = "Line 1 {{// comment about line 1}}\nLine 2 {{// comment about line 2}}";
    const result = replaceCommentPattern(input);

    expect(result).toBe("Line 1 \nLine 2 ");
  });

  it("should handle nested braces within comments", () => {
    const input = "Text {{// this comment has {braces} inside}} more text.";
    const result = replaceCommentPattern(input);

    expect(result).toBe("Text  more text.");
  });

  it("should handle comments with forward slashes", () => {
    const input = "Text {{// this/is/a/path/comment}} more text.";
    const result = replaceCommentPattern(input);

    expect(result).toBe("Text  more text.");
  });

  it("should handle comments with special characters", () => {
    const input = "Text {{// comment with @#$%^&*()_+-=[]{}|;':\",./<>?}} more text.";
    const result = replaceCommentPattern(input);

    expect(result).toBe("Text  more text.");
  });

  it("should not remove patterns that look similar but aren't comments", () => {
    const invalidPatterns = [
      "{{/ not a comment}}",
      "{{/// triple slash}}",
      "{{ // space before slashes}}",
      "{{//comment without space}}but no closing braces",
      "{{comment without slashes}}",
    ];

    invalidPatterns.forEach((pattern) => {
      const result = replaceCommentPattern(pattern);
      // These should remain unchanged except for the valid comment pattern
      if (pattern === "{{/// triple slash}}") {
        // This should be removed as it matches our pattern
        expect(result).toBe("");
      } else if (pattern === "{{//comment without space}}but no closing braces") {
        expect(result).toBe("but no closing braces");
      } else {
        expect(result).toBe(pattern);
      }
    });
  });

  it("should handle text without any comment patterns", () => {
    const input = "This is just regular text with no comments.";
    const result = replaceCommentPattern(input);

    expect(result).toBe(input);
  });

  it("should handle empty string", () => {
    const result = replaceCommentPattern("");
    expect(result).toBe("");
  });

  it("should handle only comment patterns", () => {
    const input = "{{// first comment}} {{// second comment}} {{// third comment}}";
    const result = replaceCommentPattern(input);

    expect(result).toBe("  ");
  });

  it("should handle adjacent comment patterns", () => {
    const input = "Text{{// first}}{{// second}}more text.";
    const result = replaceCommentPattern(input);

    expect(result).toBe("Textmore text.");
  });

  it("should handle comments with Unicode characters", () => {
    const input = "Text {{// comment with émojis 🎉 and ñiño}} more text.";
    const result = replaceCommentPattern(input);

    expect(result).toBe("Text  more text.");
  });

  it("should preserve spacing around removed comments", () => {
    const input = "Word1 {{// comment}} Word2";
    const result = replaceCommentPattern(input);

    // Should preserve the spaces around the comment
    expect(result).toBe("Word1  Word2");
  });

  it("should handle complex mixed patterns", () => {
    const input = "{{char}} rolls {{roll:1d20}} {{// for initiative}} on {{date}} {{// today's date}}.";
    const result = replaceCommentPattern(input);

    // Should preserve non-comment patterns but remove comments
    expect(result).toContain("{{char}}");
    expect(result).toContain("{{roll:1d20}}");
    expect(result).toContain("{{date}}");
    expect(result).not.toContain("{{// for initiative}}");
    expect(result).not.toContain("{{// today's date}}");
    expect(result).toBe("{{char}} rolls {{roll:1d20}}  on {{date}} .");
  });
});
