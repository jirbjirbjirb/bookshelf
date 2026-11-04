import { OAUTH_MODE } from '@/lib/config'
import { clientMetadata } from '@/lib/oauth'

export const dynamic = 'force-dynamic'


// return client metadata document, fetched by auth server to identify this app (prod only)
export function GET() {
  if (OAUTH_MODE !== 'prod') return new Response('not found', { status: 404 })
  return new Response(JSON.stringify(clientMetadata()), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  })
}
