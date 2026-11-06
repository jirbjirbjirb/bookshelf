"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createReview, deleteReview, editReview } from "@/lib/reviews";
import type { Result } from "@/lib/review-record";
import { getSessionDid } from "@/lib/session";

// Server Actions are public POST endpoints: each one checks the session itself.
async function requireDid(): Promise<string> {
  const did = await getSessionDid();
  if (!did) redirect(`/?error=${encodeURIComponent("Sign in first")}`);
  return did;
}

// redirect() works by throwing, so it stays out here and never inside the lib's try/catch.
function finish(result: Result<unknown>): never {
  if (!result.ok)
    redirect(`/reviews?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/reviews");
  redirect("/reviews");
}

const uriOf = (form: FormData) => String(form.get("uri") ?? "");
const cidOf = (form: FormData) => String(form.get("cid") ?? "");

export async function createReviewAction(form: FormData) {
  finish(await createReview(await requireDid(), form));
}

export async function editReviewAction(form: FormData) {
  finish(await editReview(await requireDid(), uriOf(form), cidOf(form), form));
}

export async function deleteReviewAction(form: FormData) {
  finish(await deleteReview(await requireDid(), uriOf(form), cidOf(form)));
}
