const { randomUUID } = require('node:crypto');
const crypto = require('node:crypto');
const db = require('../db');

async function findById(id) {
  const row = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
  return row || null;
}

async function findByUsername(username) {
  const row = await db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
  return row || null;
}

async function findByEmail(email) {
  const row = await db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
  return row || null;
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

async function create(username, password, email, age, gender, pronouns, instagramHandle = '', avatarUrl = '') {
  const id = randomUUID();
  const passwordHash = hashPassword(password);

  await db.prepare(
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

async function updateProfile(id, data) {
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
  await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  return findById(id);
}

async function updatePassword(id, password) {
  const passwordHash = hashPassword(password);
  await db.prepare(`UPDATE users SET password_hash = ?, otp = NULL, otp_expires_at = NULL WHERE id = ?`).run(passwordHash, id);
  return true;
}

async function setOtp(email, otp, expiresAt) {
  await db.prepare(`UPDATE users SET otp = ?, otp_expires_at = ? WHERE email = ?`).run(
    otp,
    expiresAt,
    email.trim().toLowerCase()
  );
  return true;
}

async function clearOtp(email) {
  await db.prepare(`UPDATE users SET otp = NULL, otp_expires_at = NULL WHERE email = ?`).run(
    email.trim().toLowerCase()
  );
  return true;
}

async function verifyOtp(email, otp) {
  const user = await findByEmail(email);
  if (!user || !user.otp || !user.otp_expires_at) return false;
  if (user.otp !== otp) return false;
  if (Date.now() > user.otp_expires_at) return false;
  return true;
}

// --- Following and Followers ---
async function isFollowing(followerId, followingId) {
  const row = await db.prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?`).get(followerId, followingId);
  return !!row;
}

async function follow(followerId, followingId) {
  if (followerId === followingId) return false;
  try {
    await db.prepare(`INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)`).run(followerId, followingId);
    return true;
  } catch (_) {
    return false;
  }
}

async function unfollow(followerId, followingId) {
  await db.prepare(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?`).run(followerId, followingId);
  return true;
}

async function getFollowInfo(profileUserId, currentUserId = null) {
  const followers = await db.prepare(`SELECT COUNT(*) as count FROM follows WHERE following_id = ?`).get(profileUserId);
  const following = await db.prepare(`SELECT COUNT(*) as count FROM follows WHERE follower_id = ?`).get(profileUserId);
  const isFollowingUser = currentUserId ? await isFollowing(currentUserId, profileUserId) : false;

  return {
    followersCount: followers.count,
    followingCount: following.count,
    isFollowing: isFollowingUser
  };
}

// --- Google OAuth user creation/lookup -------------------------------------
async function findOrCreateGoogleUser(profile) {
  const googleId = profile.id;
  const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
  const displayName = profile.displayName || (email ? email.split('@')[0] : 'google_user');
  const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : '';

  // Check if a user with this google_id already exists
  let user = await db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
  if (user) return user;

  // Check if a user with this email already exists — link the Google account
  if (email) {
    user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (user) {
      await db.prepare('UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?').run(
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
  let baseUsername = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_') || 'google_user';
  let username = baseUsername;
  let counter = 1;
  while (await findByUsername(username)) {
    username = baseUsername + '_' + counter;
    counter++;
  }

  await db.prepare(
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
