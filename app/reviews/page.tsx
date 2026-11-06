import { redirect } from "next/navigation";
import { listOwnReviews } from "@/lib/reviews";
import { getSessionDid } from "@/lib/session";
import {
  createReviewAction,
  deleteReviewAction,
  editReviewAction,
} from "./actions";

export const dynamic = "force-dynamic";

function RatingSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <select name="rating" defaultValue={defaultValue}>
      <option value="">No rating</option>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={String(n)}>
          {n}
        </option>
      ))}
    </select>
  );
}

export default async function Reviews({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const did = await getSessionDid();
  if (!did) redirect("/");
  const { error } = await searchParams;
  const list = await listOwnReviews(did);

  return (
    <main>
      <h1>Your reviews</h1>
      {error && <p role="alert">{error}</p>}
      {!list.ok && <p role="alert">{list.error}</p>}
      <p>
        <a href="/">Home</a>
      </p>

      <form action={createReviewAction}>
        <p>
          <label>
            Book ID{" "}
            <input name="bookId" placeholder="OL45804W" required />
          </label>
        </p>
        <p>
          <label>
            Title <input name="title" required />
          </label>
        </p>
        <p>
          <label>
            Authors (one per line) <textarea name="authors" />
          </label>
        </p>
        <p>
          <label>
            Cover ID <input name="coverId" type="number" />
          </label>
        </p>
        <p>
          <label>
            Review <textarea name="text" required />
          </label>
        </p>
        <p>
          <label>
            Rating <RatingSelect defaultValue="" />
          </label>
        </p>
        <button type="submit">Add review</button>
      </form>

      {list.ok &&
        (list.value.length === 0 ? (
          <p>No reviews yet.</p>
        ) : (
          list.value.map(({ uri, cid, value }) => (
            <section key={uri}>
              <h2>{value.title}</h2>
              <p>{value.authors.join(", ")}</p>
              <p>Book: {value.bookId}</p>
              {value.rating != null && <p>Rating: {value.rating}</p>}
              <p>{value.createdAt}</p>
              <p>
                <code>{uri}</code>
              </p>
              {/* Keyed by version: React's form reset would otherwise put back the select's first default. */}
              <form key={cid} action={editReviewAction}>
                <input type="hidden" name="uri" value={uri} />
                <input type="hidden" name="cid" value={cid} />
                <p>
                  <label>
                    Review{" "}
                    <textarea name="text" defaultValue={value.text} required />
                  </label>
                </p>
                <p>
                  <label>
                    Rating{" "}
                    <RatingSelect
                      defaultValue={
                        value.rating != null ? String(value.rating) : ""
                      }
                    />
                  </label>
                </p>
                <button type="submit">Save</button>
              </form>
              <form action={deleteReviewAction}>
                <input type="hidden" name="uri" value={uri} />
                <input type="hidden" name="cid" value={cid} />
                <button type="submit">Delete</button>
              </form>
            </section>
          ))
        ))}
    </main>
  );
}
