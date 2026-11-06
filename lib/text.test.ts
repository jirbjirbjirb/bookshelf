import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  clipGraphemes,
  graphemeLength,
  REVIEW_TEXT_MAX_BYTES,
  REVIEW_TEXT_MAX_GRAPHEMES,
} from "./text";

const THUMB = "\u{1F44D}\u{1F3FD}";

describe("graphemeLength", () => {
  it("counts a skin-tone emoji as one grapheme", () => {
    expect(THUMB.length).toBeGreaterThan(1);
    expect(graphemeLength(THUMB)).toBe(1);
  });
});

describe("clipGraphemes", () => {
  it("returns the string unchanged at the limit", () => {
    expect(clipGraphemes("abcde", 5)).toBe("abcde");
  });

  it("clips to exactly max graphemes ending in an ellipsis", () => {
    const out = clipGraphemes("abcdefgh", 5);
    expect(graphemeLength(out)).toBe(5);
    expect(out.endsWith("…")).toBe(true);
    expect(out).toBe("abcd…");
  });

  it("does not split an emoji", () => {
    const out = clipGraphemes(THUMB.repeat(5), 3);
    expect(out).toBe(`${THUMB}${THUMB}…`);
    expect(graphemeLength(out)).toBe(3);
  });
});

describe("REVIEW_TEXT_MAX_GRAPHEMES", () => {
  it("equals the lexicon's text.maxGraphemes", () => {
    const lexicon = JSON.parse(
      readFileSync(
        join(
          __dirname,
          "../lexicons/com/kirbyjayes/bookshelf/experimental/review.json",
        ),
        "utf8",
      ),
    );
    const max = lexicon.defs.main.record.properties.text.maxGraphemes;
    expect(typeof max).toBe("number");
    expect(REVIEW_TEXT_MAX_GRAPHEMES).toBe(max);
    expect(REVIEW_TEXT_MAX_BYTES).toBe(
      lexicon.defs.main.record.properties.text.maxLength,
    );
  });
});
