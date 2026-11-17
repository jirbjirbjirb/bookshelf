import { notFound } from "next/navigation";
import { BookCard } from "@/app/book-card";
import { LocalDate } from "@/app/local-date";
import { Pager } from "@/app/pager";
import { listProfileReviews, resolveProfile } from "@/lib/profile";
import { parseCursor } from "@/lib/repo-page";

export const dynamic = "force-dynamic";

// Deliberately no loading.tsx: notFound() only sends a 404 status if streaming has not started.
export default async function Profile({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const lookup = await resolveProfile((await params).handle);
  if (lookup.status === "unknown") notFound();
  if (lookup.status === "unavailable")
    return (
      <main>
        <h1>Profile</h1>
        <p role="alert">Could not look up this account. Try again shortly.</p>
      </main>
    );

  const { identity } = lookup;
  const cursor = parseCursor((await searchParams).cursor);
  const page = await listProfileReviews(identity, cursor);

  return (
    <main>
      <h1>@{identity.handle}</h1>
      {!page.ok && (
        <>
          <p role="alert">{page.error}</p>
          <Pager path={`/u/${identity.handle}`} cursor={cursor} />
        </>
      )}
      {page.ok && (
        <>
          {page.value.reviews.length === 0 &&
            page.value.hidden.length === 0 && (
              <p>
                {cursor
                  ? "No more reviews."
                  : `@${identity.handle} has not written any reviews yet.`}
              </p>
            )}
          {page.value.reviews.map(({ uri, value }) => (
            <BookCard
              key={uri}
              coverId={value.coverId}
              title={value.title}
              authors={value.authors}
              href={`/book/${value.bookId}`}
            >
              <p className="meta">
                <LocalDate iso={value.createdAt} />
              </p>
              {value.rating !== undefined && <p>Rating: {value.rating} / 5</p>}
              <p className="review-text">{value.text}</p>
            </BookCard>
          ))}
          {page.value.hidden.length > 0 && (
            <p className="meta">
              {page.value.hidden.length} record(s) on this page could not be
              shown because they are not valid reviews.
            </p>
          )}
          <Pager
            path={`/u/${identity.handle}`}
            cursor={cursor}
            next={page.value.next}
          />
        </>
      )}
    </main>
  );
}
