import { describe, expect, it } from "vitest";
import {
  applyEdit,
  ownReviewRkey,
  reviewFromForm,
  validReview,
} from "./review-record";

const NSID = "com.kirbyjayes.bookshelf.experimental.review";
const NOW = new Date("2026-01-02T03:04:05.000Z");

function form(fields: Record<string, string | Blob>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const minimal = {
  bookId: "OL45804W",
  title: "Fantastic Mr Fox",
  authors: "Roald Dahl",
  text: "Great book.",
};

const create = (over: Record<string, string | Blob> = {}) =>
  reviewFromForm(form({ ...minimal, ...over }), NOW);

describe("reviewFromForm", () => {
  it("builds a minimal valid record", () => {
    const res = create();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.$type).toBe(NSID);
    expect(res.value.createdAt).toBe(NOW.toISOString());
    expect(res.value.bookId).toBe("OL45804W");
    expect(res.value.authors).toEqual(["Roald Dahl"]);
    expect("rating" in res.value).toBe(false);
    expect("coverId" in res.value).toBe(false);
  });

  it("carries optional fields as numbers", () => {
    const res = create({ coverId: "123", rating: "5" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.coverId).toBe(123);
    expect(res.value.rating).toBe(5);
  });

  it("splits authors by newline, trims, drops blanks", () => {
    const res = create({ authors: "  A One \n\n   \nB Two\r\n" });
    expect(res.ok && res.value.authors).toEqual(["A One", "B Two"]);
  });

  it("keeps a name with a comma as one author", () => {
    const res = create({ authors: "Dahl, Roald" });
    expect(res.ok && res.value.authors).toEqual(["Dahl, Roald"]);
  });

  it("gives [] with no authors", () => {
    const res = create({ authors: "" });
    expect(res.ok && res.value.authors).toEqual([]);
    const fd = form({ bookId: "OL45804W", title: "T", text: "x" });
    const res2 = reviewFromForm(fd, NOW);
    expect(res2.ok && res2.value.authors).toEqual([]);
  });

  it.each(["", "45804", "OL45804M", "/works/OL45804W", "OL0W", "OL45804W extra"])(
    "rejects bookId %j",
    (bookId) => {
      expect(create({ bookId }).ok).toBe(false);
    },
  );

  it.each(["0", "6", "abc", "1e0", "4.5", "-1"])("rejects rating %j", (rating) => {
    expect(create({ rating }).ok).toBe(false);
  });

  it.each(["0", "abc"])("rejects coverId %j", (coverId) => {
    expect(create({ coverId }).ok).toBe(false);
  });

  it("rejects blank title", () => {
    expect(create({ title: "   " }).ok).toBe(false);
  });

  it("rejects whitespace-only text", () => {
    expect(create({ text: " \n\t " }).ok).toBe(false);
  });

  it("rejects text of 5001 graphemes", () => {
    expect(create({ text: "a".repeat(5001) }).ok).toBe(false);
  });

  it("rejects title of 301 graphemes", () => {
    expect(create({ title: "a".repeat(301) }).ok).toBe(false);
  });

  it("accepts text of exactly 5000 graphemes", () => {
    expect(create({ text: "a".repeat(5000) }).ok).toBe(true);
  });

  it("accepts 5000 multi-codepoint emoji graphemes under the byte cap", () => {
    const emoji = "\u{1F44D}\u{1F3FD}"; // thumbs up + skin tone: 1 grapheme, 8 bytes
    const text = emoji.repeat(5000);
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(50000);
    expect(create({ text }).ok).toBe(true);
    expect(create({ text: text + emoji }).ok).toBe(false);
  });

  it("rejects more than 20 authors", () => {
    const names = Array.from({ length: 21 }, (_, i) => `Author ${i}`);
    expect(create({ authors: names.join("\n") }).ok).toBe(false);
    expect(create({ authors: names.slice(0, 20).join("\n") }).ok).toBe(true);
  });

  it("treats a non-string value as blank and rejects", () => {
    const file = new File(["hello"], "r.txt", { type: "text/plain" });
    expect(create({ text: file }).ok).toBe(false);
  });
});

describe("applyEdit", () => {
  const CROSSPOST = "at://did:plc:abc123/app.bsky.feed.post/3jzfcijpj2z2a";
  const existing = {
    $type: NSID,
    bookId: "OL45804W",
    title: "Original Title",
    authors: ["Roald Dahl"],
    coverId: 99,
    text: "old text",
    rating: 2,
    createdAt: "2025-05-05T05:05:05.000Z",
    crosspost: CROSSPOST,
    extraField: "keep me",
  };

  it("changes text and rating, keeps everything else", () => {
    const res = applyEdit(existing, form({ text: "new text", rating: "4" }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toMatchObject({
      text: "new text",
      rating: 4,
      createdAt: existing.createdAt,
      bookId: existing.bookId,
      title: existing.title,
      authors: existing.authors,
      coverId: 99,
      crosspost: CROSSPOST,
      extraField: "keep me",
    });
  });

  it("removes the rating when blank", () => {
    const res = applyEdit(existing, form({ text: "new text", rating: "" }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect("rating" in res.value).toBe(false);
  });

  it("rejects blank new text", () => {
    expect(applyEdit(existing, form({ text: "  ", rating: "3" })).ok).toBe(false);
  });

  it("rejects an invalid rating", () => {
    expect(applyEdit(existing, form({ text: "x", rating: "9" })).ok).toBe(false);
    expect(applyEdit(existing, form({ text: "x", rating: "abc" })).ok).toBe(false);
  });

  it("rejects an invalid existing record", () => {
    const f = form({ text: "x" });
    expect(applyEdit({ $type: NSID, text: "x" }, f).ok).toBe(false);
    expect(applyEdit(null, f).ok).toBe(false);
  });
});

describe("ownReviewRkey", () => {
  const did = "did:plc:abc123";
  const rkey = "3jzfcijpj2z2a";

  it("returns the rkey for an own URI", () => {
    expect(ownReviewRkey(`at://${did}/${NSID}/${rkey}`, did)).toEqual({
      ok: true,
      value: rkey,
    });
  });

  it("rejects another DID", () => {
    expect(
      ownReviewRkey(`at://did:plc:other/${NSID}/${rkey}`, did),
    ).toEqual({ ok: false, error: "You can only change your own reviews" });
  });

  it("rejects a handle authority", () => {
    expect(ownReviewRkey(`at://alice.bsky.social/${NSID}/${rkey}`, did).ok).toBe(
      false,
    );
  });

  it("rejects the wrong collection", () => {
    expect(ownReviewRkey(`at://${did}/app.bsky.feed.post/${rkey}`, did).ok).toBe(
      false,
    );
  });

  it("rejects a non-TID rkey", () => {
    expect(ownReviewRkey(`at://${did}/${NSID}/notatid`, did).ok).toBe(false);
  });

  it("rejects empty and garbage strings", () => {
    expect(ownReviewRkey("", did).ok).toBe(false);
    expect(ownReviewRkey("!!! not a uri", did).ok).toBe(false);
  });

  it("rejects a URI with no rkey", () => {
    expect(ownReviewRkey(`at://${did}/${NSID}`, did).ok).toBe(false);
    expect(ownReviewRkey(`at://${did}/${NSID}/`, did).ok).toBe(false);
  });
});

describe("validReview", () => {
  it("returns a valid record", () => {
    const res = create();
    if (!res.ok) throw new Error("setup failed");
    expect(validReview(res.value)).toBe(res.value);
  });

  it("returns null for an invalid record", () => {
    expect(validReview({ $type: NSID, text: "x" })).toBeNull();
    expect(validReview(null)).toBeNull();
  });
});
