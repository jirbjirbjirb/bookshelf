import { loadMe } from "@/lib/identity";
import { getSessionDid } from "@/lib/session";

export const dynamic = "force-dynamic";

// if user has a session DID already, call loadMe to see if their session is still valid and just show them as logged in if successful
export async function GET() {
  const did = await getSessionDid();
  if (!did) return Response.json({ error: "not signed in" }, { status: 401 });
  const me = await loadMe(did);
  if (!me) return Response.json({ error: "session expired" }, { status: 401 });
  return Response.json(me);
}
