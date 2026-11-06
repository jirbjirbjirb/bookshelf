import { Agent } from "@atproto/api";
import {
  TokenInvalidError,
  TokenRefreshError,
  TokenRevokedError,
} from "@atproto/oauth-client-node";
import { XRPCError } from "@atproto/xrpc";
import { REVIEW_NSID } from "./config";
import { getOAuthClient } from "./oauth";
import {
  applyEdit,
  ownReviewRkey,
  reviewFromForm,
  validReview,
  type Result,
  type ReviewRecord,
} from "./review-record";

export type StoredReview = { uri: string; cid: string; value: ReviewRecord };

const SESSION_GONE = "Your session has expired. Sign in again.";
const STALE = "This review changed since it was loaded. Reload and try again.";

// Every call passes `repo: did`, taken from the caller's verified session and never from form input.
// `validate` is left unset: the PDS does not know this lexicon, so validation happens in review-record.ts.
async function withAgent<T>(
  did: string,
  fn: (agent: Agent) => Promise<Result<T>>,
): Promise<Result<T>> {
  try {
    return await fn(new Agent(await getOAuthClient().restore(did)));
  } catch (err) {
    console.error("review request failed", err);
    // Only a dead session means "sign in again". A network or lookup failure does not.
    if (
      err instanceof TokenRefreshError ||
      err instanceof TokenInvalidError ||
      err instanceof TokenRevokedError
    )
      return { ok: false, error: SESSION_GONE };
    if (err instanceof XRPCError) {
      if (err.status === 401) return { ok: false, error: SESSION_GONE };
      if (err.error === "InvalidSwap") return { ok: false, error: STALE };
      if (err.error === "RecordNotFound")
        return { ok: false, error: "That review no longer exists. Reload the page." };
    }
    return { ok: false, error: "Your PDS could not complete the request." };
  }
}

export async function createReview(
  did: string,
  form: FormData,
): Promise<Result<string>> {
  const record = reviewFromForm(form);
  if (!record.ok) return record;
  return withAgent(did, async (agent) => {
    const { data } = await agent.com.atproto.repo.createRecord({
      repo: did,
      collection: REVIEW_NSID,
      record: record.value,
    });
    return { ok: true, value: data.uri };
  });
}

// `loadedCid` is the version the user was looking at when they edited. Passing it as swapRecord makes
// the PDS refuse the write if the record has changed since then, so a stale tab cannot overwrite a
// newer save. The record is read first because putRecord replaces all fields. The rkey is unchanged,
// so the URI stays the same.
export async function editReview(
  did: string,
  uri: string,
  loadedCid: string,
  form: FormData,
): Promise<Result<string>> {
  const rkey = ownReviewRkey(uri, did);
  if (!rkey.ok) return rkey;
  if (!loadedCid) return { ok: false, error: STALE };
  return withAgent(did, async (agent) => {
    const { data: current } = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: REVIEW_NSID,
      rkey: rkey.value,
    });
    const record = applyEdit(current.value, form);
    if (!record.ok) return record;
    const { data } = await agent.com.atproto.repo.putRecord({
      repo: did,
      collection: REVIEW_NSID,
      rkey: rkey.value,
      record: record.value,
      swapRecord: loadedCid,
    });
    return { ok: true, value: data.uri };
  });
}

// Same guard as editReview: a stale tab cannot delete a version the user has not seen.
export async function deleteReview(
  did: string,
  uri: string,
  loadedCid: string,
): Promise<Result<null>> {
  const rkey = ownReviewRkey(uri, did);
  if (!rkey.ok) return rkey;
  if (!loadedCid) return { ok: false, error: STALE };
  return withAgent(did, async (agent) => {
    await agent.com.atproto.repo.deleteRecord({
      repo: did,
      collection: REVIEW_NSID,
      rkey: rkey.value,
      swapRecord: loadedCid,
    });
    return { ok: true, value: null };
  });
}

// For the signed-in user's bare management page. Public profiles arrive in Sprint 4.
export async function listOwnReviews(
  did: string,
): Promise<Result<StoredReview[]>> {
  return withAgent(did, async (agent) => {
    const { data } = await agent.com.atproto.repo.listRecords({
      repo: did,
      collection: REVIEW_NSID,
      limit: 50,
    });
    const reviews: StoredReview[] = [];
    for (const { uri, cid, value } of data.records) {
      const review = validReview(value);
      // The lexicon's key type is tid, so a record at another rkey is as invalid as a bad field.
      if (review && ownReviewRkey(uri, did).ok)
        reviews.push({ uri, cid, value: review });
    }
    return { ok: true, value: reviews };
  });
}
