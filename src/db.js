const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'library.db'));

// Check if old provider-based schema is present (lacks password_hash column)
let needsRecreate = false;
try {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasPasswordHash = columns.some(c => c.name === 'password_hash');
  if (columns.length > 0 && !hasPasswordHash) {
    needsRecreate = true;
  }
} catch (_) {
  // Table does not exist yet
}

if (needsRecreate) {
  console.log('🔄 Old OAuth schema detected. Recreating database tables for local authentication...');
  db.exec(`
    DROP TABLE IF EXISTS reading_progress;
    DROP TABLE IF EXISTS reports;
    DROP TABLE IF EXISTS books;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS follows;
    DROP TABLE IF EXISTS users;
  `);
}

db.exec(`
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
    format TEXT NOT NULL,          -- pdf | epub | txt | mobi
    genres TEXT DEFAULT '[]',      -- JSON array of genre strings
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL, -- the file actually served/read
    uploader_id TEXT,              -- references users.id; who posted this
    uploader_name TEXT DEFAULT 'Anonymous',
    uploader_avatar TEXT DEFAULT '',
    uploader_profile_url TEXT DEFAULT '',
    rights_attested INTEGER NOT NULL DEFAULT 0,
    is_public_domain INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'visible', -- visible | flagged | removed
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
`);

// --- Add genres column to books if missing --------------------------------
try {
  const bookColumns = db.prepare("PRAGMA table_info(books)").all();
  const hasGenres = bookColumns.some(c => c.name === 'genres');
  if (!hasGenres) {
    db.exec(`ALTER TABLE books ADD COLUMN genres TEXT DEFAULT '[]'`);
    console.log('✅ Added genres column to books table');
  }
} catch (err) {
  // safe to ignore
}

// --- Add ratings table if missing -----------------------------------------
try {
  db.exec(`CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(book_id, client_id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  )`);
} catch (_) {}

// --- Add google_id column if missing (for Google OAuth support) -----------
try {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasGoogleId = columns.some(c => c.name === 'google_id');
  if (!hasGoogleId) {
    db.exec(`ALTER TABLE users ADD COLUMN google_id TEXT`);
    console.log('✅ Added google_id column to users table');
  }
} catch (err) {
  // Column might already exist or table doesn't exist yet — safe to ignore
}

module.exports = db;

