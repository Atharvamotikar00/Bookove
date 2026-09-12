# 📚 Bookove

**A public ebook reading platform.** Upload, browse, and read PDF, EPUB, TXT, and MOBI books together in one shared library.

![Node](https://img.shields.io/badge/node-%3E%3D22.5.0-brightgreen)
![License](https://img.shields.io/badge/license-Public%20Domain-blue)
![Status](https://img.shields.io/badge/status-active-success)

---

## ✨ Features

### 📖 Reading Experience
- Shared bookshelf with an eye-catching **3D book-spine UI**
- Upload and read **PDF, EPUB, TXT, and MOBI** files
- Dedicated reader with PDF page navigation, an EPUB viewer, and plain-text display

### 👥 Community
- Local username + password authentication
- Library card profiles with avatar, age, gender, pronouns, and Instagram
- Follow / unfollow other library members
- Community-moderated content reports

### ♿ Accessibility
- Built-in accessibility panel with audio effects and text-to-speech
- Fully responsive design across devices

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| **Server** | Node.js (>= 22.5.0) + Express |
| **Database** | SQLite via `node:sqlite` (built-in) |
| **Auth** | Passport.js (local strategy) |
| **Frontend** | Vanilla HTML / CSS / JS |
| **File Uploads** | Multer |
| **MOBI Conversion** | Calibre (optional) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js `>= 22.5.0`
- Calibre installed (optional — only needed for MOBI conversion)

### Installation

```bash
git clone <repository-url>
cd bookove
cp .env.example .env   # fill in real values
npm install
```

### Running

```bash
npm run dev   # starts the server with --watch for auto-reload
```

The server listens on the port defined by `PORT` in your `.env` file.

---

## ⚙️ Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port |
| `ADMIN_KEY` | Secret for admin endpoints |
| `SESSION_SECRET` | Cookie signing secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL |
| `INSTAGRAM_CLIENT_ID` | Instagram OAuth client ID |
| `INSTAGRAM_CLIENT_SECRET` | Instagram OAuth client secret |
| `INSTAGRAM_CALLBACK_URL` | Instagram OAuth callback URL |

> ⚠️ Keep your `.env` file out of version control — never commit real secrets.

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome. Feel free to open an issue or submit a pull request.

---

## 📄 License

Public domain / open source.
