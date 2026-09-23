const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

/**
 * Database layer with three storage modes, chosen automatically:
 *
 *  1. Cloud mode — TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) set: every query
 *     runs against a persistent Turso/libSQL database. Most robust option.
 *  2. Blob mode — on Vercel with BLOB_READ_WRITE_TOKEN and SESSION_SECRET set:
 *     the SQLite file is pulled (decrypted) from Vercel Blob at cold start and
 *     flushed (encrypted) back after every write. Survives deploys and is
 *     shared across instances; concurrent writers resolve last-write-wins.
 *  3. Local mode — plain file database (data/library.db when developing).
 *
 * The API mirrors the old `db.prepare(sql).get/all/run(...)` shape, except
 * every call returns a Promise — call sites `await` it.
 */

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || undefined;
const useCloud = !!(TURSO_URL && TURSO_TOKEN);

const DB_BLOB_KEY = process.env.DB_BLOB_KEY || 'db/library.db.enc';
const useBlob =
  !useCloud &&
  !!process.env.VERCEL &&
  !!process.env.BLOB_READ_WRITE_TOKEN &&
  !!process.env.SESSION_SECRET;

let blob = null;
if (useBlob) blob = require('@vercel/blob');

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'library.db');

let cloud = null;
let sqlite = null;

if (useCloud) {
  const { createClient } = require('@libsql/client');
  cloud = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  console.log('✅ Using persistent Turso cloud database');
} else {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (process.env.VERCEL && !useBlob) {
    console.warn(
      '⚠️  No BLOB_READ_WRITE_TOKEN/SESSION_SECRET — falling back to ephemeral /tmp database. Data will NOT survive deploys.'
    );
  }
}

// --- blob persistence helpers ----------------------------------------------

function cipherKey() {
  return crypto.createHash('sha256').update(String(process.env.SESSION_SECRET)).digest();
}

function encrypt(buf) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey(), iv);
  const body = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function decrypt(buf) {
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const body = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', cipherKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

function isNotFound(err) {
  if (!err) return false;
  return (
    err.name === 'BlobNotFoundError' ||
    err.name === 'BlobStoreNotFoundError' ||
    /not found/i.test(String(err.message || ''))
  );
}

function openSqlite() {
  const { DatabaseSync } = require('node:sqlite');
  sqlite = new DatabaseSync(DB_PATH);
}

let remoteStamp = null; // uploadedAt of the blob copy we last synced with
let dirty = false; // local writes not yet pushed
let lastCheckAt = 0;
let booted = false;

/** Download + decrypt the persisted database into /tmp (cold start). */
async function pullFromBlob() {
  try {
    const meta = await blob.head(DB_BLOB_KEY);
    const res = await fetch(meta.url);
    if (!res.ok) throw new Error(`blob download failed: ${res.status}`);
    fs.writeFileSync(DB_PATH, decrypt(Buffer.from(await res.arrayBuffer())));
    remoteStamp = meta.uploadedAt || null;
    dirty = false;
    console.log('✅ Loaded persisted database from Blob');
    return true;
  } catch (err) {
    if (isNotFound(err)) {
      console.log('ℹ️  No persisted database in Blob yet — starting fresh');
      return false;
    }
    console.warn('⚠️  Could not load database from Blob:', err.message);
    return false;
  }
}

let pushQueue = Promise.resolve();

/** Encrypt + upload the local database. Serialized so writes never interleave. */
function pushToBlob() {
  pushQueue = pushQueue.then(async () => {
    const plain = fs.readFileSync(DB_PATH);
    const meta = await blob.put(DB_BLOB_KEY, encrypt(plain), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/octet-stream',
    });
    remoteStamp = meta.uploadedAt || new Date().toISOString();
    dirty = false;
  });
  return pushQueue;
}

/**
 * Before writing, refresh from blob if another instance has pushed since we
 * last synced — keeps stale instances from clobbering newer data. Throttled
 * so a burst of writes only checks once.
 */
async function refreshIfStale() {
  if (!useBlob || dirty) return;
  const now = Date.now();
  if (now - lastCheckAt < 15000) return;
  lastCheckAt = now;
  try {
    const meta = await blob.head(DB_BLOB_KEY);
    if (remoteStamp && meta.uploadedAt === remoteStamp) return;
    const res = await fetch(meta.url);
    if (!res.ok) return;
    fs.writeFileSync(DB_PATH, decrypt(Buffer.from(await res.arrayBuffer())));
    remoteStamp = meta.uploadedAt || null;
    try { sqlite.close(); } catch (_) {}
    openSqlite();
    console.log('🔄 Refreshed database from Blob (another instance wrote)');
  } catch (err) {
    if (!isNotFound(err)) console.warn('⚠️  Blob refresh failed:', err.message);
  }
}

async function persistAfterWrite() {
  if (!useBlob || !booted) return; // boot does a single push when it finishes
  dirty = true;
  try {
    await pushToBlob();
  } catch (err) {
    console.warn('⚠️  Could not persist database to Blob:', err.message);
  }
}

const MUTATION = /^\s*(insert|update|delete|replace|create|alter|drop)\b/i;
const isMutation = (sql) => MUTATION.test(sql);

// --- raw drivers (bypass the boot gate; used by the boot sequence itself) ---

async function rawExec(sql) {
  if (cloud) return cloud.executeMultiple(sql);
  if (isMutation(sql)) await refreshIfStale();
  const out = sqlite.exec(sql);
  await persistAfterWrite();
  return out;
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
  if (isMutation(sql)) await refreshIfStale();
  const out = sqlite.prepare(sql).run(...params);
  await persistAfterWrite();
  return out;
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
  if (!cloud) {
    if (useBlob) await pullFromBlob();
    openSqlite();
  }

  // Recreate tables if an old OAuth-only schema (no password_hash) is found.
  try {
    const columns = await tableColumns('users');
    if (columns.length > 0 && !columns.some((c) => c.name === 'password_hash')) {
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
    const names = cols.map((c) => c.name);
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
    if (!cols.some((c) => c.name === 'google_id')) {
      await rawRun(`ALTER TABLE users ADD COLUMN google_id TEXT`, []);
      console.log('✅ Added google_id column to users table');
    }
  } catch (_) {}

  // One flush for the whole boot sequence (schema/migrations above).
  if (useBlob) {
    try {
      await pushToBlob();
    } catch (err) {
      console.warn('⚠️  Could not persist database to Blob:', err.message);
    }
  }
  booted = true;
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

module.exports = { prepare, exec, useCloud, useBlob };
