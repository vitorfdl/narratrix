import { describe, expect, it } from "vitest";
import { applyCensorship } from "../apply-censorship";

describe("applyCensorship", () => {
  it("should apply censorship to a string", () => {
    const result = applyCensorship("Hello, world!", ["world"], "***");
    expect(result).toBe("Hello, ***!");
  });

  it("should apply censorship to a string with multiple bad words", () => {
    const result = applyCensorship("Hello, world! Hello, world!", ["world"], "***");
    expect(result).toBe("Hello, ***! Hello, ***!");
  });

  it("should apply censorship to phrases", () => {
    const result = applyCensorship("The world is a beautiful place!", ["beautiful place"], "***");
    expect(result).toBe("The world is a ***!");
  });
});
