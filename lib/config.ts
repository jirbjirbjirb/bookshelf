import { buildAtprotoLoopbackClientId } from "@atproto/oauth-types";

export const PUBLIC_URL = "https://bookshelf.kirbyjayes.com";

// 'prod' = discoverable client at PUBLIC_URL; 'dev' = loopback client on 127.0.0.1.
export const OAUTH_MODE: "dev" | "prod" =
  process.env.OAUTH_MODE === "prod" ? "prod" : "dev";

const REVIEW_NSID = "com.kirbyjayes.bookshelf.experimental.review"; // where records are kept

const GRANULAR_SCOPE = [
  "atproto",
  `repo:${REVIEW_NSID}`,
  "repo:app.bsky.feed.post?action=create",
].join(" "); // all we need to access for users

// Fallback if bsky.social rejects the granular scopes: set OAUTH_SCOPE_PRESET=transition.
export const SCOPE =
  process.env.OAUTH_SCOPE_PRESET === "transition"
    ? "atproto transition:generic"
    : GRANULAR_SCOPE;

// every redirect should be built from this, never from request.url.
export const APP_ORIGIN =
  OAUTH_MODE === "prod"
    ? PUBLIC_URL
    : `http://127.0.0.1:${process.env.PORT ?? 3000}`; // IP to enable OAuth

export const REDIRECT_URI = `${APP_ORIGIN}/callback`;
export const METADATA_PATH = "/oauth-client-metadata.json";
export const CLIENT_ID =
  OAUTH_MODE === "prod"
    ? `${PUBLIC_URL}${METADATA_PATH}`
    : loopbackClientId(REDIRECT_URI, SCOPE);

// The one place the loopback client_id is built: http://localhost?redirect_uri=<enc>&scope=<enc>
export function loopbackClientId(redirectUri: string, scope: string): string {
  return buildAtprotoLoopbackClientId({ redirect_uris: [redirectUri], scope });
}

export const COOKIE_NAME = "bs_session";
export const LOGIN_NONCE_COOKIE = "bs_login"; // binds a login attempt to the browser that started it
export const SESSION_MAX_AGE_S = 14 * 24 * 60 * 60; // public client sessions cap at 2 weeks
