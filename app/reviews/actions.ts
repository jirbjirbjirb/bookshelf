"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createReview, deleteReview, editReview } from "@/lib/reviews";
import type { ActionState, Result } from "@/lib/review-record";
import { getSessionDid } from "@/lib/session";

// Failures come back as state rather than a redirect, so the form stays mounted with the user's text.
// Server Actions are public POST endpoints: each one checks the session itself, through here.
async function run(
  write: (did: string) => Promise<Result<unknown>>,
): Promise<ActionState> {
  const did = await getSessionDid();
  if (!did) return { error: "You are signed out. Sign in again." };
  const result = await write(did);
  if (!result.ok) return { error: result.error };
  revalidatePath("/reviews");
  return null;
}

const uriOf = (form: FormData) => String(form.get("uri") ?? "");
const cidOf = (form: FormData) => String(form.get("cid") ?? "");

export async function createReviewAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const state = await run((did) => createReview(did, form));
  if (state) return state;
  redirect("/reviews"); // throws, so it stays outside run()
}

export async function editReviewAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run((did) => editReview(did, uriOf(form), cidOf(form), form));
}

export async function deleteReviewAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run((did) => deleteReview(did, uriOf(form), cidOf(form)));
}
