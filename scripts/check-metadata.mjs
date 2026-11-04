// Usage: node scripts/check-metadata.mjs [url]
// Verifies the OAuth client metadata document: HTTP 200, application/json, no redirect,
// client_id equals the URL (https, no port), and the fields atproto OAuth requires.
const url = process.argv[2] ?? 'https://bookshelf.kirbyjayes.com/oauth-client-metadata.json'

const fail = (failures) => {
  console.error(`FAIL ${url}`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

let res
try {
  res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
} catch (err) {
  fail([`request failed: ${err.cause?.code ?? err.name}: ${err.message}`])
}

if (res.status !== 200) fail([`status ${res.status}, expected exactly 200 (redirects not allowed)`])

const failures = []
const type = res.headers.get('content-type') ?? ''
if (!/^application\/json\b/i.test(type)) failures.push(`content-type "${type}", expected application/json`)

let body
try {
  body = await res.json()
} catch {
  fail([...failures, 'body is not valid JSON'])
}
if (typeof body !== 'object' || body === null || Array.isArray(body)) fail([...failures, 'body is not a JSON object'])

const parsed = new URL(url)
if (body.client_id !== url) failures.push(`client_id "${body.client_id}" does not equal ${url}`)
if (parsed.protocol !== 'https:' || parsed.port) failures.push('URL must be https with no explicit port')
if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) failures.push('redirect_uris must be a non-empty array')
if (typeof body.scope !== 'string' || !body.scope.split(' ').includes('atproto')) failures.push('scope must be a string including "atproto"')
for (const g of ['authorization_code', 'refresh_token']) {
  if (!Array.isArray(body.grant_types) || !body.grant_types.includes(g)) failures.push(`grant_types must include "${g}"`)
}
if (!Array.isArray(body.response_types) || !body.response_types.includes('code')) failures.push('response_types must include "code"')
if (body.dpop_bound_access_tokens !== true) failures.push('dpop_bound_access_tokens must be true')

if (failures.length) fail(failures)
console.log(`OK ${url}`)
