import type {
  NodeSavedStateStore,
  NodeSavedSessionStore,
} from "@atproto/oauth-client-node";
import { getDb } from "./db";

const STATE_TTL_MS = 3_600_000;

type Stmts = ReturnType<typeof prepare>;
let cached: Stmts | undefined;
let cachedFor: unknown;

function prepare() {
  const db = getDb();
  // prepped actions on the db, ? values filled in when called and are not directly pasted into the SQL text (injection guard)
  return {
    stateGet: db.prepare(
      "SELECT value, expires_at FROM auth_state WHERE key = ?",
    ),
    stateSet: db.prepare(
      "INSERT OR REPLACE INTO auth_state (key, value, expires_at) VALUES (?, ?, ?)",
    ),
    stateDel: db.prepare("DELETE FROM auth_state WHERE key = ?"),
    statePurge: db.prepare("DELETE FROM auth_state WHERE expires_at < ?"),
    sessGet: db.prepare("SELECT value FROM auth_session WHERE did = ?"),
    sessSet: db.prepare(
      "INSERT OR REPLACE INTO auth_session (did, value) VALUES (?, ?)",
    ),
    sessDel: db.prepare("DELETE FROM auth_session WHERE did = ?"),
  };
}

function getStatements(): Stmts {
  const db = getDb();
  if (!cached || cachedFor !== db) {
    cached = prepare();
    cachedFor = db;
  }
  return cached;
}

// get/set/delete for state table (auth_state): short-lived rows for one login attempt.
// Called only by the OAuth client (see getOAuthClient in lib/oauth.ts): set by authorize(), get + del by callback().
export const stateStore: NodeSavedStateStore = {
  // get rows, delete expired instead of returning them
  get(key) {
    const row = getStatements().stateGet.get(key) as
      | { value: string; expires_at: number }
      | undefined;
    if (!row) return undefined;
    if (row.expires_at < Date.now()) {
      getStatements().stateDel.run(key);
      return undefined;
    }
    return JSON.parse(row.value);
  },
  set(key, value) {
    const now = Date.now();
    // purge any expired rows (might need scheduled job at larger scale instead, this could slow things down on a large db)
    getStatements().statePurge.run(now);
    // insert new rows
    getStatements().stateSet.run(
      key,
      JSON.stringify(value),
      now + STATE_TTL_MS,
    );
  },
  del(key) {
    // targeted delete
    getStatements().stateDel.run(key);
  },
};

// get/set/del for session table (auth_session): one long-lived row per signed-in DID (tokens + DPoP key).
// Called only by the OAuth client: set by callback() and after each token refresh, get by restore()/revoke(),
// del by revoke()/signOut() and when a session turns out to be revoked or unrefreshable.
export const sessionStore: NodeSavedSessionStore = {
  get(did) {
    const row = getStatements().sessGet.get(did) as
      | { value: string }
      | undefined;
    return row ? JSON.parse(row.value) : undefined;
  },
  set(did, value) {
    getStatements().sessSet.run(did, JSON.stringify(value));
  },
  del(did) {
    getStatements().sessDel.run(did);
  },
};
