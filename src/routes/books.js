const express = require('express');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { convertMobiToEpub } = require('../utils/convert');
const db = require('../db');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

// Content type mapping
const CONTENT_TYPES = {
  pdf: 'application/pdf',
  epub: 'application/epub+zip',
  txt: 'text/plain; charset=utf-8',
  mobi: 'application/x-mobipocket-ebook',
};

// --- List books (with optional search & format filter) --------------------
router.get('/', (req, res) => {
  const { q, format } = req.query;
  let sql = `SELECT * FROM books WHERE status = 'visible'`;
  const params = [];

  if (q) {
    sql += ` AND (title LIKE ? OR author LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }
  if (format) {
    sql += ` AND format = ?`;
    params.push(format);
  }

  sql += ` ORDER BY created_at DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// --- Get single book ------------------------------------------------------
router.get('/:id', (req, res) => {
  const book = db.prepare(`SELECT * FROM books WHERE id = ?`).get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found.' });
  res.json(book);
});

// --- Upload book ----------------------------------------------------------
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Please sign in to upload books.' });
  }

  const { title, author, description, isPublicDomain, rightsAttested } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No file provided.' });
  }

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  if (!isPublicDomain && !rightsAttested) {
    // Clean up uploaded file
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    return res.status(400).json({ error: 'You must confirm public domain or rights ownership.' });
  }

  // Determine format from extension
  const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
  const validFormats = ['pdf', 'epub', 'txt', 'mobi'];
  if (!validFormats.includes(ext)) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    return res.status(400).json({ error: 'Unsupported file format. Use PDF, EPUB, TXT, or MOBI.' });
  }

  const bookId = crypto.randomUUID();
  let storedFilename = req.file.filename;

  // Try to convert MOBI to EPUB if Calibre is available
  let finalFormat = ext;
  if (ext === 'mobi') {
    const epubPath = await convertMobiToEpub(req.file.path, UPLOAD_DIR);
    if (epubPath) {
      storedFilename = path.basename(epubPath);
      finalFormat = 'epub';
    }
  }

  const user = req.user;

  db.prepare(
    `INSERT INTO books (id, title, author, description, format, original_filename, stored_filename, uploader_id, uploader_name, uploader_avatar, rights_attested, is_public_domain)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    bookId,
    title.trim(),
    (author || 'Unknown').trim(),
    (description || '').trim(),
    finalFormat,
    req.file.originalname,
    storedFilename,
    user.id,
    user.username,
    user.avatar_url || '',
    rightsAttested ? 1 : 0,
    isPublicDomain ? 1 : 0
  );

  res.status(201).json({ id: bookId, format: finalFormat });
});

// --- Delete book (owner only) ---------------------------------------------
router.delete('/:id', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Please sign in to delete books.' });
  }

  const book = db.prepare(`SELECT * FROM books WHERE id = ?`).get(req.params.id);
  if (!book) {
    return res.status(404).json({ error: 'Book not found.' });
  }

  if (book.uploader_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete books you uploaded.' });
  }

  // Delete the file from disk
  const filePath = path.join(UPLOAD_DIR, book.stored_filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }

  // Delete related records
  db.prepare(`DELETE FROM reading_progress WHERE book_id = ?`).run(req.params.id);
  db.prepare(`DELETE FROM reports WHERE book_id = ?`).run(req.params.id);
  db.prepare(`DELETE FROM books WHERE id = ?`).run(req.params.id);

  res.json({ ok: true });
});

// --- Serve book file ------------------------------------------------------
router.get('/:id/file', (req, res) => {
  const book = db.prepare(`SELECT * FROM books WHERE id = ?`).get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found.' });

  const filePath = path.join(UPLOAD_DIR, book.stored_filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on disk.' });
  }

  const contentType = CONTENT_TYPES[book.format] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.sendFile(filePath);
});

// --- Report a book --------------------------------------------------------
router.post('/:id/report', (req, res) => {
  const book = db.prepare(`SELECT id FROM books WHERE id = ?`).get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found.' });

  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'A reason is required.' });
  }

  const reportId = crypto.randomUUID();
  db.prepare(`INSERT INTO reports (id, book_id, reason) VALUES (?, ?, ?)`).run(
    reportId,
    req.params.id,
    reason.trim()
  );

  // Auto-flag the book after 3 reports
  const count = db.prepare(`SELECT COUNT(*) as c FROM reports WHERE book_id = ?`).get(req.params.id).c;
  if (count >= 3) {
    db.prepare(`UPDATE books SET status = 'flagged' WHERE id = ?`).run(req.params.id);
  }

  res.json({ ok: true });
});

// --- Reading progress -----------------------------------------------------
router.post('/:id/progress/:clientId', (req, res) => {
  const { location } = req.body;
  const bookId = req.params.id;
  const clientId = req.params.clientId;

  try {
    db.prepare(
      `INSERT INTO reading_progress (id, book_id, client_id, location)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(book_id, client_id) DO UPDATE SET location = excluded.location, updated_at = datetime('now')`
    ).run(crypto.randomUUID(), bookId, clientId, location || '');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save progress.' });
  }
});

router.get('/:id/progress/:clientId', (req, res) => {
  const row = db.prepare(
    `SELECT location FROM reading_progress WHERE book_id = ? AND client_id = ?`
  ).get(req.params.id, req.params.clientId);
  res.json({ location: row ? row.location : '' });
});

// --- Books by a specific user ---------------------------------------------
router.get('/by-user/:userId', (req, res) => {
  const rows = db.prepare(
    `SELECT id, title, author, format, created_at FROM books WHERE uploader_id = ? AND status = 'visible' ORDER BY created_at DESC`
  ).all(req.params.userId);
  res.json(rows);
});

module.exports = router;
