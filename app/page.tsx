import { loadMe } from "@/lib/identity";
import { getSessionDid } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const did = await getSessionDid(); // gets DID from session cookie and confirms the cookie is correctly encoded and not expired
  const me = did ? await loadMe(did) : null; // restores oauth session (if possible) and returns user handle/session data. null if session is gone/expired 

  return (
    <main>
      <h1>Bookshelf</h1>
      {error && <p role="alert">{error}</p>}
      {me ? (
        <>
          <p>
            Signed in as <strong>{me.handle ?? "handle unverified"}</strong>
          </p>
          <p>
            <code>{me.did}</code>
          </p>
          <form action="/logout" method="post">
            <button type="submit">Log out</button>
          </form>
        </>
      ) : (
        <form action="/login" method="post">
          <label>
            Bluesky handle{" "}
            <input name="handle" placeholder="alice.bsky.social" required />
          </label>{" "}
          <button type="submit">Log in</button>
        </form>
      )}
    </main>
  );
}
