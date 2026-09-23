const express = require('express');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const passport = require('../auth/passport');
const users = require('../models/users');
const { sendOtpEmail } = require('../utils/email');
const { blobEnabled, saveFile, AVATARS_PREFIX } = require('../utils/storage');

const router = express.Router();

const UPLOAD_DIR = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB avatar limit
});

// --- Which providers are actually configured -----------------------------
router.get('/providers', (req, res) => {
  res.json({
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    instagram: !!(process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET),
    local: true
  });
});

// --- Current session -------------------------------------------------------
router.get('/me', async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const followInfo = await users.getFollowInfo(req.user.id);
  res.json({
    user: {
      id: req.user.id,
      name: req.user.username,
      username: req.user.username,
      email: req.user.email,
      age: req.user.age,
      gender: req.user.gender,
      pronouns: req.user.pronouns,
      avatarUrl: req.user.avatar_url,
      instagramHandle: req.user.instagram_handle,
      followersCount: followInfo.followersCount,
      followingCount: followInfo.followingCount
    },
  });
});

// --- Logout ----------------------------------------------------------------
router.post('/logout', (req, res) => {
  req.logout(() => {
    // cookie-session has no destroy(): nulling the session deletes the cookie
    req.session = null;
    res.json({ ok: true });
  });
});

// --- Local Authentication Endpoints ---------------------------------------

router.post('/register', upload.single('avatar'), async (req, res) => {
  const { username, password, email, age, gender, pronouns, instagram_handle } = req.body;
  if (!username || !username.trim() || !password || !email || !email.trim()) {
    return res.status(400).json({ error: 'Username, password, and email are required.' });
  }

  if (await users.findByUsername(username)) {
    return res.status(400).json({ error: 'Username is already taken.' });
  }

  if (await users.findByEmail(email)) {
    return res.status(400).json({ error: 'Email is already registered.' });
  }

  let avatarUrl = '';
  if (req.file) {
    if (blobEnabled) {
      avatarUrl = (await saveFile(AVATARS_PREFIX + req.file.filename, req.file.path, req.file.mimetype)) || `/auth/avatar/${req.file.filename}`;
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    } else {
      avatarUrl = `/auth/avatar/${req.file.filename}`;
    }
  }

  try {
    const user = await users.create(
      username,
      password,
      email,
      age,
      gender,
      pronouns,
      instagram_handle || '',
      avatarUrl
    );

    req.login(user, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Registration succeeded, but login session failed.' });
      }
      res.status(201).json({ ok: true, user: { id: user.id, username: user.username } });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register account.' });
  }
});

router.post('/login', async (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = await users.findByUsername(username);
  if (!user || !users.verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  req.login(user, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to establish session.' });
    }
    res.json({ ok: true, user: { id: user.id, username: user.username } });
  });
});

// --- Password Recovery (OTP) -----------------------------------------------

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const user = await users.findByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'No account found with this email address.' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  await users.setOtp(email, otp, expiresAt);

  try {
    await sendOtpEmail(email, otp);
  } catch (err) {
    console.error('Failed to send OTP email:', err);
    return res.status(500).json({ error: 'Failed to send recovery email. Please try again later.' });
  }

  res.json({
    ok: true,
    message: 'OTP sent to recovery email address.'
  });
});

router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
  }

  if (!(await users.verifyOtp(email, otp))) {
    return res.status(400).json({ error: 'Invalid or expired OTP. Please try again.' });
  }

  const user = await users.findByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  await users.updatePassword(user.id, newPassword);
  res.json({ ok: true, message: 'Password updated successfully. You can now log in.' });
});

// --- Verify OTP (just validate, don't login or reset) --------------------

router.post('/forgot-password/verify', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }

  if (!(await users.verifyOtp(email, otp))) {
    return res.status(400).json({ error: 'Invalid or expired OTP. Please try again.' });
  }

  res.json({ ok: true, message: 'OTP verified successfully.' });
});

// --- Verify OTP & Login directly (without password reset) ------------------

router.post('/verify-otp-login', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }

  if (!(await users.verifyOtp(email, otp))) {
    return res.status(400).json({ error: 'Invalid or expired OTP. Please try again.' });
  }

  const user = await users.findByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  // Clear the OTP after successful verification
  await users.clearOtp(email);

  req.login(user, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to establish session.' });
    }
    res.json({ ok: true, message: 'Logged in successfully.', user: { id: user.id, username: user.username } });
  });
});

// --- Profile Update --------------------------------------------------------

router.post('/update-profile', upload.single('avatar'), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to update your profile.' });

  const { age, gender, pronouns, instagram_handle } = req.body;
  const updateData = {
    age: age !== undefined ? age : undefined,
    gender: gender !== undefined ? gender : undefined,
    pronouns: pronouns !== undefined ? pronouns : undefined,
    instagramHandle: instagram_handle !== undefined ? instagram_handle : undefined
  };

  if (req.file) {
    if (blobEnabled) {
      updateData.avatarUrl = (await saveFile(AVATARS_PREFIX + req.file.filename, req.file.path, req.file.mimetype)) || `/auth/avatar/${req.file.filename}`;
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    } else {
      updateData.avatarUrl = `/auth/avatar/${req.file.filename}`;
    }
  }

  try {
    const updatedUser = await users.updateProfile(req.user.id, updateData);
    res.json({ ok: true, user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// --- Google OAuth --------------------------------------------------------
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/login.html?error=google' }),
    (req, res) => {
      res.redirect('/index.html');
    }
  );
}

// --- Public User Profiles & Follows ---------------------------------------

router.get('/profile/:userId', async (req, res) => {
  const profileUser = await users.findById(req.params.userId);
  if (!profileUser) return res.status(404).json({ error: 'Member profile not found.' });

  const currentUserId = req.user ? req.user.id : null;
  const followInfo = await users.getFollowInfo(profileUser.id, currentUserId);

  res.json({
    id: profileUser.id,
    username: profileUser.username,
    age: profileUser.age,
    gender: profileUser.gender,
    pronouns: profileUser.pronouns,
    avatarUrl: profileUser.avatar_url,
    instagramHandle: profileUser.instagram_handle,
    followersCount: followInfo.followersCount,
    followingCount: followInfo.followingCount,
    isFollowing: followInfo.isFollowing
  });
});

router.post('/follow/:userId', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to follow members.' });

  const targetId = req.params.userId;
  if (req.user.id === targetId) {
    return res.status(400).json({ error: 'You cannot follow yourself.' });
  }

  const success = await users.follow(req.user.id, targetId);
  if (success) {
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: 'Already following or target user not found.' });
  }
});

router.post('/unfollow/:userId', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to unfollow members.' });

  await users.unfollow(req.user.id, req.params.userId);
  res.json({ ok: true });
});

// --- Serving User Avatar Files ---------------------------------------------
router.get('/avatar/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.status(404).send('Not Found');
});

module.exports = router;

