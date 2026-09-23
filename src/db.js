const path = require('node:path');
const fs = require('node:fs');

/**
 * Dual-mode database layer.
 *
 *  - Cloud mode: when TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) is set, every
 *    query runs against a persistent Turso/libSQL database. This is what
 *    makes data survive Vercel deploys and cold starts.
 *  - Local mode: a node:sqlite file database (data/library.db locally, or
 *    /tmp on Vercel when no cloud credentials are configured — ephemeral,
 *    but keeps the app running during setup).
 *
 * The API mirrors the old `db.prepare(sql).get/all/run(...)` shape, except
 * every call returns a Promise — call sites `await` it.
 */

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || undefined;
const useCloud = !!(TURSO_URL && TURSO_TOKEN);

let cloud = null;
let sqlite = null;

if (useCloud) {
  const { createClient } = require('@libsql/client');
  cloud = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  console.log('✅ Using persistent Turso cloud database');
} else {
  const { DatabaseSync } = require('node:sqlite');
  const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  sqlite = new DatabaseSync(path.join(DATA_DIR, 'library.db'));
  if (process.env.VERCEL) {
    console.warn('⚠️  TURSO_DATABASE_URL not set — falling back to ephemeral /tmp database. Data will NOT survive deploys.');
  }
}

// --- raw drivers (bypass the boot gate; used by the boot sequence itself) --

async function rawExec(sql) {
  if (cloud) return cloud.executeMultiple(sql);
  return sqlite.exec(sql);
}

async function rawAll(sql, params) {
  if (cloud) {
    const rs = await cloud.execute({ sql, args: params });
    return rs.rows;
  }
  return sqlite.prepare(sql).all(...params);
}

async function rawGet(sql, params) {
  if (cloud) {
    const rs = await cloud.execute({ sql, args: params });
    return rs.rows[0]; // undefined when no row, like node:sqlite
  }
  return sqlite.prepare(sql).get(...params);
}

async function rawRun(sql, params) {
  if (cloud) return cloud.execute({ sql, args: params });
  return sqlite.prepare(sql).run(...params);
}

// --- schema + migrations (idempotent) --------------------------------------

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    age INTEGER,
    gender TEXT,
    pronouns TEXT,
    avatar_url TEXT DEFAULT '',
    instagram_handle TEXT DEFAULT '',
    otp TEXT,
    otp_expires_at INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL,
    following_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES users(id),
    FOREIGN KEY (following_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT DEFAULT 'Unknown',
    description TEXT DEFAULT '',
    format TEXT NOT NULL,
    genres TEXT DEFAULT '[]',
    language TEXT DEFAULT 'English',
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    uploader_id TEXT,
    uploader_name TEXT DEFAULT 'Anonymous',
    uploader_avatar TEXT DEFAULT '',
    uploader_profile_url TEXT DEFAULT '',
    rights_attested INTEGER NOT NULL DEFAULT 0,
    is_public_domain INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'visible',
    file_size INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (uploader_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS reading_progress (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(book_id, client_id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(book_id, client_id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    label TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS reading_stats (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    time_spent INTEGER NOT NULL DEFAULT 0,
    location TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );
`;

async function tableColumns(table) {
  // pragma table-valued function works on both node:sqlite and libSQL/Turso
  return rawAll(`SELECT name FROM pragma_table_info('${table}')`, []);
}

const ready = (async () => {
  // Recreate tables if an old OAuth-only schema (no password_hash) is found.
  try {
    const columns = await tableColumns('users');
    if (columns.length > 0 && !columns.some(c => c.name === 'password_hash')) {
      console.log('🔄 Old OAuth schema detected. Recreating database tables...');
      await rawExec(`
        DROP TABLE IF EXISTS reading_progress;
        DROP TABLE IF EXISTS reports;
        DROP TABLE IF EXISTS bookmarks;
        DROP TABLE IF EXISTS reading_stats;
        DROP TABLE IF EXISTS ratings;
        DROP TABLE IF EXISTS books;
        DROP TABLE IF EXISTS sessions;
        DROP TABLE IF EXISTS follows;
        DROP TABLE IF EXISTS users;
      `);
    }
  } catch (_) {
    // table does not exist yet — nothing to migrate
  }

  await rawExec(SCHEMA);

  // Incremental column migrations (idempotent, cheap no-ops once applied).
  try {
    const cols = await tableColumns('books');
    const names = cols.map(c => c.name);
    if (!names.includes('language')) {
      await rawRun(`ALTER TABLE books ADD COLUMN language TEXT DEFAULT 'English'`, []);
      console.log('✅ Added language column to books table');
    }
    if (!names.includes('genres')) {
      await rawRun(`ALTER TABLE books ADD COLUMN genres TEXT DEFAULT '[]'`, []);
      console.log('✅ Added genres column to books table');
    }
  } catch (_) {}

  try {
    const cols = await tableColumns('users');
    if (!cols.some(c => c.name === 'google_id')) {
      await rawRun(`ALTER TABLE users ADD COLUMN google_id TEXT`, []);
      console.log('✅ Added google_id column to users table');
    }
  } catch (_) {}
})();

// --- public API -------------------------------------------------------------

function prepare(sql) {
  return {
    async get(...params) {
      await ready;
      return rawGet(sql, params);
    },
    async all(...params) {
      await ready;
      return rawAll(sql, params);
    },
    async run(...params) {
      await ready;
      return rawRun(sql, params);
    },
  };
}

async function exec(sql) {
  await ready;
  return rawExec(sql);
}

module.exports = { prepare, exec, useCloud };
