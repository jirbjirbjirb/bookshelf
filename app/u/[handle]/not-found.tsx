import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <h1>Profile not found</h1>
      <p>
        No account matches that handle. Check the spelling, and try again if
        you know the account exists.
      </p>
      <p>
        <Link href="/">Back to Bookshelf</Link>
      </p>
    </main>
  );
}
