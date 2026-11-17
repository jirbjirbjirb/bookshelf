import Form from "next/form";
import Link from "next/link";
import { BookCard } from "@/app/book-card";
import { searchBooks } from "@/lib/openlibrary";

export const dynamic = "force-dynamic";

export default async function Search({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q: raw } = await searchParams;
  const q = typeof raw === "string" ? raw.trim() : "";
  const results = q ? await searchBooks(q) : null;

  return (
    <main>
      <h1>Find a book</h1>
      {/* A GET form: the query lives in the URL, so results can be linked and reloaded. */}
      <Form action="/search" key={q}>
        <label>
          Title or author{" "}
          <input name="q" defaultValue={q} maxLength={200} required />
        </label>{" "}
        <button type="submit">Search</button>
      </Form>

      {results && !results.ok && <p role="alert">{results.error}</p>}
      {results?.ok && results.value.books.length === 0 && (
        <p>No books found for &ldquo;{q}&rdquo;. Check the spelling or try fewer words.</p>
      )}
      {results?.ok && results.value.books.length > 0 && (
        <>
          <p className="meta">
            Showing {results.value.books.length} of {results.value.total}{" "}
            results.
          </p>
          {results.value.books.map((book) => (
            <BookCard
              key={book.id}
              coverId={book.coverId}
              title={book.title}
              authors={book.authors}
              year={book.year}
            >
              <Link href={`/reviews/new?book=${book.id}`}>
                Review this book
              </Link>
            </BookCard>
          ))}
        </>
      )}
    </main>
  );
}
