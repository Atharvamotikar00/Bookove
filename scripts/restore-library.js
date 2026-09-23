/**
 * One-shot restore: push the local library (database + book files + avatars)
 * into Vercel Blob so production can load it at cold start.
 *
 * Usage:
 *   vercel env pull .env.vercel      # gets BLOB_READ_WRITE_TOKEN + SESSION_SECRET
 *   node scripts/restore-library.js
 *
 * The database is encrypted with AES-256-GCM keyed by SESSION_SECRET, the
 * same scheme src/db.js uses to read it back.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// --- load environment (.env.vercel or .env) --------------------------------
function loadEnv(file) {
  if (!fs.existsSync(file)) return false;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return true;
}

if (!loadEnv('.env.vercel')) loadEnv('.env');

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const SECRET = process.env.SESSION_SECRET;
if (!TOKEN) {
  console.error('❌ BLOB_READ_WRITE_TOKEN not found. Run: vercel env pull .env.vercel');
  process.exit(1);
}
if (!SECRET) {
  console.error('❌ SESSION_SECRET not found (needed to encrypt the database).');
  process.exit(1);
}

const blob = require('@vercel/blob');
const { DatabaseSync } = require('node:sqlite');

const DB_FILE = path.join(__dirname, '..', 'data', 'library.db');
const UPLOADS = path.join(__dirname, '..', 'uploads');
const DB_BLOB_KEY = process.env.DB_BLOB_KEY || 'db/library.db.enc';

function cipherKey() {
  return crypto.createHash('sha256').update(String(SECRET)).digest();
}

function encrypt(buf) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey(), iv);
  const body = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

async function put(key, data, contentType) {
  const res = await blob.put(key, data, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    token: TOKEN,
    ...(contentType ? { contentType } : {}),
  });
  return res.url;
}

async function fileExists(p) {
  try {
    await fs.promises.stat(p);
    return true;
  } catch (_) {
    return false;
  }
}

(async () => {
  let uploaded = 0;
  let skipped = 0;

  // 1. The database itself (encrypted).
  if (await fileExists(DB_FILE)) {
    const enc = encrypt(fs.readFileSync(DB_FILE));
    await put(DB_BLOB_KEY, enc, 'application/octet-stream');
    console.log(`✅ database -> ${DB_BLOB_KEY} (${enc.length} bytes encrypted)`);
  } else {
    console.log(`⚠️  no local database at ${DB_FILE} — skipping`);
  }

  // 2. Book files referenced by the books table.
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const books = db.prepare('SELECT stored_filename, title FROM books').all();
  for (const b of books) {
    const local = path.join(UPLOADS, b.stored_filename);
    if (!(await fileExists(local))) {
      console.log(`⚠️  missing file for "${b.title}": ${b.stored_filename}`);
      skipped++;
      continue;
    }
    await put('books/' + b.stored_filename, fs.createReadStream(local));
    uploaded++;
  }

  // 3. Avatars referenced by users (avatar_url is /auth/avatar/<filename>).
  const users = db.prepare("SELECT username, avatar_url FROM users WHERE avatar_url IS NOT NULL AND avatar_url != ''").all();
  for (const u of users) {
    const m = String(u.avatar_url).match(/\/auth\/avatar\/([^/?#]+)/);
    if (!m) continue;
    const local = path.join(UPLOADS, m[1]);
    if (!(await fileExists(local))) {
      console.log(`⚠️  missing avatar for ${u.username}: ${m[1]}`);
      skipped++;
      continue;
    }
    await put('avatars/' + m[1], fs.createReadStream(local));
    uploaded++;
  }

  db.close();
  console.log(`\nDone: ${uploaded} files uploaded, ${skipped} missing.`);
  console.log('Next: commit + push (or run `vercel --prod`) so production reloads.');
})();
