import { IdResolver } from "@atproto/identity";
import { getOAuthClient } from "./oauth";

const g = globalThis as unknown as { __idResolver?: IdResolver };
export const idResolver = () =>
  (g.__idResolver ??= new IdResolver({ timeout: 3000 }));

export type Me = { did: string; handle: string | null; pds: string | null };

// if a DID already exists, attempts to restore and refresh auth without new login. Fails if we do not get a matching DID back from the authServer
export async function loadMe(
  did: string,
  forceRefresh = false,
): Promise<Me | null> {
  let session;
  try {
    session = await getOAuthClient().restore(did, forceRefresh ? true : "auto");
  } catch {
    return null;
  }
  try {
    // just to confirm the tokens work, we dont actually use anything
    await session.fetchHandler("/xrpc/com.atproto.server.getSession");
  } catch {
    return null; // PDS unreachable or token refresh failed: treat the session as unavailable
  }

  let handle: string | null = null;
  let pds: string | null = null;
  try {
    const data = await idResolver().did.resolveAtprotoData(did);
    pds = data.pds;
    const back = await idResolver().handle.resolve(data.handle);
    if (back === did) handle = data.handle;
  } catch {}
  return { did, handle, pds };
}
