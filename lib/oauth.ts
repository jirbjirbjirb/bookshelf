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

// creates new client following atProto NodeOAuthClient type
// creating this at runtime and using global this make it possible to use OAuth in dev, otherwise it could just be client = new NodeOAuthClient({...})
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
