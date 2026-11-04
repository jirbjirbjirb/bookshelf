import { NextResponse } from "next/server";
import { APP_ORIGIN, COOKIE_NAME } from "@/lib/config";
import { getOAuthClient } from "@/lib/oauth";
import { cookieOptions, signSession } from "@/lib/session";

// this endpoint is given as redirect_uri when hitting the auth server.
// feed params to the OAuthClient().callback method to validate (check state, key exchange, etc, abstracted by AT Proto lib)
// set session cookie on success
// then redirect to home with error param if necessary
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  try {
    const { session } = await getOAuthClient().callback(params); 
    const res = NextResponse.redirect(`${APP_ORIGIN}/`, 303);
    res.cookies.set(COOKIE_NAME, signSession(session.sub), cookieOptions);
    return res;
  } catch (err) {
    console.error("oauth callback failed", err);
    const msg =
      params.get("error") === "access_denied"
        ? "Login was cancelled"
        : "Login failed";
    return NextResponse.redirect(
      `${APP_ORIGIN}/?error=${encodeURIComponent(msg)}`,
      303,
    );
  }
}
