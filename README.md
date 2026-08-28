# Lit Chain

Lit Chain is a mobile-first reading, discovery, and literary community application from
[The Literature Foundation](https://theliteraturefoundation.org).

The project is designed to make classic literature easy to discover, read,
save, discuss, and revisit while building toward a broader system for verified
reading, preservation, and literary engagement.

## Current Features

- Random public-domain book discovery
- Search powered by Gutendex / Project Gutenberg data
- In-app reading experience
- Dynamic text pagination
- Adjustable reader font size
- Table of contents navigation
- Reading progress tracking
- Personal notes and reading journal
- Saved book library
- Profiles and public profiles
- Groups and group discussion
- The Chain community feed
- Notifications
- Firebase Authentication
- Email/password sign-in
- Google sign-in
- Firestore account synchronization
- Cross-device reading progress
- Progressive Web App installation
- Sponsored book banner
- The Literature Foundation branding

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

Authenticated users receive their own Firestore-backed reading and community data.

Existing Firebase, Firestore, route, and localStorage identifiers are intentionally
preserved during the Lit Chain rebrand to avoid breaking existing users.

## 2026 Unified Literature Foundation Deployment

This version combines The Literature Foundation website and Lit Chain into one
Vite/Cloudflare Pages project.

### Routes

- `/` — The Literature Foundation
- `/read` — Lit Chain
- `/read/search`
- `/read/reader/:id`
- `/read/journal`
- `/read/about`
- `/read/login`
- `/read/chain`
- `/read/profile`
- `/read/notifications`
- `/api/*` — existing Cloudflare Pages Functions

Legacy app paths remain handled inside the SPA.

### Important deployment requirements

1. Deploy this entire project as one Cloudflare Pages project.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Keep the existing `functions/` directory at project root so `/api/book` and `/api/book-text` continue to work.
5. Keep `theliteraturefoundation.org` and `www.theliteraturefoundation.org` authorized in Firebase Authentication.
6. Keep the PWA manifest `id`, `start_url`, and `scope` set to `/read` so the existing installed-app identity remains stable.
7. Lit Chain installs as a PWA with `/read` as its start URL and scope.

### Branding

- Foundation: existing The Literature Foundation branding.
- Lit Chain: navy / gold book-and-chain branding.
- Main Lit Chain assets:
  - `/public/branding/lit-chain-logo-horizontal.png`
  - `/public/branding/lit-chain-icon.png`
  - `/public/branding/lit-chain-icon-192.png`
  - `/public/branding/lit-chain-icon-512.png`

### Rebrand compatibility

Do not rename existing Firebase project identifiers, Firestore collections,
`/read` routes, or legacy localStorage keys solely for branding purposes.
Those internal identifiers can remain unchanged even though the visible product
name is now Lit Chain.
