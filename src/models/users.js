const { randomUUID } = require('node:crypto');
const crypto = require('node:crypto');
const db = require('../db');

function findById(id) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) || null;
}

function findByUsername(username) {
  return db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) || null;
}

function findByEmail(email) {
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) || null;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

function create(username, password, email, age, gender, pronouns, instagramHandle = '', avatarUrl = '') {
  const id = randomUUID();
  const passwordHash = hashPassword(password);
  
  db.prepare(
    `INSERT INTO users (id, username, password_hash, email, age, gender, pronouns, instagram_handle, avatar_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    username.trim(),
    passwordHash,
    email.trim().toLowerCase(),
    age ? parseInt(age, 10) : null,
    gender ? gender.trim() : null,
    pronouns ? pronouns.trim() : null,
    instagramHandle.trim(),
    avatarUrl
  );
  
  return findById(id);
}

function updateProfile(id, data) {
  const fields = [];
  const params = [];
  
  if (data.age !== undefined) {
    fields.push('age = ?');
    params.push(data.age ? parseInt(data.age, 10) : null);
  }
  if (data.gender !== undefined) {
    fields.push('gender = ?');
    params.push(data.gender ? data.gender.trim() : null);
  }
  if (data.pronouns !== undefined) {
    fields.push('pronouns = ?');
    params.push(data.pronouns ? data.pronouns.trim() : null);
  }
  if (data.instagramHandle !== undefined) {
    fields.push('instagram_handle = ?');
    params.push(data.instagramHandle.trim());
  }
  if (data.avatarUrl !== undefined) {
    fields.push('avatar_url = ?');
    params.push(data.avatarUrl);
  }
  
  if (fields.length === 0) return findById(id);
  
  params.push(id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  
  return findById(id);
}

function updatePassword(id, password) {
  const passwordHash = hashPassword(password);
  db.prepare(`UPDATE users SET password_hash = ?, otp = NULL, otp_expires_at = NULL WHERE id = ?`).run(passwordHash, id);
  return true;
}

function setOtp(email, otp, expiresAt) {
  db.prepare(`UPDATE users SET otp = ?, otp_expires_at = ? WHERE email = ?`).run(
    otp,
    expiresAt,
    email.trim().toLowerCase()
  );
  return true;
}

function clearOtp(email) {
  db.prepare(`UPDATE users SET otp = NULL, otp_expires_at = NULL WHERE email = ?`).run(
    email.trim().toLowerCase()
  );
  return true;
}

function verifyOtp(email, otp) {
  const user = findByEmail(email);
  if (!user || !user.otp || !user.otp_expires_at) return false;
  if (user.otp !== otp) return false;
  if (Date.now() > user.otp_expires_at) return false;
  return true;
}

// --- Following and Followers ---
function isFollowing(followerId, followingId) {
  const row = db.prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?`).get(followerId, followingId);
  return !!row;
}

function follow(followerId, followingId) {
  if (followerId === followingId) return false;
  try {
    db.prepare(`INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)`).run(followerId, followingId);
    return true;
  } catch (_) {
    return false;
  }
}

function unfollow(followerId, followingId) {
  db.prepare(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?`).run(followerId, followingId);
  return true;
}

function getFollowInfo(profileUserId, currentUserId = null) {
  const followersCount = db.prepare(`SELECT COUNT(*) as count FROM follows WHERE following_id = ?`).get(profileUserId).count;
  const followingCount = db.prepare(`SELECT COUNT(*) as count FROM follows WHERE follower_id = ?`).get(profileUserId).count;
  const isFollowingUser = currentUserId ? isFollowing(currentUserId, profileUserId) : false;
  
  return {
    followersCount,
    followingCount,
    isFollowing: isFollowingUser
  };
}

// --- Google OAuth user creation/lookup -------------------------------------
function findOrCreateGoogleUser(profile) {
  const googleId = profile.id;
  const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
  const displayName = profile.displayName || (email ? email.split('@')[0] : 'google_user');
  const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : '';

  // Check if a user with this google_id already exists
  let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
  if (user) return user;

  // Check if a user with this email already exists — link the Google account
  if (email) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (user) {
      db.prepare('UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?').run(
        googleId,
        avatarUrl || user.avatar_url,
        user.id
      );
      return findById(user.id);
    }
  }

  // Create a new user from Google data
  const id = randomUUID();
  // Generate a unique username from display name
  let baseUsername = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
  let username = baseUsername;
  let counter = 1;
  while (findByUsername(username)) {
    username = baseUsername + '_' + counter;
    counter++;
  }

  db.prepare(
    `INSERT INTO users (id, username, password_hash, email, avatar_url, google_id)
     VALUES (?, ?, '', ?, ?, ?)`
  ).run(id, username, email || '', avatarUrl, googleId);

  return findById(id);
}

module.exports = {
  findById,
  findByUsername,
  findByEmail,
  create,
  findOrCreateGoogleUser,
  updateProfile,
  updatePassword,
  verifyPassword,
  setOtp,
  clearOtp,
  verifyOtp,
  follow,
  unfollow,
  getFollowInfo
};

