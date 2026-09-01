const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

function requireAdmin(req, res, next) {
  const key = req.header('x-admin-key');
  if (!process.env.ADMIN_KEY) {
    return res.status(503).json({ error: 'Admin panel is disabled (no ADMIN_KEY configured).' });
  }
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Invalid admin key.' });
  }
  next();
}

// List everything (including flagged/removed) for review.
router.get('/books', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT * FROM books ORDER BY created_at DESC`).all();
  res.json(rows);
});

// List reports for a book.
router.get('/books/:id/reports', requireAdmin, (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM reports WHERE book_id = ? ORDER BY created_at DESC`)
    .all(req.params.id);
  res.json(rows);
});

// Take down a book (e.g. after a valid copyright complaint).
router.post('/books/:id/remove', requireAdmin, (req, res) => {
  const book = db.prepare(`SELECT * FROM books WHERE id = ?`).get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found.' });

  db.prepare(`UPDATE books SET status = 'removed' WHERE id = ?`).run(req.params.id);

  const filePath = path.join(UPLOAD_DIR, book.stored_filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }

  res.json({ ok: true });
});

// Restore a flagged book after review clears it.
router.post('/books/:id/restore', requireAdmin, (req, res) => {
  const book = db.prepare(`SELECT id FROM books WHERE id = ?`).get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found.' });
  db.prepare(`UPDATE books SET status = 'visible' WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
