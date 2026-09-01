const session = require('express-session');
const db = require('./db');

/**
 * A minimal express-session Store backed by our existing node:sqlite
 * database. Avoids pulling in connect-sqlite3 (which depends on the
 * native `sqlite3` package and hits the same native-compile problems
 * we avoided for the main DB).
 */
class SqliteSessionStore extends session.Store {
  constructor(options = {}) {
    super(options);
    this.ttlMs = options.ttlMs || 1000 * 60 * 60 * 24 * 14; // 14 days default

    // Clear out anything expired on startup, and periodically after that.
    this._prune();
    this._pruneInterval = setInterval(() => this._prune(), 1000 * 60 * 30);
    this._pruneInterval.unref?.();
  }

  _prune() {
    try {
      db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(Date.now());
    } catch (_) {}
  }

  get(sid, callback) {
    try {
      const row = db.prepare(`SELECT data, expires_at FROM sessions WHERE sid = ?`).get(sid);
      if (!row || row.expires_at < Date.now()) return callback(null, null);
      callback(null, JSON.parse(row.data));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sessionData, callback) {
    try {
      const expiresAt = Date.now() + this.ttlMs;
      const data = JSON.stringify(sessionData);
      db.prepare(
        `INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at`
      ).run(sid, data, expiresAt);
      callback && callback(null);
    } catch (err) {
      callback && callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      db.prepare(`DELETE FROM sessions WHERE sid = ?`).run(sid);
      callback && callback(null);
    } catch (err) {
      callback && callback(err);
    }
  }

  touch(sid, sessionData, callback) {
    this.set(sid, sessionData, callback);
  }
}

module.exports = SqliteSessionStore;
