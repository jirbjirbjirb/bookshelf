import { isBookId, type Result } from "./review-record";
import { clipGraphemes } from "./text";

export type Book = {
  id: string; // work key without the /works/ prefix, e.g. OL45804W
  title: string;
  authors: string[];
  coverId?: number;
  year?: number;
};
export type SearchPage = { total: number; books: Book[] };

// Overridable so an outage can be simulated by pointing it at a dead address.
const BASE_URL = process.env.OPENLIBRARY_URL ?? "https://openlibrary.org";
const USER_AGENT = "Bookshelf/0.1 (https://bookshelf.kirbyjayes.com)";
const FIELDS = "key,title,author_name,cover_i,first_publish_year";
const TIMEOUT_MS = 8_000;
const QUERY_MAX_CHARS = 200;
export const SEARCH_LIMIT = 20;

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

const OUTAGE = "Open Library is not responding. Try again in a moment.";
const REFUSED =
  "Open Library refused that search. Try a more specific title or author.";

// Lexicon limits (lexicons/.../review.json). A book that exceeds them must still be reviewable.
const TITLE_MAX_GRAPHEMES = 300;
const AUTHORS_MAX = 20;
const AUTHOR_MAX_GRAPHEMES = 128;

const WORK_KEY = /^\/works\/(.+)$/;

// Collapses newlines too: the review form sends authors one per line.
const cleanText = (v: unknown): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";

// Open Library data is external input. A doc without a usable key or title cannot become a review, so
// it is dropped; every other field degrades to absent.
function bookFromDoc(doc: unknown): Book | null {
  if (typeof doc !== "object" || doc === null) return null;
  const d = doc as Record<string, unknown>;

  const id = typeof d.key === "string" ? WORK_KEY.exec(d.key)?.[1] : undefined;
  const title = cleanText(d.title);
  if (!id || !isBookId(id) || !title) return null;

  const names = Array.isArray(d.author_name) ? d.author_name : [];
  const coverId = d.cover_i;
  const year = d.first_publish_year;
  return {
    id,
    title: clipGraphemes(title, TITLE_MAX_GRAPHEMES),
    authors: names
      .map(cleanText)
      .filter(Boolean)
      .slice(0, AUTHORS_MAX)
      .map((a) => clipGraphemes(a, AUTHOR_MAX_GRAPHEMES)),
    // Open Library uses -1 for "no cover" in places, and the lexicon's minimum is 1.
    ...(Number.isSafeInteger(coverId) &&
      (coverId as number) > 0 && { coverId: coverId as number }),
    ...(Number.isSafeInteger(year) && { year: year as number }),
  };
}

// Null means the body is not a search response, which is treated like an outage.
export function parseSearchResponse(body: unknown): SearchPage | null {
  if (typeof body !== "object" || body === null) return null;
  const { docs, numFound } = body as { docs?: unknown; numFound?: unknown };
  if (!Array.isArray(docs)) return null;
  const books = docs.map(bookFromDoc).filter((b): b is Book => b !== null);
  return {
    total: typeof numFound === "number" ? numFound : books.length,
    books,
  };
}

// Open Library asks clients to cache. One process, so a Map is enough; it is lost on restart, which
// costs only a re-fetch. Map keeps insertion order, so the first key is the oldest. Failures are never
// stored, so recovery from an outage is immediate.
const cache = new Map<string, { expires: number; page: SearchPage }>();

function cached(url: string): SearchPage | null {
  const hit = cache.get(url);
  if (!hit) return null;
  if (hit.expires > Date.now()) return hit.page;
  cache.delete(url);
  return null;
}

function store(url: string, page: SearchPage): void {
  if (cache.size >= CACHE_MAX_ENTRIES)
    cache.delete(cache.keys().next().value as string);
  cache.set(url, { expires: Date.now() + CACHE_TTL_MS, page });
}

async function search(
  params: Record<string, string>,
): Promise<Result<SearchPage>> {
  const url = `${BASE_URL}/search.json?${new URLSearchParams({ ...params, fields: FIELDS })}`;
  const hit = cached(url);
  if (hit) return { ok: true, value: hit };

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 422 is a refused query, such as stopwords only ("the"). Retrying the same words will not help.
    if (res.status === 422) return { ok: false, error: REFUSED };
    if (!res.ok) throw new Error(`status ${res.status}`);
    const page = parseSearchResponse(await res.json());
    if (!page) throw new Error("unexpected response shape");
    store(url, page);
    return { ok: true, value: page };
  } catch (err) {
    console.error("open library request failed", err);
    return { ok: false, error: OUTAGE };
  }
}

export function searchBooks(query: string): Promise<Result<SearchPage>> {
  const q = query.trim().replace(/\s+/g, " ").slice(0, QUERY_MAX_CHARS);
  return search({ q, limit: String(SEARCH_LIMIT) });
}

// Uses search rather than /works/<id>.json because that endpoint returns author keys, not names.
// The id is checked first because it is interpolated into the query. A null value means no such work.
export async function getBook(id: string): Promise<Result<Book | null>> {
  if (!isBookId(id)) return { ok: true, value: null };
  const res = await search({ q: `key:/works/${id}`, limit: "1" });
  if (!res.ok) return res;
  return {
    ok: true,
    value: res.value.books.find((b) => b.id === id) ?? null,
  };
}
