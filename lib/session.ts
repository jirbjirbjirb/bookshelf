import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { APP_ORIGIN, COOKIE_NAME, OAUTH_MODE, SESSION_MAX_AGE_S } from "./config";

// session_secret is a private env used to sign cookies
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw new Error("SESSION_SECRET must be set (>= 32 chars)");
  return s;
}

const mac = (payload: string) =>
  createHmac("sha256", secret()).update(payload).digest("base64url");

export function signSession(did: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ did, exp: now + SESSION_MAX_AGE_S * 1000 }),
  ).toString("base64url");
  return `${payload}.${mac(payload)}`;
}

// check incoming cookie value against server side recreation of expected value using mac encoding of incoming payload, the original cookie val is encoded server-side using SESSION_SECRET

export function verifySession(
  value: string | undefined,
  now = Date.now(),
): string | null {
  // string is DID (valid session) null is failure, including expired session
  if (!value) return null;
  const [payload, sig, extra] = value.split(".");
  // payload: did+expiry as base64
  // sig: signature created using hmac encoded payload value using SESSION_SECRET as the key.
  // extra: third segment means a malformed cookie
  if (!payload || !sig || extra !== undefined) return null; // malformed cookie
  const expected = Buffer.from(mac(payload));
  const given = Buffer.from(sig);
  // expected and given should match because both are created with session secret, length mismatch is an easy reject, timingSafeEqual is byte for byte comparison but throws on different lengths
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    return null;
  try {
    // extract did and exp from payload, and confirm they are typed correctly and expiration date is not passed
    const { did, exp } = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    );
    return typeof did === "string" && typeof exp === "number" && exp > now
      ? did
      : null;
  } catch {
    return null;
  }
}

export async function getSessionDid(): Promise<string | null> {
  return verifySession((await cookies()).get(COOKIE_NAME)?.value);
}

// compare APP_ORIGIN, never request.url, which is unreliable behind Fly's proxy.
export function isSameOrigin(req: Request): boolean {
  return req.headers.get("origin") === APP_ORIGIN;
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: OAUTH_MODE === "prod",
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
};
