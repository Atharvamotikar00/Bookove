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

## 🌐 Deploy to Vercel

### Prerequisites
- A [Vercel account](https://vercel.com/signup)
- [Vercel CLI](https://vercel.com/docs/cli) installed (`npm i -g vercel`)

### Steps

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Import project on Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Vercel will auto-detect the Node.js project

3. **Configure environment variables**
   In the Vercel dashboard, add these environment variables:
   | Variable | Value |
   |---|---|
   | `SESSION_SECRET` | A long random string |
   | `ADMIN_KEY` | A long random string (for admin panel) |
   | `GOOGLE_CLIENT_ID` | (Optional) Your Google OAuth client ID |
   | `GOOGLE_CLIENT_SECRET` | (Optional) Your Google OAuth client secret |
   | `GOOGLE_CALLBACK_URL` | `https://your-app.vercel.app/auth/google/callback` |
   | `RESEND_API_KEY` | (Optional) Your Resend API key for email OTPs |
   | `RESEND_FROM` | (Optional) e.g. `Bookove <noreply@yourdomain.com>` |

4. **Deploy**
   ```bash
   vercel --prod
   ```
   Or click **Deploy** in the Vercel dashboard.

> ⚠️ **Note**: Vercel uses serverless functions, so the SQLite database and uploaded files are ephemeral (reset between cold starts). For production, consider migrating to a managed database like [Turso](https://turso.tech/) or [PlanetScale](https://planetscale.com/), and using cloud storage (e.g., S3, Cloudinary) for file uploads.

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome. Feel free to open an issue or submit a pull request.

---

## 📄 License

Public domain / open source.
