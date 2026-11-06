import { AtUri, isValidTid } from "@atproto/syntax";
import { REVIEW_NSID } from "./config";
import {
  validateRecord,
  type Record as ReviewRecord,
} from "./lexicon/types/com/kirbyjayes/bookshelf/experimental/review";

// Pure logic only: no network, no session. Everything here runs before a request reaches the PDS.

export type { ReviewRecord };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// Lexicons have no pattern constraint, so the work-key shape is checked here.
const BOOK_ID = /^OL[1-9][0-9]*W$/;
const WHOLE_NUMBER = /^[0-9]+$/;

const field = (form: FormData, name: string): string => {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
};

// Blank means absent. Strict digits only, because Number() accepts "1e3", "0x10" and "".
function optionalInt(raw: string, label: string): Result<number | undefined> {
  if (raw === "") return { ok: true, value: undefined };
  const n = Number(raw);
  if (!WHOLE_NUMBER.test(raw) || !Number.isSafeInteger(n))
    return { ok: false, error: `${label} must be a whole number` };
  return { ok: true, value: n };
}

function checked(record: ReviewRecord): Result<ReviewRecord> {
  const res = validateRecord(record);
  return res.success
    ? { ok: true, value: record }
    : { ok: false, error: res.error.message };
}

// Records read back from a repo are untrusted: null means it does not match the lexicon.
export function validReview(value: unknown): ReviewRecord | null {
  return validateRecord(value).success ? (value as ReviewRecord) : null;
}

// Builds a new record from the create form. Authors are one per line, since names can contain commas.
export function reviewFromForm(
  form: FormData,
  now = new Date(),
): Result<ReviewRecord> {
  const bookId = field(form, "bookId");
  if (!BOOK_ID.test(bookId))
    return { ok: false, error: "Book id must look like OL45804W" };

  const coverId = optionalInt(field(form, "coverId"), "Cover id");
  if (!coverId.ok) return coverId;
  const rating = optionalInt(field(form, "rating"), "Rating");
  if (!rating.ok) return rating;

  return checked({
    $type: REVIEW_NSID,
    bookId,
    title: field(form, "title"),
    authors: field(form, "authors")
      .split("\n")
      .map((a) => a.trim())
      .filter(Boolean),
    ...(coverId.value !== undefined && { coverId: coverId.value }),
    text: field(form, "text"),
    ...(rating.value !== undefined && { rating: rating.value }),
    createdAt: now.toISOString(),
  });
}

// putRecord replaces the whole record, so an edit starts from what is stored. Only text and rating
// change: createdAt, the book fields, crosspost and any unknown fields are kept.
export function applyEdit(
  existing: unknown,
  form: FormData,
): Result<ReviewRecord> {
  const current = validateRecord(existing);
  if (!current.success)
    return { ok: false, error: "The stored record is not a valid review" };

  const rating = optionalInt(field(form, "rating"), "Rating");
  if (!rating.ok) return rating;

  const { rating: _dropped, ...rest } = existing as ReviewRecord;
  return checked({
    ...rest,
    text: field(form, "text"),
    ...(rating.value !== undefined && { rating: rating.value }),
  });
}

// Ownership check for edit and delete. The URI must name the signed-in DID's own repo and this
// collection, and handles are refused: only an exact DID match proves ownership without a lookup.
export function ownReviewRkey(uri: string, did: string): Result<string> {
  let parsed: AtUri;
  try {
    parsed = new AtUri(uri);
  } catch {
    return { ok: false, error: "Invalid review URI" };
  }
  if (parsed.host !== did)
    return { ok: false, error: "You can only change your own reviews" };
  if (parsed.collection !== REVIEW_NSID || !isValidTid(parsed.rkey))
    return { ok: false, error: "Invalid review URI" };
  return { ok: true, value: parsed.rkey };
}
