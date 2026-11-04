import { loadMe } from '@/lib/identity'
import { getSessionDid } from '@/lib/session'

export const dynamic = 'force-dynamic'

// Test aid for "parallel requests after token expiry": forces a token refresh in two concurrent
// restores. Disabled unless DEBUG_ROUTES=1.
export async function GET() {
  if (process.env.DEBUG_ROUTES !== '1') return new Response('not found', { status: 404 })
  const did = await getSessionDid()
  if (!did) return Response.json({ error: 'not signed in' }, { status: 401 })
  const results = await Promise.all([loadMe(did, true), loadMe(did, true)]) 
  return Response.json({ ok: results.every(Boolean), count: results.length })
}
