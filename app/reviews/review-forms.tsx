"use client";

import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
} from "react";
import { unstable_rethrow } from "next/navigation";
import { Cover } from "@/app/cover";
import type { Book } from "@/lib/openlibrary";
import type { ActionState } from "@/lib/review-record";
import type { StoredReview } from "@/lib/reviews";
import {
  graphemeLength,
  REVIEW_TEXT_MAX_BYTES,
  REVIEW_TEXT_MAX_GRAPHEMES,
} from "@/lib/text";
import {
  createReviewAction,
  deleteReviewAction,
  editReviewAction,
} from "./actions";

const ratingText = (rating: number | undefined) =>
  rating === undefined ? "" : String(rating);

type ServerAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

// A server action that rejects (offline, a server error, a deploy that retired the action's ID) would be
// rethrown by useActionState during render, replacing the page with an error screen and losing the
// draft. Next also delivers a successful redirect as a rejection, so that one is let through.
const guarded =
  (action: ServerAction, message: string): ServerAction =>
  async (prev, form) => {
    try {
      return await action(prev, form);
    } catch (err) {
      unstable_rethrow(err);
      console.error("server action failed", err);
      return { error: message };
    }
  };

const UNREACHABLE_DRAFT =
  "Could not reach the server. Your text is still here, so try again.";
const publishReview = guarded(createReviewAction, UNREACHABLE_DRAFT);
const saveEdit = guarded(editReviewAction, UNREACHABLE_DRAFT);
const removeReview = guarded(
  deleteReviewAction,
  "Could not reach the server. Try again.",
);

// Replaces <form action={...}>, because React resets a form after that kind of action finishes. A
// controlled <select> falls back to its first option on reset while state keeps the old value, so the
// form would show "No rating" after a failure and the retry would drop the rating.
const submitWithoutReset =
  (action: (form: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(() => action(form));
  };

// Controlled, so the values survive a failed submit. `fields` is the rendered inputs, with their state
// owned by the form that calls this.
function useReviewFields(initialText: string, initialRating: string) {
  const [text, setText] = useState(initialText);
  const [rating, setRating] = useState(initialRating);
  // The server trims before validating, so the limits apply to the trimmed text.
  const trimmed = text.trim();
  const used = graphemeLength(trimmed);
  const over =
    used > REVIEW_TEXT_MAX_GRAPHEMES ||
    new TextEncoder().encode(trimmed).length > REVIEW_TEXT_MAX_BYTES;

  const fields = (
    <>
      <p>
        <label>
          Review
          <textarea
            name="text"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
        </label>
        <span className={over ? "count over" : "count"}>
          {used} / {REVIEW_TEXT_MAX_GRAPHEMES}
          {over && " (too long)"}
        </span>
      </p>
      <p>
        <label>
          Rating{" "}
          <select
            name="rating"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          >
            <option value="">No rating</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </p>
    </>
  );
  return { fields, canSubmit: trimmed !== "" && !over };
}

function Failure({ state }: { state: ActionState }) {
  return state && <p role="alert">{state.error}</p>;
}

// The book fields are hidden inputs filled from the server's Open Library lookup. A hand-edited POST
// could change them, but only in the sender's own repo, which they can write to directly anyway.
export function NewReviewForm({ book }: { book: Book }) {
  const [state, action, pending] = useActionState(publishReview, null);
  const { fields, canSubmit } = useReviewFields("", "");

  return (
    <form onSubmit={submitWithoutReset(action)}>
      <input type="hidden" name="bookId" value={book.id} />
      <input type="hidden" name="title" value={book.title} />
      <input type="hidden" name="authors" value={book.authors.join("\n")} />
      <input type="hidden" name="coverId" value={book.coverId ?? ""} />
      {fields}
      <Failure state={state} />
      <button type="submit" disabled={pending || !canSubmit}>
        {pending ? "Publishing…" : "Publish review"}
      </button>
    </form>
  );
}

// Mounted only while editing, so each edit starts from the current record. The CID is frozen on mount:
// it names the version these edits are based on, and a refresh that delivers a newer one must not move
// it, or the swapRecord guard would pass and overwrite that newer version.
function EditForm({
  uri,
  cid,
  value,
  onClose,
}: StoredReview & { onClose: () => void }) {
  const [loadedCid] = useState(cid);
  const { fields, canSubmit } = useReviewFields(
    value.text,
    ratingText(value.rating),
  );
  const [state, action, pending] = useActionState(
    async (prev: ActionState, form: FormData) => {
      const next = await saveEdit(prev, form);
      if (!next) onClose();
      return next;
    },
    null,
  );

  return (
    <form onSubmit={submitWithoutReset(action)}>
      <input type="hidden" name="uri" value={uri} />
      <input type="hidden" name="cid" value={loadedCid} />
      {fields}
      <Failure state={state} />
      <button type="submit" disabled={pending || !canSubmit}>
        {pending ? "Saving…" : "Save"}
      </button>{" "}
      <button type="button" onClick={onClose} disabled={pending}>
        Cancel
      </button>
    </form>
  );
}

// Mounted only while confirming. As in EditForm, the CID is frozen on mount, so a refresh cannot move
// the guard onto a version the user has not seen, and each confirmation starts with no old error.
function ConfirmDelete({
  uri,
  cid,
  onCancel,
}: {
  uri: string;
  cid: string;
  onCancel: () => void;
}) {
  const [loadedCid] = useState(cid);
  const [state, action, pending] = useActionState(removeReview, null);

  return (
    <form action={action} className="inline">
      <input type="hidden" name="uri" value={uri} />
      <input type="hidden" name="cid" value={loadedCid} />
      <button type="submit" disabled={pending}>
        {pending ? "Deleting…" : "Confirm delete"}
      </button>{" "}
      <button type="button" onClick={onCancel} disabled={pending}>
        Cancel
      </button>
      <Failure state={state} />
    </form>
  );
}

// Delete cannot be undone, so it takes a second click.
function DeleteControl({ uri, cid }: { uri: string; cid: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming)
    return (
      <button type="button" onClick={() => setConfirming(true)}>
        Delete
      </button>
    );
  return (
    <ConfirmDelete uri={uri} cid={cid} onCancel={() => setConfirming(false)} />
  );
}

export function ReviewItem(review: StoredReview) {
  const { uri, cid, value } = review;
  const [editing, setEditing] = useState(false);

  return (
    <article className="book">
      <Cover id={value.coverId} />
      <div className="book-body">
        <h2>{value.title}</h2>
        {value.authors.length > 0 && <p>{value.authors.join(", ")}</p>}
        <p className="meta">{value.createdAt.slice(0, 10)}</p>
        {editing ? (
          <EditForm {...review} onClose={() => setEditing(false)} />
        ) : (
          <>
            {value.rating !== undefined && <p>Rating: {value.rating} / 5</p>}
            <p className="review-text">{value.text}</p>
            <button type="button" onClick={() => setEditing(true)}>
              Edit
            </button>{" "}
            <DeleteControl uri={uri} cid={cid} />
          </>
        )}
      </div>
    </article>
  );
}
