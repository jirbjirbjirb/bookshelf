import Link from "next/link";
import { redirect } from "next/navigation";
import { Pager } from "@/app/pager";
import { parseCursor } from "@/lib/repo-page";
import { ownReviewRkey } from "@/lib/review-record";
import { listOwnReviews } from "@/lib/reviews";
import { getSessionDid } from "@/lib/session";
import { HiddenRecord, ReviewItem } from "./review-forms";

export const dynamic = "force-dynamic";

export default async function Reviews({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const did = await getSessionDid();
  if (!did)
    redirect(`/?error=${encodeURIComponent("Sign in to see your reviews")}`);
  const cursor = parseCursor((await searchParams).cursor);
  const list = await listOwnReviews(did, cursor);

  return (
    <main>
      <h1>Your reviews</h1>
      <p>
        <Link href="/search">Find a book to review</Link>
      </p>
      {!list.ok && <p role="alert">{list.error}</p>}
      {list.ok && (
        <>
          {list.value.reviews.length === 0 &&
            list.value.hidden.length === 0 && (
              <p>{cursor ? "No more reviews." : "No reviews yet."}</p>
            )}
          {/* Keyed by URI, not CID: saving one review refreshes this list, and an open draft on another
              review must survive that. */}
          {list.value.reviews.map((review) => (
            <ReviewItem key={review.uri} {...review} />
          ))}
          {list.value.hidden.map(({ uri, cid }) => (
            <HiddenRecord
              key={uri}
              uri={uri}
              cid={cid}
              deletable={ownReviewRkey(uri, did).ok}
            />
          ))}
          <Pager path="/reviews" cursor={cursor} next={list.value.next} />
        </>
      )}
    </main>
  );
}
