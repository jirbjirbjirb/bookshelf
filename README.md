# Bookshelf

atproto demo: sign in with Bluesky, search books, write reviews as custom lexicon records, browse any user's reviews, see every review of a book.

Full README (architecture, flow diagram, known gaps) is written in Sprint 6. This file currently holds Sprint 0 notes.

## Sprint 0 notes

Research date: 2026-11-03. Sources are subagent reports, reviewed but not independently re-verified unless marked. Items marked **UNCONFIRMED** must be checked when the sprint that depends on them starts.

### OAuth (Sprint 1)

Sources: atproto.com/specs/oauth, atproto.com/specs/permission, `@atproto/oauth-client-node` README.

- Client metadata URL must return HTTP exactly 200, `Content-Type: application/json`, no redirect. `client_id` must equal the metadata URL (https, no port).
- Required metadata: `redirect_uris`, `scope` (must include `atproto`), `grant_types` (`authorization_code`, `refresh_token`), `response_types` (`code`), `dpop_bound_access_tokens: true`. Public client may omit `token_endpoint_auth_method`.
- Scope strings for this app:
  - `atproto`
  - `repo:com.kirbyjayes.bookshelf.experimental.review` (rename in S6)
  - `repo:app.bsky.feed.post?action=create`
- Loopback dev client: `client_id` = `http://localhost?redirect_uri=<encoded>&scope=<encoded>`; redirect URI uses `127.0.0.1` (IP literal). Path must match, port ignored.
- Public client sessions and refresh tokens capped at 2 weeks. Access tokens under 30 minutes.
- `NodeOAuthClient`: `clientMetadata`, `stateStore` (set/get/del), `sessionStore` keyed by DID (set/get/del), optional `requestLock(key, fn)`. `client.restore(did)` refreshes automatically. Set `requestLock` per DID even with one instance (parallel refresh requirement).
- **UNCONFIRMED:** `transition:generic` definition (not on fetched spec pages); current granular-scope support on bsky.social (only an Aug 2025 maintainer statement); full constructor option list; whether `localhost` is banned as redirect host. Sprint 1 test-account login settles the scope question.

### Jetstream (Sprint 5)

Sources: bluesky-social/jetstream RFD, bsky.network/docs/jetstream, npm registry.

- v2 hosts: `wss://jetstream.us-west.bsky.network`, `wss://jetstream.us-east.bsky.network`. Path `/xrpc/network.bsky.jetstream.subscribeEvents`. (v1 hosts `jetstream1.us-west` / `jetstream2.us-east` are legacy.)
- v2 params: `collections`, `dids`, `kinds`, `cursor`. (`wantedCollections` / `wantedDids` are v1 names.)
- Cursor: per-instance sequence number, inclusive (`seq >= N`), at-least-once. Do not reuse a saved `seq` on the other region's host. Upserts keyed on `did` + `rkey` required.
- Replay window: code default 36 hours (`--cursor-lookback`, operator-tunable). Public hosts' real setting **UNCONFIRMED**. Seq cursor older than the floor fails the connection with `CursorTooOld` (HTTP 400). Longer history needs the authenticated snapshot path, out of v1 scope.
- Compression is dictionary-zstd only; run uncompressed.
- Commit payload fields: `seq`, `did`, `time`, `witnessedAt`, `rev`, `operation`, `collection`, `rkey`, `cid`, `record` (deletes have no `record`). The RFD and docs page disagree on `cursor` vs `seq` field name; client library reads `seq`.
- Client choice: `@atcute/jetstream` 2.2.1 (v2-aware, `CursorStore` resume, auto-reconnect). `@skyware/jetstream` is stale (v1, last publish 2025-07). `@atproto/sync` is a firehose library, not Jetstream.
- Design addition: define behavior on `CursorTooOld` (library retries by default; set `ws.maxRetries`, then fall back to live tip and log the gap).

### Identity and safe fetch (Sprints 1, 4, 5)

Source: npm metadata and tarball `.d.ts` / READMEs only.

- Use `@atproto/identity` 0.5.20 `IdResolver({ timeout: 3000 })` for handle to DID (`.handle.resolve`) and DID to PDS (`.did.resolveAtprotoData`). Default HTTP resolution uses an SSRF-protected fetch.
- Use `@atproto-labs/fetch-node` 0.4.3 `safeFetchWrap` for any other server-side fetch of user-influenced URLs (for example PDS `listRecords`). Defaults: HTTPS, port 443, 10 s timeout, 512 KiB cap. Each call must pass `redirect` explicitly.
- Lexicon codegen: `@atproto/lex-cli` 0.10.16 (dev). Validation: `@atproto/lexicon` 0.7.17 (runtime).
- `@atproto/oauth-client-node` 0.5.13 requires Node >= 22.
- **UNCONFIRMED:** default SSRF protection is real runtime behavior (read from `.d.ts` only); `did.resolve*` timeout; `lex-cli` command syntax; `@atproto/lexicon` export names; Next.js bundling of the undici aliases.

### Next.js and SQLite (Sprints 1, 5, 6)

Experiment run in scratchpad (macOS arm64): next 16.4.4, react 19.3.1, better-sqlite3 13.0.3, Node 22.22.3.

- `instrumentation.ts` `register()` runs exactly once under `next start` and under `node .next/standalone/server.js`. It did not run during `next build`. Keep the `NEXT_PHASE === 'phase-production-build'` guard as cheap insurance.
- Put Node-only code in a separate file imported dynamically inside the `NEXT_RUNTIME === 'nodejs'` branch; otherwise Turbopack emits Edge-runtime warnings.
- `next.config.ts`: `output: 'standalone'`, `serverExternalPackages: ['better-sqlite3']`.
- Standalone: `next start` prints a warning; run `node .next/standalone/server.js`. Copy the whole `.next/standalone` directory (keeps the hashed `better-sqlite3-<hash>` symlink), plus `.next/static` and `public/`. Set `HOSTNAME=0.0.0.0`. Build inside the Docker stage because only the host platform's native binding is traced.
- The repo `Dockerfile` is a multi-stage build on `node:22-bookworm-slim`; Sprint 6 hardens it.
- **Verified 2026-11-03:** remote Fly build works (90 MB image, placeholder live). `better-sqlite3` has a `binding.gyp` and no install script, so `npm ci` runs `node-gyp rebuild` and fails without Python; the Dockerfile uses `npm ci --ignore-scripts` to use the shipped linux prebuilds.
- **Verified 2026-11-04:** on the live machine, user `node` can write to `/data` (`/data` is `node:node`). Linux prebuild loading by better-sqlite3 is still untested until the first DB open. Docker is not installed locally.

### Fly.io settings (Sprint 0 infra)

- Target `fly.toml`: `auto_stop_machines = false`, `min_machines_running = 1`, one machine, one volume, in-place deploys.
- Docker is not installed locally; `fly deploy` can build remotely on Fly's builders.
- Infra steps were run from a local instruction file kept outside this repo (`Projects/temp/`).

### Infra (done 2026-11-03)

- Fly app `jirb-bookshelf`, region `iad`, volume `bookshelf_data` (1 GB), dedicated IPv6 plus shared IPv4.
- `bookshelf.kirbyjayes.com`: A and AAAA records at Squarespace DNS, Let's Encrypt certificate issued.
- Test accounts: `bookshelf-test.bsky.social`, `bookshelf-test-1.bsky.social`.

### Open items before Sprint 0 closes

- [x] Infra: Fly app, volume, domain and TLS, two test accounts.
- [ ] Placeholder page live on `https://bookshelf.kirbyjayes.com`.
- [ ] Metadata check script (200, `application/json`, no redirect, `client_id` equals URL).
- [ ] `/code-review` run.
- [ ] Architecture Q&A with Kirby answered unaided.

### Sprint 0 code review (2026-11-04)

Fixed: `public/` copied in the Dockerfile (`public/.gitkeep` added); `npm start` works locally (`postbuild` copies static and public into standalone); metadata check script now has a timeout, stops on non-200, and validates required fields; `data` ignore patterns anchored to `/data`.

Refuted: `/data` not writable by `node` (tested on the live machine, writable).

Deferred:
- Health check does not touch SQLite or the volume. Revisit in Sprint 5 once the DB exists (add a DB read to `/api/health`).
- `next-env.d.ts` gitignored: standard Next.js behavior, regenerated by `next build` / `next dev`.
- `@types/better-sqlite3` ^9.6.0 vs runtime ^13: better-sqlite3 13 ships no types and 9.6.0 is the latest `@types` release. Check signatures when first used.

## Sprint 1 notes (login and session)

### Running

- Local: `.env.local` (gitignored) with `SESSION_SECRET` (>= 32 chars), `OAUTH_MODE=dev`, `DB_FILE=./data/app.db`; `npm run dev`; open `http://127.0.0.1:3000` (not `localhost`).
- Production: `fly secrets set SESSION_SECRET=<random>`; `OAUTH_MODE=prod` and `DB_FILE` are in `fly.toml`.
- `OAUTH_MODE=dev` uses the loopback client (`lib/config.ts` `loopbackClientId`); `prod` serves metadata at `/oauth-client-metadata.json`.

### Scopes

Granular scopes (`atproto`, `repo:com.kirbyjayes.bookshelf.experimental.review`, `repo:app.bsky.feed.post?action=create`) work on `bookshelf-test.bsky.social` (2026-11-04): bsky.social accepted the pushed authorization request, the consent screen showed "Access specific parts of your Bluesky account / Repository: Publish changes", and the local login completed. `transition:generic` fallback is wired (`OAUTH_SCOPE_PRESET=transition`) but was not needed.

### Design notes

- The cookie (`bs_session`, HMAC-signed, 14 days) holds only the DID; OAuth tokens live in SQLite (`auth_session`), state in `auth_state` (1 hour expiry).
- `requestLock` is an in-process per-DID mutex. Correct only while one machine runs; multiple machines would need a shared lock.
- `proxy.ts` checks the cookie signature only; handlers call `client.restore(did)`.
- A revoked or expired OAuth session leaves a valid cookie; the page shows the login form and the next login overwrites it.
- `/api/debug/refresh` forces two concurrent refreshes; disabled unless `DEBUG_ROUTES=1`.

### Deferred

- Stale cookie is not cleared when `restore` fails (server components cannot set cookies).
