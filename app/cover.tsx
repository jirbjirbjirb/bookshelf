// A plain <img>: the browser loads covers straight from Open Library, so they do not pass through this
// server. Lookups by cover id are not subject to the covers API's per-IP limit.
export function Cover({ id }: { id?: number }) {
  if (id === undefined) return <div className="cover cover-none" aria-hidden />;
  return (
    <img
      className="cover"
      src={`https://covers.openlibrary.org/b/id/${id}-M.jpg`}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
