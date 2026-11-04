import { APP_ORIGIN, SCOPE } from "@/lib/config";
import { getOAuthClient } from "@/lib/oauth";

const back = (error: string) =>
  Response.redirect(`${APP_ORIGIN}/?error=${encodeURIComponent(error)}`, 303);

// login, send handle to auth client through atProto lib, get back redirect url on success
export async function POST(req: Request) {
  const form = await req.formData();
  const handle = String(form.get("handle") ?? "")
    .trim()
    .replace(/^@/, "");
  if (!handle || handle.length > 253)
    return back("Enter a handle, for example alice.bsky.social");
  try {
    const url = await getOAuthClient().authorize(handle, { scope: SCOPE });
    return Response.redirect(url.toString(), 303);
  } catch (err) {
    console.error("login failed", err);
    return back("Could not start login for that handle");
  }
}
