const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const users = require('../models/users');

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  try {
    done(null, users.findById(id));
  } catch (err) {
    done(err);
  }
});

// --- Google OAuth Strategy ------------------------------------------------
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
        scope: ['profile', 'email'],
      },
      (accessToken, refreshToken, profile, done) => {
        try {
          const user = users.findOrCreateGoogleUser(profile);
          return done(null, user);
        } catch (err) {
          console.error('Google OAuth error:', err);
          return done(err, null);
        }
      }
    )
  );
  console.log('✅ Google OAuth strategy configured');
} else {
  console.log('ℹ️  Google OAuth not configured (missing CLIENT_ID or CLIENT_SECRET)');
}

module.exports = passport;

