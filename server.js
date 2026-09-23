require('dotenv').config();
const express = require('express');
const path = require('node:path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session');
const rateLimit = require('express-rate-limit');


const passport = require('./src/auth/passport');
const authRouter = require('./src/routes/auth');
const booksRouter = require('./src/routes/books');
const adminRouter = require('./src/routes/admin');
const { checkCalibre } = require('./src/utils/convert');

const app = express();
app.set('trust proxy', 1); // honor x-forwarded-proto when hosted behind a proxy
const PORT = parseInt(process.env.PORT, 10) || 3000;

if (!process.env.SESSION_SECRET) {
  console.warn(
    '⚠️  No SESSION_SECRET set in .env — using a random one for this run. ' +
      'Everyone will be logged out whenever the server restarts. Set SESSION_SECRET for production.'
  );
}

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cookieSession({
    name: 'bookove_session',
    keys: [process.env.SESSION_SECRET || require('node:crypto').randomBytes(32).toString('hex')],
    maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.DISABLE_SECURE_COOKIE !== 'true',
  })
);
// cookie-session has no server-side store, so its session object lacks the
// regenerate()/save() methods passport's SessionManager calls during
// req.login()/req.logout(). No-op stand-ins are safe: cookie-session writes
// the signed cookie at response end regardless of these calls.
app.use((req, res, next) => {
  if (req.session && typeof req.session.regenerate !== 'function') {
    req.session.regenerate = (cb) => { if (cb) cb(null); };
    req.session.save = (cb) => { if (cb) cb(null); };
  }
  next();
});

app.use(passport.initialize());
app.use(passport.session());

// Basic abuse protection on upload/report endpoints.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many uploads from this address. Please try again later.' },
});
app.use('/api/books/upload', uploadLimiter);

app.use('/auth', authRouter);
app.use('/api/books', booksRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', async (req, res) => {
  const calibreAvailable = await checkCalibre();
  res.json({ ok: true, mobiConversionAvailable: calibreAvailable });
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`📚 Bookove running at http://localhost:${PORT}`);
  });
}

module.exports = app;

