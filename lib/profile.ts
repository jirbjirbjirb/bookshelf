import { safeFetchWrap } from "@atproto-labs/fetch-node";
import {
  DidNotFoundError,
  PoorlyFormattedDidDocumentError,
  PoorlyFormattedDidError,
  UnsupportedDidMethodError,
  UnsupportedDidWebPathError,
} from "@atproto/identity";
import { REVIEW_NSID } from "./config";
import { idResolver } from "./identity";
import {
  loadReviewPage,
  parseHandle,
  parseRecordList,
  type RecordList,
  type ReviewPage,
} from "./repo-page";
import type { Result } from "./review-record";

export type Identity = { did: string; handle: string; pds: string };
export type Lookup =
  | { status: "found"; identity: Identity }
  | { status: "unknown" }
  | { status: "unavailable" };

const RESOLVE_TIMEOUT_MS = 5000;
const LIST_TIMEOUT_MS = 10_000;
// Above the safe fetch default of 512 KiB, which a page of long reviews can exceed: a 50,000-byte text
// plus the book fields is about 80 KB before JSON escaping, and there are 25 records on a page.
const LIST_MAX_BYTES = 4 * 1024 * 1024;

const safeFetch = safeFetchWrap({
  timeout: LIST_TIMEOUT_MS,
  responseMaxSize: LIST_MAX_BYTES,
});

// The resolver's timeout covers its HTTP step but not its DNS lookup, so the whole call is bounded here.
function withinTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("identity lookup timed out")),
      RESOLVE_TIMEOUT_MS,
    );
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

// Retrying will not help these, and any domain owner can cause them with a bad DNS record. plc.directory
// answers 410 for a tombstoned DID, which the resolver throws as a plain Error with a status.
const isPermanentFailure = (err: unknown): boolean =>
  err instanceof DidNotFoundError ||
  err instanceof PoorlyFormattedDidError ||
  err instanceof PoorlyFormattedDidDocumentError ||
  err instanceof UnsupportedDidMethodError ||
  err instanceof UnsupportedDidWebPathError ||
  (err as { status?: unknown } | null)?.status === 410;

// Handle to DID, then DID to PDS, through the official resolvers only. The handle must be confirmed in
// both directions: anyone can publish a DNS record pointing their domain at someone else's DID, so the
// DID document must also name this handle. Otherwise that domain would show another account's reviews
// under its own name.
//
// handle.resolve returns undefined for a missing handle and for a failed lookup alike, so a DNS outage
// also reads as "unknown" here. The not-found page wording allows for that.
export async function resolveProfile(raw: string): Promise<Lookup> {
  const handle = parseHandle(raw);
  if (!handle) return { status: "unknown" };
  try {
    const did = await withinTimeout(idResolver().handle.resolve(handle));
    if (!did) return { status: "unknown" };
    const data = await withinTimeout(idResolver().did.resolveAtprotoData(did));
    if (data.handle.toLowerCase() !== handle) return { status: "unknown" };
    return { status: "found", identity: { did, handle, pds: data.pds } };
  } catch (err) {
    if (isPermanentFailure(err)) return { status: "unknown" };
    console.error("profile lookup failed", err);
    return { status: "unavailable" };
  }
}

class ListRecordsError extends Error {
  constructor(readonly status: number) {
    super(`listRecords returned ${status}`);
  }
}

// The PDS URL comes from a DID document, which the account's owner controls. The safe fetch refuses
// private addresses, plain HTTP and other ports, and redirects are refused outright.
async function listRecords(
  { did, pds }: Identity,
  cursor: string | undefined,
  limit: number,
): Promise<RecordList> {
  const url = new URL("/xrpc/com.atproto.repo.listRecords", pds);
  url.searchParams.set("repo", did);
  url.searchParams.set("collection", REVIEW_NSID);
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);
  const res = await safeFetch(url, { redirect: "error" });
  if (!res.ok) {
    await res.body?.cancel(); // a PDS could otherwise hold the connection open with a slow error body
    throw new ListRecordsError(res.status);
  }
  const list = parseRecordList(await res.json());
  if (!list) throw new Error("malformed listRecords response");
  return list;
}

export async function listProfileReviews(
  identity: Identity,
  cursor: string | undefined,
): Promise<Result<ReviewPage>> {
  try {
    return {
      ok: true,
      value: await loadReviewPage(identity.did, cursor, (c, limit) =>
        listRecords(identity, c, limit),
      ),
    };
  } catch (err) {
    console.error("profile list failed", err);
    const refused = err instanceof ListRecordsError && err.status === 400;
    if (refused && cursor)
      return { ok: false, error: "This page link is no longer valid." };
    // The other parameters are fixed, so a 400 here is about the account: a PDS answers this way for one
    // it no longer serves (deactivated, taken down or moved).
    return {
      ok: false,
      error: refused
        ? "This account's reviews are not available. It may be deactivated or have moved."
        : "Could not reach this account's PDS. Try again shortly.",
    };
  }
}
