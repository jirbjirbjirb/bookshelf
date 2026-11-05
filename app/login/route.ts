import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { APP_ORIGIN, LOGIN_NONCE_COOKIE, SCOPE } from "@/lib/config";
import { getOAuthClient } from "@/lib/oauth";
import { cookieOptions, isSameOrigin } from "@/lib/session";

// authorize() also accepts service URLs; only handles and DIDs are valid here.
const HANDLE_OR_DID = /^(?:did:[a-z]+:[a-zA-Z0-9._:%-]+|[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)$/;

const back = (error: string) =>
  Response.redirect(`${APP_ORIGIN}/?error=${encodeURIComponent(error)}`, 303);

// login, send handle to auth client through atProto lib, get back redirect url on success
export async function POST(req: Request) {
  // SameSite only limits sending cookies, so a cross-site form could otherwise plant the nonce
  if (!isSameOrigin(req)) return new Response("Forbidden", { status: 403 });
  const form = await req.formData();
  const handle = String(form.get("handle") ?? "")
    .trim()
    .replace(/^@/, "");
  if (handle.length > 253 || !HANDLE_OR_DID.test(handle))
    return back("Enter a handle, for example alice.bsky.social");
  try {
    // nonce goes to the auth server as app state and into a cookie; /callback requires both to match
    const nonce = randomBytes(16).toString("base64url");
    const url = await getOAuthClient().authorize(handle, {
      scope: SCOPE,
      state: nonce,
    });
    const res = NextResponse.redirect(url.toString(), 303);
    res.cookies.set(LOGIN_NONCE_COOKIE, nonce, { ...cookieOptions, maxAge: 600 });
    return res;
  } catch (err) {
    console.error("login failed", err);
    return back("Could not start login for that handle");
  }
}
