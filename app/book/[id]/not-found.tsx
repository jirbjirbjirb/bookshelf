import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <h1>Book not found</h1>
      <p>Open Library has no work with that ID. It may have been merged or removed.</p>
      <p>
        <Link href="/search">Search for a book</Link>
      </p>
    </main>
  );
}
