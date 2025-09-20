import { describe, expect, it } from "vitest";
import { replaceRandomPattern } from "../replace-text-placeholders";

describe("replaceRandomPattern", () => {
  it("should replace the random pattern with a random value according to the specified rules", () => {
    const input = "A {{house|apartment|lodge|cottage}} in {{summer|winter|autumn|spring}} by {{2$$artist1|artist2|artist3}}";
    const result = replaceRandomPattern(input);

    // Define expected parts and options
    const buildingOptions = ["house", "apartment", "lodge", "cottage"];
    const seasonOptions = ["summer", "winter", "autumn", "spring"];
    const artistOptions = ["artist1", "artist2", "artist3"];
    const expectedArtistCount = 2;

    // Basic structure check using regex
    const structureRegex = /^A (.*) in (.*) by (.*)$/;
    const match = result.match(structureRegex);

    expect(match).not.toBeNull();
    if (!match) {
      throw new Error("Match not found");
    }

    const building = match[1];
    const season = match[2];
    const artistsPart = match[3];

    // Check if the selected building is one of the options
    expect(buildingOptions).toContain(building);

    // Check if the selected season is one of the options
    expect(seasonOptions).toContain(season);

    // Check the selected artists
    const selectedArtists = artistsPart.split(", ");
    expect(selectedArtists).toHaveLength(expectedArtistCount); // Check count
    selectedArtists.forEach((artist: any) => {
      expect(artistOptions).toContain(artist); // Check if each artist is valid
    });
    // Check for uniqueness
    expect(new Set(selectedArtists).size).toBe(expectedArtistCount);
  });
});
