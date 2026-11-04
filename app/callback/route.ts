import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { APP_ORIGIN, COOKIE_NAME, LOGIN_NONCE_COOKIE } from "@/lib/config";
import { getOAuthClient } from "@/lib/oauth";
import { cookieOptions, signSession } from "@/lib/session";

// this endpoint is given as redirect_uri when hitting the auth server.
// feed params to the OAuthClient().callback method to validate (check state, key exchange, etc, abstracted by AT Proto lib)
// set session cookie on success
// then redirect to home with error param if necessary
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  try {
    const nonce = (await cookies()).get(LOGIN_NONCE_COOKIE)?.value;
    const { session, state } = await getOAuthClient().callback(params);
    // the login must finish in the browser that started it (blocks login CSRF / session fixation)
    if (!nonce || !state || !sameString(nonce, state)) {
      await session.signOut().catch(() => {}); // callback() already stored this session
      throw new Error("login state does not match this browser");
    }
    const res = NextResponse.redirect(`${APP_ORIGIN}/`, 303);
    res.cookies.delete(LOGIN_NONCE_COOKIE);
    res.cookies.set(COOKIE_NAME, signSession(session.sub), cookieOptions);
    return res;
  } catch (err) {
    console.error("oauth callback failed", err);
    const msg =
      params.get("error") === "access_denied"
        ? "Login was cancelled"
        : "Login failed";
    const res = NextResponse.redirect(
      `${APP_ORIGIN}/?error=${encodeURIComponent(msg)}`,
      303,
    );
    res.cookies.delete(LOGIN_NONCE_COOKIE);
    return res;
  }
}

function sameString(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
