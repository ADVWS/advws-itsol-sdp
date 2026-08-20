# advws-itsol-sdp — CDP Portal

A small static site with a login gate and permission-based navigator in front of
two prototype pages:

- `pages/Dashboard-CDP.html` — Mayor's Smart Dashboard (map view for executives)
- `pages/Staff-CDP.html` — CDP Staff Portal (data intake / cleansing / master data)
- `pages/admin.html` — user & permission management (superadmin only)
- `index.html` — login screen + navigator (shows only the pages a user is allowed to open)

Designed to be hosted as-is on **GitHub Pages** (no build step, no server).

## Folder structure

```
index.html              → entry point (login + navigator) — must stay at the repo root
README.md
pages/                  → every protected content page lives here
  Dashboard-CDP.html     → guarded, requires "dashboard" permission
  Staff-CDP.html          → guarded, requires "staff" permission
  admin.html              → guarded, superadmin only
data/                   → shared JSON "database"
  users.json              → the 4 accounts: username, name, role, salted password hash, permissions
  pages.json              → registry of pages shown in the navigator/admin UI
assets/                 → shared JS/CSS, loaded by every page
  auth.js                 → login, session, hashing, permission helpers
  guard.js                → blocks page rendering and redirects if not authorized
  theme.css               → shared brand look: blobs, logo lockup, button shimmer, motion
  images/                 → IT Solutions brand assets (logo, banner, favicon)
    LOGO-AWS.png            → mark only, light/transparent — use on dark backgrounds
    BANNER-IT-SOLUTION.png  → full logo + wordmark, transparent background
    favicon.svg             → hand-drawn mini version of the mark, used as the browser tab icon
```

**Adding a new HTML page later:** drop the file in `pages/`, add an entry to
`data/pages.json` (id, title, subtitle, icon, `"file": "pages/YourPage.html"`),
and add these two lines as the first things in its `<head>`, right after the
charset meta tag:

```html
<script src="../assets/guard.js" data-page="your-id"></script>
<link rel="icon" type="image/svg+xml" href="../assets/images/favicon.svg">
<link rel="stylesheet" href="../assets/theme.css">
```

and near the end of `<body>`:

```html
<script src="../assets/auth.js"></script>
<script>document.addEventListener('DOMContentLoaded', () => CDPAuth.mountUserBadge());</script>
```

`auth.js` and `guard.js` figure out the project root from their own `<script>`
tag location, so this works no matter how deeply nested the new page is —
no path editing needed inside those two files.

Every protected HTML page loads `assets/guard.js` as the **first** thing in
`<head>` with a `data-page="..."` attribute. It reads the session written at
login time from `sessionStorage` and immediately redirects to `index.html` if
the current user isn't allowed on that page — before the page's real content
is parsed.

### Default accounts

| Username     | Password           | Role       | Access                        |
|--------------|--------------------|------------|-------------------------------|
| `superadmin` | `Superadmin@1234`  | superadmin | Dashboard, Staff, Admin panel |
| `admin`      | `Admin@1234`       | admin      | Dashboard, Staff              |
| `staff1`     | `Staff@1234`       | staff      | Staff                         |
| `viewer`     | `Viewer@1234`      | viewer     | Dashboard                     |

**Change these before sharing the link with anyone.** Log in as `superadmin` →
open the Admin panel → set new passwords → **Export users.json** → commit that
file over `data/users.json`.

## Managing users & permissions

1. Log in as a `superadmin` account and open **จัดการสิทธิ์ผู้ใช้งาน** (Admin).
2. Add/edit/delete users, change roles, and tick which pages each user can open.
3. Click **บันทึกการเปลี่ยนแปลง** — this saves to that browser's `localStorage`
   only (see limitation below).
4. Click **⬇️ ส่งออก users.json**, download the file, and replace
   `data/users.json` in the repository, then commit & push. This is what makes
   the change apply to every visitor, on every device.
5. **↩️ ล้างการเปลี่ยนแปลง** discards the local browser override and reloads
   straight from `data/users.json`.

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. Repo → **Settings → Pages** → Source: `Deploy from a branch` → Branch:
   `main` (or whichever branch you use) → `/ (root)` → Save.
3. Wait a minute for the first build, then open the URL GitHub shows you
   (e.g. `https://<user>.github.io/<repo>/`) — it will land on `index.html`.

No build tooling, environment variables, or secrets are needed — everything is
plain static files.

## Security model — please read

GitHub Pages is 100% static hosting: there is no server, no database, and no
way to keep anything truly secret. Given that constraint, this project uses
the best practice *available in a static site*, which is still weaker than a
real backend:

- Passwords are **never stored in plaintext**. `data/users.json` only holds a
  random per-user salt and an iterated SHA-256 hash (1000 rounds) of
  `salt:password`, computed the same way in the browser via the Web Crypto API.
- Login and permission checks happen entirely in the visitor's browser. Anyone
  can view-source `data/users.json`, `assets/auth.js`, and `assets/guard.js`.
  A determined attacker with enough time/compute could still attempt an
  offline brute-force/dictionary attack against a hash they can download.
- Sessions live in `sessionStorage` (cleared when the tab closes) with an
  8-hour expiry, not a cryptographically signed token — there is no server to
  verify a signature against.
- Superadmin permission edits are stored in that admin's browser
  (`localStorage`) until explicitly exported and committed back to the repo.

**Use this for internal/demo access gating of non-sensitive or mock data**
(which is what both `pages/Dashboard-CDP.html` and `pages/Staff-CDP.html`
currently contain — placeholder Thai names and `XXXXX`-masked ID numbers). If this is
ever wired up to **real citizen PII**, put it behind an actual backend and
authentication provider instead (e.g., Cloudflare Access / Zero Trust in front
of the static site, or a small serverless API with a real database, hashed
passwords server-side, and rate limiting) — a static JSON file is not a
substitute for that.
