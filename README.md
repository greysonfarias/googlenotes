# Notes do Google

> Notion-style notes. Your data lives in your Google Drive — always.

![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## Why?

Most note apps store your data on their servers. You pay for storage, hope they don't shut down, and pray your exports work.

**Notes do Google** works differently:

- Your notes are plain JSON files in your **own** Google Drive
- You can open, read, and backup them directly — no proprietary format
- Zero lock-in. Stop using the app today; your notes are still there tomorrow

---

## Features

- **Block-based editor** — headings, lists, code blocks, checklists, tables (powered by BlockNote)
- **3-panel layout** — workspace tree → folder → note, just like Notion
- **File attachments** — drag & drop files directly onto notes; stored in your Drive
- **Instant loading** — IndexedDB cache means notes open without waiting for the network
- **Background sync** — edits save locally first, sync to Drive silently in the background
- **Notion import** — import your Notion export ZIP directly (databases, nested pages)
- **Works offline** — read and edit previously opened notes without internet
- **Open source** — MIT license, self-host in minutes

---

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Editor | BlockNote 0.20 |
| Auth | NextAuth v5 + Google OAuth |
| Local cache | Dexie (IndexedDB) |
| Storage | Google Drive API v3 |
| Styling | Tailwind CSS |

---

## Getting started

### Option A — Run locally (5 minutes)

```bash
git clone https://github.com/greysonfarias/googlenotes.git
cd notes-do-google
npm install
npm run dev
```

Open `http://localhost:3000` and follow the setup wizard. It will guide you through creating a Google OAuth app (takes ~3 minutes with the in-app help).

### Option B — Deploy to Vercel (one click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/greysonfarias/googlenotes)

Set these environment variables in Vercel:

```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
AUTH_SECRET=any_random_string_32_chars
```

---

## How your data is stored

```
Google Drive/
└── Notes do Google/
    ├── index.json          ← folder & note tree
    ├── notes/
    │   ├── note_abc123.json
    │   └── note_xyz456.json
    └── assets/             ← file attachments
```

Everything is human-readable JSON. If this app disappeared tomorrow, your notes would still be there.

---

## License

MIT © 2026 — do whatever you want with it.
