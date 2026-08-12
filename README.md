# Random Reads

Random Reads is a mobile-first reading and discovery application from
[The Literature Foundation](https://theliteraturefoundation.org).

The project is designed to make classic literature easy to discover, read,
save, and revisit while building toward a broader system for verified reading
and literary engagement.

## Current Features

- Random public-domain book discovery
- Search powered by Gutendex / Project Gutenberg data
- In-app reading experience
- Dynamic text pagination
- Adjustable reader font size
- Table of contents navigation
- Reading progress tracking
- Personal reading journal
- Saved book library
- Firebase Authentication
- Email/password sign-in
- Google sign-in
- Firestore account synchronization
- Cross-device reading progress
- Progressive Web App installation
- Sponsored book banner
- Literature Foundation branding

## Technology

- React
- Vite
- React Router
- Firebase Authentication
- Cloud Firestore
- Gutendex / Project Gutenberg
- vite-plugin-pwa
- Lucide React
- Cloudflare

## User Data

Authenticated users receive their own Firestore-backed library.

Data is stored beneath the user's Firebase UID:

```text
users
└── {uid}
    ├── savedBooks
    ├── journal
    └── readingProgress


## 2026 Unified Literature Foundation Deployment

This version combines the Foundation website and Random Reads into one Vite/Cloudflare Pages project.

### Routes
- `/` — The Literature Foundation
- `/read` — Random Reads
- `/read/search`
- `/read/reader/:id`
- `/read/journal`
- `/read/about`
- `/read/login`
- `/api/*` — existing Cloudflare Pages Functions

Legacy Random Reads paths are redirected inside the SPA.

### Important deployment requirements
1. Deploy this entire project as one Cloudflare Pages project.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Keep the existing `functions/` directory at project root so `/api/book` and `/api/book-text` continue to work.
5. In Firebase Authentication > Settings > Authorized domains, add `theliteraturefoundation.org` and `www.theliteraturefoundation.org` before switching production traffic.
6. Point the Foundation domain at this Pages deployment after preview testing.
7. Random Reads installs as a PWA with `/read` as its start URL and scope.

### Branding
- Foundation: navy / teal / gold, dove + open book.
- Random Reads: family brand using a shuffle + open book mark and the same palette.
