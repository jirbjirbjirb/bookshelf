import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  loadReviewPage,
  parseCursor,
  parseHandle,
  parseRecordList,
  type RecordList,
} from "./repo-page";

const NSID = "com.kirbyjayes.bookshelf.experimental.review";
const DID = "did:plc:abc";
const RKEY = "3jzfcijpj2z2a";

const value = {
  $type: NSID,
  bookId: "OL45804W",
  title: "Fantastic Mr Fox",
  authors: ["Roald Dahl"],
  text: "Great book.",
  createdAt: "2026-01-02T03:04:05.000Z",
};

const rec = () => ({ uri: `at://${DID}/${NSID}/${RKEY}`, cid: "bafy", value });

describe("parseHandle", () => {
  it("lowercases", () => {
    expect(parseHandle("ALICE.bsky.social")).toBe("alice.bsky.social");
  });

  it.each(["@alice.bsky.social", "%40alice.bsky.social"])(
    "strips the @ from %j",
    (raw) => {
      expect(parseHandle(raw)).toBe("alice.bsky.social");
    },
  );

  it.each([
    "foo.internal",
    "foo.local",
    "foo.localhost",
    "foo.onion",
    "handle.invalid",
    "169.254.169.254",
    "a",
    "",
    "%E0%A4%A",
  ])("returns null for %j", (raw) => {
    expect(parseHandle(raw)).toBeNull();
  });
});

describe("parseCursor", () => {
  it("returns a normal string", () => {
    expect(parseCursor("abc")).toBe("abc");
  });

  it("returns undefined for undefined, empty and arrays", () => {
    expect(parseCursor(undefined)).toBeUndefined();
    expect(parseCursor("")).toBeUndefined();
    expect(parseCursor(["a", "b"])).toBeUndefined();
  });

  it("caps length at 512", () => {
    expect(parseCursor("a".repeat(512))).toBe("a".repeat(512));
    expect(parseCursor("a".repeat(513))).toBeUndefined();
  });
});

describe("parseRecordList", () => {
  it.each([
    ["null", null],
    ["a string", "x"],
    ["an empty object", {}],
    ["string records", { records: "x" }],
    ["a record missing uri", { records: [{ cid: "c" }] }],
    ["a record with non-string cid", { records: [{ uri: "u", cid: 1 }] }],
  ])("returns null for %s", (_, body) => {
    expect(parseRecordList(body)).toBeNull();
  });

  it("keeps a string cursor", () => {
    expect(
      parseRecordList({ records: [{ uri: "u", cid: "c" }], cursor: "next" }),
    ).toEqual({ records: [{ uri: "u", cid: "c" }], cursor: "next" });
  });

  it.each([5, "", null])("drops cursor %j", (cursor) => {
    const res = parseRecordList({ records: [], cursor });
    expect(res).toEqual({ records: [] });
    expect(res && "cursor" in res).toBe(false);
  });
});

describe("loadReviewPage", () => {
  function fake(...responses: Array<RecordList | Error>) {
    const calls: Array<[string | undefined, number]> = [];
    const list = async (cursor: string | undefined, limit: number) => {
      calls.push([cursor, limit]);
      const r = responses[calls.length - 1];
      if (r instanceof Error) throw r;
      return r ?? { records: [] };
    };
    return { list, calls };
  }

  it("passes the cursor and PAGE_SIZE on the first call", async () => {
    const { list, calls } = fake({ records: [rec()] });
    await loadReviewPage(DID, "c1", list);
    expect(calls[0]).toEqual(["c1", PAGE_SIZE]);
  });

  it("has no next and one call when no cursor is returned", async () => {
    const { list, calls } = fake({ records: [rec()] });
    const page = await loadReviewPage(DID, undefined, list);
    expect(page.reviews).toHaveLength(1);
    expect("next" in page).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("sets next when the probe finds a record", async () => {
    const { list, calls } = fake(
      { records: [rec()], cursor: "n1" },
      { records: [rec()] },
    );
    const page = await loadReviewPage(DID, undefined, list);
    expect(page.next).toBe("n1");
    expect(calls[1]).toEqual(["n1", 1]);
  });

  it("omits next when the probe finds none", async () => {
    const { list } = fake({ records: [rec()], cursor: "n1" }, { records: [] });
    const page = await loadReviewPage(DID, undefined, list);
    expect("next" in page).toBe(false);
  });

  it("still sets next when the probe rejects", async () => {
    const { list } = fake(
      { records: [rec()], cursor: "n1" },
      new Error("boom"),
    );
    const page = await loadReviewPage(DID, undefined, list);
    expect(page.next).toBe("n1");
  });

  it("rejects when the first list rejects", async () => {
    const { list } = fake(new Error("boom"));
    await expect(loadReviewPage(DID, undefined, list)).rejects.toThrow("boom");
  });

  it("skips the probe for empty records with a cursor", async () => {
    const { list, calls } = fake({ records: [], cursor: "n1" });
    const page = await loadReviewPage(DID, undefined, list);
    expect("next" in page).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("cuts a long response to PAGE_SIZE", async () => {
    const records = Array.from({ length: PAGE_SIZE + 5 }, rec);
    const { list } = fake({ records });
    const page = await loadReviewPage(DID, undefined, list);
    expect(page.reviews).toHaveLength(PAGE_SIZE);
    expect(page.hidden).toHaveLength(0);
  });
});

describe("loadReviewPage, oversized next cursor", () => {
  it("offers no link, because it would lead back to the first page", async () => {
    const page = await loadReviewPage("did:plc:abc", undefined, async () => ({
      records: [{ uri: "at://did:plc:abc/x/y", cid: "c", value: {} }],
      cursor: "z".repeat(513),
    }));
    expect(page.next).toBeUndefined();
  });
});
