import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBook, parseSearchResponse, searchBooks } from "./openlibrary";
import { graphemeLength } from "./text";

const OUTAGE = "Open Library is not responding. Try again in a moment.";

const fox = {
  author_name: ["Roald Dahl"],
  cover_i: 6498519,
  first_publish_year: 1970,
  key: "/works/OL45804W",
  title: "Fantastic Mr Fox",
};

const doc = (over: Record<string, unknown> = {}) => ({ ...fox, ...over });
const page = (docs: unknown[]) => parseSearchResponse({ numFound: 1, docs });

describe("parseSearchResponse", () => {
  it("maps a real response", () => {
    expect(parseSearchResponse({ numFound: 69, docs: [fox] })).toEqual({
      total: 69,
      books: [
        {
          id: "OL45804W",
          title: "Fantastic Mr Fox",
          authors: ["Roald Dahl"],
          coverId: 6498519,
          year: 1970,
        },
      ],
    });
  });

  it("returns null for a non-object body", () => {
    expect(parseSearchResponse(null)).toBeNull();
    expect(parseSearchResponse("nope")).toBeNull();
    expect(parseSearchResponse(42)).toBeNull();
  });

  it("returns null when docs is not an array", () => {
    expect(parseSearchResponse({ detail: [] })).toBeNull();
    expect(parseSearchResponse({ docs: {} })).toBeNull();
  });

  it("drops docs without a usable title or key", () => {
    const res = page([
      doc({ title: undefined }),
      doc({ title: "   \n " }),
      doc({ key: "/books/OL1M" }),
      doc({ key: "/works/" }),
      doc({ key: "works/OL1W" }),
      doc({ key: "/works/not an id" }),
      doc({ key: 5 }),
      null,
      "str",
    ]);
    expect(res?.books).toEqual([]);
  });

  it("gives [] when author_name is absent", () => {
    expect(page([doc({ author_name: undefined })])?.books[0].authors).toEqual(
      [],
    );
  });

  it.each([-1, 0, undefined])("omits coverId for cover_i %s", (cover) => {
    const book = page([doc({ cover_i: cover })])?.books[0];
    expect(book).toBeDefined();
    expect("coverId" in book!).toBe(false);
  });

  it("collapses whitespace and newlines in title and authors", () => {
    const book = page([
      doc({
        title: "  Fantastic \n  Mr\tFox ",
        author_name: ["Roald \n Dahl", "  Quentin   Blake "],
      }),
    ])?.books[0];
    expect(book?.title).toBe("Fantastic Mr Fox");
    expect(book?.authors).toEqual(["Roald Dahl", "Quentin Blake"]);
  });

  it("cuts authors to 20", () => {
    const names = Array.from({ length: 25 }, (_, i) => `Author ${i}`);
    const book = page([doc({ author_name: names })])?.books[0];
    expect(book?.authors).toHaveLength(20);
    expect(book?.authors[19]).toBe("Author 19");
  });

  it("clips a 301-grapheme title and a 129-grapheme author", () => {
    const book = page([
      doc({ title: "a".repeat(301), author_name: ["b".repeat(129)] }),
    ])?.books[0];
    expect(book).toBeDefined();
    expect(graphemeLength(book!.title)).toBe(300);
    expect(graphemeLength(book!.authors[0])).toBe(128);
  });

  it("falls back to books.length when numFound is absent", () => {
    expect(parseSearchResponse({ docs: [fox, doc({ title: "" })] })?.total).toBe(
      1,
    );
  });
});

describe("searchBooks and getBook", () => {
  const fetchMock = vi.fn();
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });
  const okBody = { numFound: 1, docs: [fox] };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("requests search.json with fields, limit and a User-Agent", async () => {
    fetchMock.mockResolvedValue(json(okBody));
    const res = await searchBooks("url shape query");
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    const u = new URL(url);
    expect(u.host).toBe("openlibrary.org");
    expect(u.pathname).toBe("/search.json");
    expect(u.searchParams.get("q")).toBe("url shape query");
    expect(u.searchParams.get("fields")).toBeTruthy();
    expect(u.searchParams.get("limit")).toBeTruthy();
    expect(new Headers(init.headers).get("User-Agent")).toBeTruthy();
  });

  it("does not fetch again for a repeat query", async () => {
    fetchMock.mockImplementation(async () => json(okBody));
    await searchBooks("repeat query");
    const second = await searchBooks("repeat query");
    expect(second.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches again after the cache expires", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    fetchMock.mockImplementation(async () => json(okBody));
    await searchBooks("expiry query");
    vi.setSystemTime(new Date("2026-01-01T01:00:00.001Z"));
    await searchBooks("expiry query");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives the outage message on a 500", async () => {
    fetchMock.mockResolvedValue(json({}, 500));
    expect(await searchBooks("status 500 query")).toEqual({
      ok: false,
      error: OUTAGE,
    });
  });

  it("gives the outage message on a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await searchBooks("network error query")).toEqual({
      ok: false,
      error: OUTAGE,
    });
  });

  it("gives the outage message on a 200 with a bad body", async () => {
    fetchMock.mockResolvedValue(json({ detail: [] }));
    expect(await searchBooks("bad body query")).toEqual({
      ok: false,
      error: OUTAGE,
    });
  });

  it("does not cache failures", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 500));
    fetchMock.mockResolvedValueOnce(json(okBody));
    const first = await searchBooks("failure then success query");
    const second = await searchBooks("failure then success query");
    expect(first.ok).toBe(false);
    expect(second.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives a distinct message on a 422", async () => {
    fetchMock.mockResolvedValue(json({}, 422));
    const res = await searchBooks("the 422 query");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBeTruthy();
      expect(res.error).not.toBe(OUTAGE);
    }
  });

  it.each(["abc", "OL1W extra"])(
    "getBook returns null without fetching for invalid id %j",
    async (id) => {
      expect(await getBook(id)).toEqual({ ok: true, value: null });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("getBook returns null when docs is empty", async () => {
    fetchMock.mockResolvedValue(json({ numFound: 0, docs: [] }));
    expect(await getBook("OL1001W")).toEqual({ ok: true, value: null });
  });

  it("getBook returns the matching book and queries by key", async () => {
    fetchMock.mockResolvedValue(json(okBody));
    const res = await getBook("OL45804W");
    expect(res.ok && res.value?.id).toBe("OL45804W");
    const u = new URL(fetchMock.mock.calls[0][0]);
    expect(u.searchParams.get("q")).toBe("key:/works/OL45804W");
  });

  it("getBook returns null when the doc has a different id", async () => {
    fetchMock.mockResolvedValue(json(okBody));
    expect(await getBook("OL2002W")).toEqual({ ok: true, value: null });
  });
});
