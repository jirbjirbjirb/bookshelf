import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCard } from "@/app/book-card";
import { getBook } from "@/lib/openlibrary";

export const dynamic = "force-dynamic";

// Details only, so that links from reviews have somewhere to go. Sprint 5 adds the reviews of the book.
export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const found = await getBook((await params).id);
  if (!found.ok)
    return (
      <main>
        <h1>Book</h1>
        <p role="alert">{found.error}</p>
      </main>
    );
  const book = found.value;
  if (!book) notFound();

  return (
    <main>
      <h1>Book</h1>
      <BookCard
        coverId={book.coverId}
        title={book.title}
        authors={book.authors}
        year={book.year}
      >
        <Link href={`/reviews/new?book=${book.id}`}>Review this book</Link>
      </BookCard>
    </main>
  );
}
