# Bookove

A public ebook reading website — upload and read PDF, EPUB, TXT, and MOBI books.

## Features

- Browse a shared bookshelf with 3D book-spine UI
- Upload and read PDF, EPUB, TXT, and MOBI files
- Reader with PDF page navigation, EPUB viewer, and plain-text display
- Local authentication with username + password
- Library card profile with avatar, age, gender, pronouns, and Instagram
- Follow/unfollow library members
- Community-moderated reports
- Accessibility panel with audio effects and text-to-speech
- Responsive design

## Quick Start

```bash
cp .env.example .env   # fill in real values
npm install
npm run dev            # starts with --watch for auto-reload
```

Open http://localhost:3000 in your browser.

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default 3000) |
| `ADMIN_KEY` | Secret for admin endpoints |
| `SESSION_SECRET` | Cookie signing secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL |
| `INSTAGRAM_CLIENT_ID` | Instagram OAuth client ID |
| `INSTAGRAM_CLIENT_SECRET` | Instagram OAuth client secret |
| `INSTAGRAM_CALLBACK_URL` | Instagram OAuth callback URL |

## Tech Stack

- **Server**: Node.js (>= 22.5.0) + Express
- **Database**: SQLite via `node:sqlite` (built-in)
- **Auth**: Passport.js (local strategy)
- **Frontend**: Vanilla HTML/CSS/JS
- **File uploads**: Multer
- **MOBI conversion**: Calibre (optional)

## License

Public domain / open source.
