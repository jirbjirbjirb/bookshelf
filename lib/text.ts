// Safe in client components: no atproto imports, so the lexicon stays out of the browser bundle.

const segmenter = new Intl.Segmenter();

const graphemes = (s: string): string[] =>
  Array.from(segmenter.segment(s), (g) => g.segment);

export const graphemeLength = (s: string): number => graphemes(s).length;

// Lexicon limits count graphemes. One slot is kept for the ellipsis, so the result always fits.
export function clipGraphemes(s: string, max: number): string {
  const parts = graphemes(s);
  return parts.length <= max ? s : `${parts.slice(0, max - 1).join("")}…`;
}

// Same values as the lexicon's text limits (a test keeps them equal). These only drive the live
// counter: the server still validates against the lexicon.
export const REVIEW_TEXT_MAX_GRAPHEMES = 5000;
export const REVIEW_TEXT_MAX_BYTES = 50000;
