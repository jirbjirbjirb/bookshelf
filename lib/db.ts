import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const g = globalThis as unknown as { __bookshelfDb?: Database.Database };

// open the db wit
export function getDb(): Database.Database {
  if (g.__bookshelfDb) return g.__bookshelfDb;
  const file = process.env.DB_FILE ?? "./data/app.db";
  mkdirSync(dirname(file), { recursive: true }); // open file, create if not existing
  const db = new Database(file); // create db from file

  // config Database
  db.pragma("journal_mode = WAL"); // write ahead so failure does not corrupt file
  db.pragma("busy_timeout = 5000"); // wait time during write if write is busy
  // auth_state table is temporary, saving state, PKCE material when logging in, these are read at /callback to verify requesting browser and returning browser are the same
  // auth_session row per logged-in user key:DID value: OAuth sesison data
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER NOT NULL); 
    CREATE TABLE IF NOT EXISTS auth_session (did TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);

  return (g.__bookshelfDb = db);
}
