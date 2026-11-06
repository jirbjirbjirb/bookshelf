# Bookshelf project notes

Progress, research and decisions by sprint. The sprint plan: https://claude.ai/artifact/LftUT4RFFyXSXNt79KsVjT

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
- [x] Placeholder page live on `https://bookshelf.kirbyjayes.com`.
- [x] Metadata check script (200, `application/json`, no redirect, `client_id` equals URL).
- [x] `/code-review` run.
- [x] Architecture Q&A with Kirby answered unaided.

Sprint 0 gate and checks confirmed by Kirby (2026-11-05). Items marked **UNCONFIRMED** above remain open until the sprint that depends on them.

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
- Session cookie cannot be revoked before its 14-day `exp` (stateless HMAC). A copied cookie still fails at `restore(did)` once the stored session is deleted. Fix needs a server-side session table (Sprint 6).
- Logging in as a second DID in the same browser leaves the first DID's `auth_session` row (and refresh token) in place, unrevoked. Low impact; expires with the refresh token.
- `/login` has no rate limit, so `auth_state` can be grown for up to an hour per flood. Sprint 6.
- Pending decision: `loadMe` ignores the HTTP status of its `getSession` call (only a thrown error counts as a dead session). Whether `getSession` succeeds under the granular scopes is unchecked.

### Sprint 1 code review (2026-11-04, `/code-review` medium)

Fixed:
- Login CSRF / session fixation: `/login` sets a random nonce as both the `state` option and a `bs_login` cookie; `/callback` requires them to match and signs out the just-stored session on mismatch. `/login` and `/logout` reject any POST whose `Origin` is not `APP_ORIGIN`, so another site cannot plant the nonce or clear the session cookie.
- `loadMe`: the `getSession` call is inside try/catch (PDS outage returns the signed-out view, not a 500).
- `/api/me` no longer returns the raw `getSession` body (email etc.); only `did`, `handle`, `pds`.
- Logout shows an error if the remote token revoke fails (the local session is deleted regardless).

Refuted:
- Dev `APP_ORIGIN` fixed to `127.0.0.1`: intended (cookies do not cross from `localhost`; loopback redirect URI must be an IP literal).
- `requestLock` multi-process race during deploys: one machine and one volume, `strategy = 'immediate'` replaces rather than overlaps. Passing `fn` as both `then` handlers is cosmetic.

## Sprint 2 notes (lexicon and record writes)

### Running

- `npm run lex:gen` regenerates `lib/lexicon/` from `lexicons/`. Run it after any lexicon change. Do not edit `lib/lexicon/` by hand.
- `npm test` runs the unit tests (vitest).
- `/reviews` is the bare page for creating, editing and deleting your own reviews.

### Lexicon limits

Limits can change until the Sprint 6 rename, because only test records exist under the experimental NSID.

| Field | Limit |
|---|---|
| `bookId` | 3-32 bytes; app also requires `OL<number>W`, since lexicons have no pattern constraint |
| `title` | 1-300 graphemes, 3,000 bytes |
| `authors` | 0-20 names, each up to 128 graphemes, 1,280 bytes |
| `coverId` | integer, minimum 1 |
| `text` | 1-5,000 graphemes, 50,000 bytes |
| `rating` | integer, 1-5 |
| `createdAt` | datetime, unchanged by edits |
| `crosspost` | at-uri, written in Sprint 7 |

### Design notes

- `lex gen-api` output is adjusted by `scripts/gen-lexicon.mjs`: `index.ts` is removed (its client wrapper does not compile without vendored `com.atproto.repo` schemas), and `.js` import suffixes are stripped (Turbopack does not resolve them to `.ts`, verified by build failure).
- Writes use `@atproto/api` `Agent` over the restored OAuth session. `validate` is left unset because the PDS does not know this lexicon; `lib/review-record.ts` validates before any request.
- `repo` always comes from the session DID. `ownReviewRkey` also refuses any URI whose authority is not exactly that DID, whose collection is wrong, or whose rkey is not a TID.
- Edit and delete pass the CID the page loaded as `swapRecord`, so a stale tab gets a conflict instead of overwriting or deleting a newer version. Edit reads the record first because `putRecord` replaces all fields; only `text` and `rating` change.
- The edit form is keyed by CID: React's form reset would otherwise restore the select's first default and the next save would write the old rating.
- `REVIEW_NSID` comes from the generated lexicon and also builds the OAuth scope, so the Sprint 6 rename cannot leave them out of step.

### Verified 2026-11-05

- Local and on `https://bookshelf.kirbyjayes.com`, against `bookshelf-test.bsky.social` on its real PDS: 29 browser checks pass in both, with repo state read independently through public `listRecords` and `getRecord`. The script is not in the repo (automated end-to-end tests are out of v1 scope). Server Actions pass Next's origin check behind Fly's proxy.
- `InvalidSwap` and `RecordNotFound` are the error names the PDS actually returns (server log).
- The first browser run caught a real bug: `swapRecord` used the CID read at save time, so stale tabs overwrote newer saves. Fixed by sending the loaded CID.

### Sprint 2 code review (2026-11-05, `/code-review` medium)

Fixed:
- Edit form's rating select restored its old default after a save (form keyed by CID).
- Listed reviews at non-TID rkeys could not be edited or deleted (list now applies the same check; the lexicon's key type is `tid`).
- Delete had no stale guard (now sends `swapRecord`).
- Every `restore()` failure read as an expired session (now only `TokenRefreshError`, `TokenInvalidError`, `TokenRevokedError` and a 401).
- NSID defined twice (see design notes).
- `/reviews` had no link home for a dead session.

Deferred:
- Typed input is lost when a submit fails. Sprint 3 builds the real form with client state.
- `?error=` text can be spoofed by a crafted link (React escaping prevents XSS, not misleading text). Sprint 3 for `/reviews`; `/` is the existing Sprint 1 pattern and stays open.
- `/reviews` stops at 50 records with no notice. Sprint 4 adds cursor pagination.
- Records failing validation are hidden with no notice and cannot be deleted from the app. Only reachable through other clients or schema changes. Sprint 4.

### Sprint 2 Q&A (2026-11-06)

Passed by Kirby's decision after three rounds, answered unaided. Lexicon enforcement, CIDs and `swapRecord`, ownership and scopes held up on new scenarios. The remaining gap is tracing a failure through to what the user sees on screen; Sprint 3 rebuilds those paths.

Found during Q&A, not fixed:
- After the Sprint 6 rename, sessions from before the deploy hold the old scope and nothing tells the user to sign in again. A refused save may show the generic PDS error, and `/reviews` may show "No reviews yet" if the read succeeds. Status code and read behavior untested. Sprint 6.

## Sprint 3 notes (book search and review UI)

### Running

- `/search` is public. `/reviews/new?book=<work key>` and `/reviews` need a session.
- `OPENLIBRARY_URL` overrides the Open Library base URL. Point it at a dead address to simulate an outage.
- A dev server left running across these edits served a stale module (`isBookId is not a function`) though its compiled chunks were correct. Restart it after pulling this branch.

### Open Library

Sources: openlibrary.org/dev/docs/api/search, /developers/api, /dev/docs/api/covers, live requests on 2026-11-06.

- `/search.json?q=&fields=&limit=` returns `numFound` and `docs`. No hits is a 200 with `docs: []`. A stopword-only query (`q=the`) is a 422 with a different body, shown as its own message.
- One work by key: `q=key:/works/<id>` through search. `/works/<id>.json` returns author keys rather than names, and has `-1` entries in `covers`.
- Rate limits: 1 request/second by default, 3 for clients whose User-Agent includes an email or phone number. Kirby's decision (2026-11-06): the User-Agent carries only the app name and URL, so the lower limit probably applies (inferred, not measured).
- Covers: cover-ID lookups are outside the covers API's per-IP limit. An unknown ID returns a blank image.

### Design notes

- The review URL carries only the work key, and the server looks up title, authors and cover, so a crafted link cannot show the wrong book's details. These go in hidden inputs. A hand-edited POST could change them, but only in the sender's own repo, which they can write to directly anyway. The S5 indexer must still treat them as untrusted.
- Open Library data is clipped to the lexicon limits on the way in (title, author count and length), so an oversized book can still be reviewed.
- The cache is an in-process `Map`: 1 hour TTL, 500 entries, oldest evicted first, successes only. Lost on restart, which only costs a re-fetch.
- Covers are plain `<img>` tags loaded straight from Open Library by the browser.
- Actions return errors as `useActionState` state, so the form stays mounted. This closes both Sprint 2 deferrals for `/reviews` (lost input, spoofable `?error=`). `/?error=` remains.
- The forms use `onSubmit` rather than `<form action>`: React resets a form after an action, and a controlled `<select>` then falls back to its first option while state keeps the old value (caught by the browser run). Saving would have dropped the rating.
- `guarded()` catches rejected actions so they cannot reach an error boundary and lose the draft, and rethrows Next's redirect, which arrives as a rejection.
- `EditForm` and `ConfirmDelete` freeze the CID on mount, so a list refresh cannot move the `swapRecord` guard onto a version the user has not seen. Reviews are keyed by URI so that open drafts survive a refresh.

### Verified 2026-11-06

- Local production build against `bookshelf-test.bsky.social` on its real PDS: 58 browser checks pass, with repo state read independently through public `listRecords`. The script is not in the repo (automated end-to-end tests are out of v1 scope). Covers search, no hits, refused query, Open Library outage while signed in, publish, edit, delete, signed-out and offline submits, and stale tabs.
- Not yet run on `https://bookshelf.kirbyjayes.com`.
- `npm test`: 71 unit tests pass.

### Sprint 3 code review (2026-11-06, `/code-review` medium)

Fixed:
- A rejected action (offline, server error, retired action ID) replaced the page and lost the draft.
- An armed delete took the live CID, so a refresh could delete a version the user had not seen.
- A delete error persisted after Cancel.
- The client limit ignored the 50,000-byte cap and counted untrimmed text.
- Signed-out `/reviews` redirected home with no message.
- "That review no longer exists" now says to reload. The list deliberately does not refresh on failure: during a PDS outage the list read also fails, which would unmount open drafts.

Accepted:
- The review forms need JavaScript (the plan calls for client-state forms). The publish button stays disabled until hydration, so the form cannot submit by GET.

Deferred:
- `/search` has no rate limit, and concurrent identical queries are not coalesced, so one client can use up the shared Open Library allowance. Sprint 6, with `/login`.
- A signed-out user loses the chosen book at sign-in, because `/callback` always goes to `/`. Needs a validated return target through the OAuth flow. Sprint 6.
- Review dates show the UTC calendar day, not the reader's. Sprint 4, where dates become public.
- Cleanup: the `<article className="book">` markup repeats in three files (Sprint 4 adds a fourth use, so extract it then); clip limits in `lib/openlibrary.ts` have no lexicon sync test.
- A user can write several reviews of the same book; the plan does not forbid it. Revisit in Sprint 5 for the book page.
