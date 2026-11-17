import { isValidHandle, isValidTld, normalizeHandle } from "@atproto/syntax";
import {
  readReviews,
  type RepoRecord,
  type StoredReview,
} from "./review-record";

// Pure logic only. The network calls are passed in, so public profiles (safe fetch) and the signed-in
// page (OAuth agent) paginate the same way.

export const PAGE_SIZE = 25;
const MAX_CURSOR_LENGTH = 512;

export type RecordList = { records: RepoRecord[]; cursor?: string };
export type ReviewPage = {
  reviews: StoredReview[];
  hidden: RepoRecord[];
  next?: string;
};

// Returns the normalized handle, or null if it cannot be one. isValidHandle does not look at the TLD,
// and without this check names such as foo.internal would reach the resolver's DNS lookup.
export function parseHandle(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const handle = normalizeHandle(decoded.replace(/^@/, ""));
  return isValidHandle(handle) && isValidTld(handle) ? handle : null;
}

// The cursor is opaque and only ever sent back to the PDS it came from, as an encoded query parameter.
export function parseCursor(raw: string | string[] | undefined) {
  return typeof raw === "string" && raw && raw.length <= MAX_CURSOR_LENGTH
    ? raw
    : undefined;
}

// A PDS can be run by anyone, so its response is checked before use. Null means malformed.
export function parseRecordList(body: unknown): RecordList | null {
  if (typeof body !== "object" || body === null) return null;
  const { records, cursor } = body as { records?: unknown; cursor?: unknown };
  if (!Array.isArray(records)) return null;
  const valid = records.every(
    (r) => typeof r?.uri === "string" && typeof r?.cid === "string",
  );
  if (!valid) return null;
  return {
    records: records as RepoRecord[],
    ...(typeof cursor === "string" && cursor && { cursor }),
  };
}

// Newest first needs no sorting: listRecords returns descending record keys by default, and record keys
// are time-based. createdAt is written by the author, so it does not decide the order.
//
// A cursor does not prove there are more records, so one more record is requested before offering the
// link. If that request fails the link is still offered, since hiding it would hide older reviews.
export async function loadReviewPage(
  did: string,
  cursor: string | undefined,
  list: (cursor: string | undefined, limit: number) => Promise<RecordList>,
): Promise<ReviewPage> {
  const { records, cursor: next } = await list(cursor, PAGE_SIZE);
  const page = readReviews(records.slice(0, PAGE_SIZE), did);
  // A cursor too long for parseCursor would send the link back to the first page.
  if (!parseCursor(next) || records.length === 0) return page;
  let more = true;
  try {
    more = (await list(next, 1)).records.length > 0;
  } catch {}
  return more ? { ...page, next } : page;
}
