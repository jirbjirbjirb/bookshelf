import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/config";
import { verifySession } from "@/lib/session";

// next 16 middleware replacement
// only runs in front of the session check endpoint and debug, rejects if session cookie malformed, missing, expired
export function proxy(req: NextRequest) {
  if (!verifySession(req.cookies.get(COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/me", "/api/debug/:path*"] };
