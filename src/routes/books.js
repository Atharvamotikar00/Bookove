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

// --- List books (with optional search, format, genre, trending filter) -----
router.get('/', (req, res) => {
  const { q, format, genre, language, sort } = req.query;

  // Trending sort: join reading_progress to count reads per book
  if (sort === 'trending') {
    let sql = `
      SELECT b.*, COUNT(rp.id) as read_count
      FROM books b
      LEFT JOIN reading_progress rp ON rp.book_id = b.id
      WHERE b.status = 'visible'`;
    const params = [];

    if (q) {
      sql += ` AND (b.title LIKE ? OR b.author LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }
    if (format) {
      sql += ` AND b.format = ?`;
      params.push(format);
    }
    if (genre) {
      sql += ` AND b.genres LIKE ?`;
      params.push(`%"${genre}"%`);
    }
    if (language) {
      sql += ` AND b.language = ?`;
      params.push(language);
    }

    sql += ` GROUP BY b.id ORDER BY read_count DESC, b.created_at DESC`;
    return res.json(db.prepare(sql).all(...params));
  }

  if (sort === 'hidden-gems') {
    let sql = `
      SELECT b.*, COUNT(rp.id) as read_count
      FROM books b
      LEFT JOIN reading_progress rp ON rp.book_id = b.id
      WHERE b.status = 'visible'`;
    const params = [];

    if (q) {
      sql += ` AND (b.title LIKE ? OR b.author LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }
    if (format) {
      sql += ` AND b.format = ?`;
      params.push(format);
    }
    if (genre) {
      sql += ` AND b.genres LIKE ?`;
      params.push(`%"${genre}"%`);
    }
    if (language) {
      sql += ` AND b.language = ?`;
      params.push(language);
    }

    sql += ` GROUP BY b.id ORDER BY read_count ASC, b.created_at DESC`;
    return res.json(db.prepare(sql).all(...params));
  }

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
  if (genre) {
    sql += ` AND genres LIKE ?`;
    params.push(`%"${genre}"%`);
  }
  if (language) {
    sql += ` AND language = ?`;
    params.push(language);
  }

  sql += ` ORDER BY created_at DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// --- Upload book ----------------------------------------------------------
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Please sign in to upload books.' });
  }

  const { title, author, description, isPublicDomain, rightsAttested, genres, language } = req.body;

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

  // Parse genres — accept JSON array or comma-separated string
  let genresArr = [];
  if (genres) {
    try {
      genresArr = typeof genres === 'string' ? JSON.parse(genres) : genres;
      if (!Array.isArray(genresArr)) genresArr = [];
    } catch {
      genresArr = genres.split(',').map(g => g.trim()).filter(Boolean);
    }
  }

  db.prepare(
    `INSERT INTO books (id, title, author, description, format, genres, language, original_filename, stored_filename, uploader_id, uploader_name, uploader_avatar, rights_attested, is_public_domain)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    bookId,
    title.trim(),
    (author || 'Unknown').trim(),
    (description || '').trim(),
    finalFormat,
    JSON.stringify(genresArr),
    (language || 'English').trim(),
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
    `SELECT id, title, author, format, genres, created_at FROM books WHERE uploader_id = ? AND status = 'visible' ORDER BY created_at DESC`
  ).all(req.params.userId);
  res.json(rows);
});

// --- Genre breakdown for a user -------------------------------------------
router.get('/genre-stats/:userId', (req, res) => {
  const rows = db.prepare(
    `SELECT genres FROM books WHERE uploader_id = ? AND status = 'visible'`
  ).all(req.params.userId);

  const counts = {};
  rows.forEach(row => {
    try {
      const arr = JSON.parse(row.genres || '[]');
      if (Array.isArray(arr)) {
        arr.forEach(g => {
          const key = g.trim().toLowerCase();
          if (key) counts[key] = (counts[key] || 0) + 1;
        });
      }
    } catch {}
  });

  // Sort by count descending
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([genre, count]) => ({ genre, count }));

  res.json(sorted);
});

// --- Trending books (top N most-read) -------------------------------------
router.get('/trending', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
  const rows = db.prepare(`
    SELECT b.id, b.title, b.author, b.format, b.genres,
           COUNT(rp.id) as read_count
    FROM books b
    LEFT JOIN reading_progress rp ON rp.book_id = b.id
    WHERE b.status = 'visible'
    GROUP BY b.id
    ORDER BY read_count DESC, b.created_at DESC
    LIMIT ?
  `).all(limit);
  res.json(rows);
});

// --- Recommendations: books in genres the current user reads most ----------
router.get('/recommended', (req, res) => {
  const clientId = req.query.clientId;
  const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);

  let topGenres = [];
  if (req.user) {
    topGenres = db.prepare(`
      SELECT b.genres, COUNT(rp.id) as read_count
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.client_id = ?
      GROUP BY b.id
      ORDER BY read_count DESC
    `).all(clientId || req.user.id);
  } else if (clientId) {
    topGenres = db.prepare(`
      SELECT b.genres, COUNT(rp.id) as read_count
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.client_id = ?
      GROUP BY b.id
      ORDER BY read_count DESC
    `).all(clientId);
  }

  const genreCounts = {};
  topGenres.forEach(row => {
    try {
      const arr = JSON.parse(row.genres || '[]');
      if (Array.isArray(arr)) {
        arr.forEach(g => {
          const key = g.trim().toLowerCase();
          if (key) genreCounts[key] = (genreCounts[key] || 0) + 1;
        });
      }
    } catch {}
  });

  const sortedGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g);

  if (!sortedGenres.length) {
    const rows = db.prepare(`
      SELECT * FROM books WHERE status = 'visible'
      ORDER BY created_at DESC LIMIT ?
    `).all(limit);
    return res.json({ genres: [], books: rows });
  }

  const likeClauses = sortedGenres.map(() => `genres LIKE ?`).join(' OR ');
  const likeParams = sortedGenres.map(g => `%"${g}"%`);

  const rows = db.prepare(`
    SELECT * FROM books
    WHERE status = 'visible' AND (${likeClauses})
    ORDER BY created_at DESC
    LIMIT ?
  `).all(...likeParams, limit);

  res.json({ genres: sortedGenres, books: rows });
});

// --- Highly rated books ---------------------------------------------------
router.get('/highly-rated', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
  const rows = db.prepare(`
    SELECT b.*, ROUND(AVG(r.rating), 1) as avg_rating, COUNT(r.id) as total_ratings
    FROM books b
    JOIN ratings r ON r.book_id = b.id
    WHERE b.status = 'visible'
    GROUP BY b.id
    HAVING total_ratings >= 1
    ORDER BY avg_rating DESC, total_ratings DESC
    LIMIT ?
  `).all(limit);
  res.json(rows);
});

// --- Rating: submit a rating (1-5 stars) ----------------------------------
router.post('/:id/rate', (req, res) => {
  const { rating, clientId } = req.body;
  const bookId = req.params.id;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
  }

  if (!clientId) {
    return res.status(400).json({ error: 'Client ID is required.' });
  }

  const book = db.prepare(`SELECT id FROM books WHERE id = ?`).get(bookId);
  if (!book) return res.status(404).json({ error: 'Book not found.' });

  const ratingId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO ratings (id, book_id, client_id, rating)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(book_id, client_id) DO UPDATE SET rating = excluded.rating, created_at = datetime('now')
  `).run(ratingId, bookId, clientId, Math.round(rating));

  // Return updated average
  const stats = db.prepare(`
    SELECT ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as total
    FROM ratings WHERE book_id = ?
  `).get(bookId);

  res.json({ ok: true, avgRating: stats.avg_rating || 0, totalRatings: stats.total });
});

// --- Rating: get average for a book ----------------------------------------
router.get('/:id/rating', (req, res) => {
  const bookId = req.params.id;
  const stats = db.prepare(`
    SELECT ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as total
    FROM ratings WHERE book_id = ?
  `).get(bookId);

  const userRating = req.query.clientId
    ? db.prepare(`SELECT rating FROM ratings WHERE book_id = ? AND client_id = ?`).get(bookId, req.query.clientId)
    : null;

  res.json({
    avgRating: stats.avg_rating || 0,
    totalRatings: stats.total,
    userRating: userRating ? userRating.rating : null
  });
});

// --- Rating: get average for multiple books (for grid display) --------------
router.post('/ratings-batch', (req, res) => {
  const { bookIds, clientId } = req.body;
  if (!Array.isArray(bookIds) || !bookIds.length) return res.json({});

  const placeholders = bookIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT book_id, ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as total
    FROM ratings WHERE book_id IN (${placeholders})
    GROUP BY book_id
  `).all(...bookIds);

  const result = {};
  rows.forEach(r => {
    result[r.book_id] = { avgRating: r.avg_rating, totalRatings: r.total };
  });

  res.json(result);
});

// --- Get single book (MUST be after all named routes) --------------------
router.get('/:id', (req, res) => {
  const book = db.prepare(`SELECT * FROM books WHERE id = ?`).get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found.' });
  res.json(book);
});

module.exports = router;
