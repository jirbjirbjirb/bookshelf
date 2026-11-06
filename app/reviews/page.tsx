import Link from "next/link";
import { redirect } from "next/navigation";
import { listOwnReviews } from "@/lib/reviews";
import { getSessionDid } from "@/lib/session";
import { ReviewItem } from "./review-forms";

export const dynamic = "force-dynamic";

export default async function Reviews() {
  const did = await getSessionDid();
  if (!did)
    redirect(`/?error=${encodeURIComponent("Sign in to see your reviews")}`);
  const list = await listOwnReviews(did);

  return (
    <main>
      <h1>Your reviews</h1>
      <p>
        <Link href="/search">Find a book to review</Link>
      </p>
      {!list.ok && <p role="alert">{list.error}</p>}
      {list.ok &&
        (list.value.length === 0 ? (
          <p>No reviews yet.</p>
        ) : (
          // Keyed by URI, not CID: saving one review refreshes this list, and an open draft on another
          // review must survive that.
          list.value.map((review) => <ReviewItem key={review.uri} {...review} />)
        ))}
    </main>
  );
}
