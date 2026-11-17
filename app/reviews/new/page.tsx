import Link from "next/link";
import { redirect } from "next/navigation";
import { BookCard } from "@/app/book-card";
import { getBook } from "@/lib/openlibrary";
import { getSessionDid } from "@/lib/session";
import { NewReviewForm } from "../review-forms";

export const dynamic = "force-dynamic";

const BACK = <Link href="/search">Back to search</Link>;

// The URL carries only the work key. Title, authors and cover come from Open Library here, so a crafted
// link cannot put a different book's details in front of the user.
export default async function NewReview({
  searchParams,
}: {
  searchParams: Promise<{ book?: string | string[] }>;
}) {
  const did = await getSessionDid();
  if (!did)
    redirect(`/?error=${encodeURIComponent("Sign in to write a review")}`);

  const { book: raw } = await searchParams;
  const found = typeof raw === "string" ? await getBook(raw) : null;

  if (found && !found.ok)
    return (
      <main>
        <h1>Write a review</h1>
        <p role="alert">{found.error}</p>
        <p>{BACK}</p>
      </main>
    );

  const book = found?.value;
  if (!book)
    return (
      <main>
        <h1>Write a review</h1>
        <p role="alert">That book could not be found.</p>
        <p>{BACK}</p>
      </main>
    );

  return (
    <main>
      <h1>Write a review</h1>
      <BookCard
        coverId={book.coverId}
        title={book.title}
        authors={book.authors}
        year={book.year}
      />
      <NewReviewForm book={book} />
      <p>{BACK}</p>
    </main>
  );
}
