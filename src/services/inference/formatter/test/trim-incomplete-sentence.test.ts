import { describe, expect, it } from "vitest";
import { trimToEndSentence } from "../trim-incomplete-sentence";

describe("trimToEndSentence", () => {
  it("should return empty string for empty input", () => {
    expect(trimToEndSentence("")).toBe("");
    expect(trimToEndSentence(null as any)).toBe("");
    expect(trimToEndSentence(undefined as any)).toBe("");
  });

  it("should trim to the last period", () => {
    expect(trimToEndSentence("Hello world. This is a test")).toBe("Hello world.");
    expect(trimToEndSentence("Hello world.")).toBe("Hello world.");
    expect(trimToEndSentence("Hello world. ")).toBe("Hello world.");
  });

  it("should trim to other sentence-ending punctuation", () => {
    expect(trimToEndSentence("Hello world! This is a test")).toBe("Hello world!");
    expect(trimToEndSentence("Hello world? This is a test")).toBe("Hello world?");
    expect(trimToEndSentence("Hello world! ")).toBe("Hello world!");
  });

  it("should handle quotations and parentheses", () => {
    expect(trimToEndSentence('He said "Hello world." And then')).toBe('He said "Hello world."');
    expect(trimToEndSentence("This is a (test). More text")).toBe("This is a (test).");
    expect(trimToEndSentence("Check this code: `console.log('test')` and more")).toBe("Check this code: `console.log('test')`");
  });

  it("should handle emojis as sentence endings", () => {
    expect(trimToEndSentence("Hello world 😊 This is a test")).toBe("Hello world 😊");
    expect(trimToEndSentence("I like it 👍 what about you")).toBe("I like it 👍");
  });

  it("should handle multiple punctuation cases", () => {
    expect(trimToEndSentence("First sentence. Second sentence! Third?")).toBe("First sentence. Second sentence! Third?");
    expect(trimToEndSentence("Test with emoji 🎉 and more text.")).toBe("Test with emoji 🎉 and more text.");
  });

  it("should return the entire string if no ending punctuation found", () => {
    expect(trimToEndSentence("This sentence has no ending punctuation")).toBe("This sentence has no ending punctuation");
    expect(trimToEndSentence("Just some words")).toBe("Just some words");
  });

  it("should handle non-Latin characters and punctuation", () => {
    expect(trimToEndSentence("こんにちは。これはテストです")).toBe("こんにちは。");
    expect(trimToEndSentence("你好！这是一个测试")).toBe("你好！");
  });

  it("should handle edge cases with whitespace", () => {
    expect(trimToEndSentence("Hello. \n More text")).toBe("Hello.");
    expect(trimToEndSentence("End with space . More text")).toBe("End with space");
  });

  it("should handle incomplete sentences", () => {
    expect(trimToEndSentence("Hello world incomplete")).toBe("Hello world incomplete");
    expect(trimToEndSentence("Hello world incomplete.")).toBe("Hello world incomplete.");
    expect(trimToEndSentence("Hello world incomplete. This is incomplete")).toBe("Hello world incomplete.");
  });

  it("some other tests cases", () => {
    expect(
      trimToEndSentence(
        'Quando o navio inclinava para a esquerda, eu empurrava com toda força, sentindo a resistência da madeira ceder.\n\n"Uurrgh ele rugia com toda força',
      ),
    ).toBe("Quando o navio inclinava para a esquerda, eu empurrava com toda força, sentindo a resistência da madeira ceder.");
  });
});
