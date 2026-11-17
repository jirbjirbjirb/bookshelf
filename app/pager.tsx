import Link from "next/link";

// Cursors only go forward, so "back" is a return to the newest page. The browser's back button covers
// the page before this one.
export function Pager({
  path,
  cursor,
  next,
}: {
  path: string;
  cursor?: string;
  next?: string;
}) {
  if (!cursor && !next) return null;
  return (
    <p className="pager">
      {cursor && <Link href={path}>Newest reviews</Link>}
      {next && (
        <Link href={`${path}?cursor=${encodeURIComponent(next)}`}>
          Older reviews
        </Link>
      )}
    </p>
  );
}
