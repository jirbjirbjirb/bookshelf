import { NodeOAuthClient, type RuntimeLock } from "@atproto/oauth-client-node";
import { atprotoLoopbackClientMetadata } from "@atproto/oauth-types";
import { safeFetchWrap } from "@atproto-labs/fetch-node";
import {
  APP_ORIGIN,
  CLIENT_ID,
  OAUTH_MODE,
  PUBLIC_URL,
  REDIRECT_URI,
  SCOPE,
} from "./config";
import { sessionStore, stateStore } from "./stores";

export function clientMetadata() {
  if (OAUTH_MODE === "dev") return atprotoLoopbackClientMetadata(CLIENT_ID);
  return {
    client_id: CLIENT_ID,
    client_name: "Bookshelf",
    client_uri: PUBLIC_URL,
    redirect_uris: [REDIRECT_URI] as [string],
    scope: SCOPE,
    grant_types: ["authorization_code", "refresh_token"] as [
      "authorization_code",
      "refresh_token",
    ],
    response_types: ["code"] as ["code"],
    application_type: "web" as const,
    token_endpoint_auth_method: "none" as const,
    dpop_bound_access_tokens: true,
  };
}

// Per-key mutex: refresh tokens are single-use, so two refreshes for one DID must not interleave.
// In-process only; correct while the app runs as one machine (fly.toml).
const tails = new Map<string, Promise<unknown>>();
export const requestLock: RuntimeLock = async (key, fn) => {
  const prev = tails.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  tails.set(key, tail);
  try {
    return await run;
  } finally {
    if (tails.get(key) === tail) tails.delete(key);
  }
};

const g = globalThis as unknown as { __oauthClient?: NodeOAuthClient };

// Returns the single NodeOAuthClient for this process (created on first call, cached on globalThis
// so dev hot reloads reuse it instead of building a new one per module reload).
//
// Our code never calls the db functions in lib/stores.ts directly. The client calls them
// itself, through the stateStore and sessionStore passed in below. Which store method runs when:
//
//   authorize()  (app/login/route.ts)    stateStore.set(internalKey, {verifier, dpopKey, issuer, appState = nonce})
//   callback()   (app/callback/route.ts) stateStore.get(internalKey), then stateStore.del (one use, blocks replay)
//                                        unknown/expired key throws here, before our nonce check
//                                        then revoke(sub) of any old session: sessionStore.get/del
//                                        then sessionStore.set(did, {tokens, dpopKey})
//   restore()    (lib/identity.ts)       sessionStore.get(did); if the token is expired (or forced),
//                                        refresh inside requestLock, then sessionStore.set(did, newTokens)
//                                        a revoked/unrefreshable session -> sessionStore.del(did)
//   revoke()     (app/logout/route.ts)   sessionStore.get(did), revoke at the auth server, then sessionStore.del(did)
//   session.signOut() (callback nonce mismatch) same as revoke() for that DID
//
// Two different "state" values exist: the internal key (row key in auth_state, also sent to the
// auth server as `state`) and our nonce (appState, returned by callback() as `state`, compared to the cookie).
export function getOAuthClient(): NodeOAuthClient {
  g.__oauthClient ??= new NodeOAuthClient({
    clientMetadata: clientMetadata(),
    stateStore,
    sessionStore,
    requestLock,
    fetch: safeFetchWrap({ allowImplicitRedirect: true }), // block hijacking of /login and passing malicious fetch urls to auth server
    allowHttp: OAUTH_MODE === "dev" && APP_ORIGIN.startsWith("http://"),
  });
  return g.__oauthClient;
}
