# Haggle — Agent Handoff Document

> **Last Updated:** October 2026  
> **Repository:** `https://github.com/pradeepbalaji2011-ux/Haggle.git` (Branch: `main`)  
> **Live Production:** `https://haggle-2mki.onrender.com`  
> **Test Status:** 91 passing tests across 8 suites (`npm test`)

---

## 1. Executive Summary & Purpose

**Haggle** is a modular, mobile-first product price comparison platform built for Indian e-commerce shoppers. It scrapes, normalizes, deduplicates, and tracks real-time product prices across **12 verified Indian platforms**:
1. Amazon India
2. Flipkart
3. AJIO
4. JioMart
5. Shopsy
6. Myntra
7. Snapdeal
8. FirstCry
9. Nykaa
10. Meesho
11. Tata CLiQ
12. IndiaMART

---

## 2. Workspace & Git Repository Layout

> [!IMPORTANT]
> **Nested Repository Warning:**
> The working environment has a parent workspace and an inner git clone:
> - **Workspace Root:** `c:\Users\DELL\Downloads\haggle-modular\`
> - **Git Repository Root:** `c:\Users\DELL\Downloads\haggle-modular\haggle-modular\`
> 
> When modifying files in the workspace root, **always sync/copy the modified files to `haggle-modular/`** before running `git add`, `git commit`, and `git push origin main`.
>
> On Windows in standard sandbox mode, network access is restricted. Use elevated mode (`BypassSandbox: true`) ONLY for the final `git push origin main`.

### Core Directory Tree
```
haggle-modular/
├── .editorconfig              # UTF-8 and LF line endings specification
├── .gitattributes             # Git LF line ending and binary rules
├── .env.example               # Template for required environment variables
├── package.json               # Node.js dependencies & test scripts
├── README.md                  # User-facing manual & Windows PowerShell guidelines
├── data/                      # Local JSON storage directory (configurable via DATA_DIR)
│   ├── users.json             # User accounts, hashed passwords, wishlists, alerts
│   ├── price_history.json     # Token-normalized historical price tracker
│   └── trending.json          # Cached popular products
├── public/                    # Frontend SPA (Zero-build Vanilla ES Modules)
│   ├── index.html             # Main HTML shell (anti-flash script, meta charset first)
│   ├── css/
│   │   ├── styles.css         # Dark Neon design system + Light theme overrides
│   │   └── chatbot.css        # Chatbot overlay styles
│   └── js/
│       ├── app.js             # Hash router (#/) and theme manager ("haggle-theme")
│       ├── config.js          # Shared INR formatter (inrFormatter, formatPrice)
│       ├── api.js             # Frontend API client
│       ├── auth.js            # Frontend session state (synced with /api/me)
│       ├── product-card.js    # Reusable product card rendering & sanitization
│       ├── wishlist.js        # Wishlist client manager
│       ├── alerts.js          # Price alerts client manager
│       ├── chatbot/
│       │   └── chatbot.js     # Floating assistant widget with voice and charts
│       └── pages/
│           ├── home.js        # Home page with rotating featured products
│           ├── search.js      # Search results page
│           ├── product.js     # Dedicated product page (table, SVGs, Chart.js)
│           └── profile.js     # User profile, login/signup, saved wishlist
├── server/                    # Backend (Express 4, ES modules)
│   ├── index.js               # Express application entry, static serving & health check
│   ├── auth.js                # JWT auth, bcrypt hashing, admin diagnostic endpoint
│   ├── users.js               # File-based user database with backup auto-recovery
│   ├── db.js                  # Normalized price history storage (tokenized keys)
│   ├── mailer.js              # Multi-channel mailer (Apps Script Webhook + SMTP)
│   ├── platforms.js           # 12 approved Indian platforms metadata
│   ├── featured.js            # Real scraper cache for home page (no fake products)
│   ├── relevance.js           # Search relevance & accessory/model filter
│   ├── dedupe.js              # Product deduplication & multi-seller offer merger
│   ├── links.js               # Direct buy link validation & affiliate injection
│   ├── affiliate.js           # Affiliate tag injector
│   ├── providers/
│   │   └── html-scraper.js    # Cheerio/fetch HTML scrapers for all 12 platforms
│   ├── chatbot/
│   │   ├── nlu.js             # Natural language intent & entity parsing
│   │   ├── retrieval.js       # Live search & database retrieval for chatbot
│   │   ├── generator.js       # Verified response generation + numerical gatekeeper
│   │   ├── scheduler.js       # 24/7 background price checking & alert scheduler
│   │   └── trending-updater.js# Background trending products cache updater
└── tests/                     # Test suite (Node.js built-in test runner)
    ├── auth.test.js           # Auth, password hashing, lockout, email normalization
    ├── data-integrity-group2.test.js # No fake catalogs, 12 platforms validation
    ├── encoding.test.js       # Zero mojibake, zero BOM, meta charset, response charset
    ├── group3-group4.test.js  # Render deployment, disk configuration, link guards
    ├── links.test.js          # Retail link validation and unrolling
    ├── qa-security-remediation.test.js # Security regressions and edge cases
    ├── relevance-dedupe.test.js # Accessory filtering and title deduplication
    ├── scraper-integrity.test.js # Scraper contracts & real data enforcement
    └── security-group1.test.js# JWT secret enforcement, diagnostic endpoint security
```

---

## 3. Technology Stack

- **Runtime:** Node.js (v20+ or v24+, ES Modules `"type": "module"`)
- **Backend Framework:** Express 4
- **Database:** JSON flat-files with in-memory caching and `.bak` corruption recovery (SQLite optional legacy)
- **Frontend:** Pure Vanilla JavaScript (ES Modules, native `Intl`, DOM APIs) — **No bundler / No Vite / No Webpack**
- **Visualization:** Chart.js (CDN) with pure SVG fallback
- **Authentication:** JWT (`jsonwebtoken`) with `bcryptjs` password hashing
- **Email Delivery:** Google Apps Script HTTPS Webhook (Port 443) with Nodemailer SMTP fallback (Port 587)
- **Testing:** Native Node.js test runner (`node --test --test-concurrency=1 tests/*.test.js`)

---

## 4. Key Architectural Standards & Invariants

### A. Strict Data Integrity (No Fake or Mock Data)
- **Zero Fallback Catalogs:** Never return mock or hardcoded product prices/ratings. If scrapers return empty, return an empty array with `"Live prices are temporarily unavailable, please try again shortly."`
- **Scraper Platform Count:** The platform count is exactly **12**. Never reference retired/mock platforms (e.g., ShopClues, Lenskart, Tata Neu).
- **Normalized Price History:** Price history in `server/db.js` uses normalized token keys (`brand + model + storage/size + color`, stripped of store words) so variants do not collide and cross-store data merges accurately.

### B. Security & Authentication
- **JWT Secret:** `JWT_SECRET` must be set in environment variables and must be $\ge 32$ characters in production. If missing or short, the server refuses to start.
- **Diagnostic Email Route:** `POST /api/auth/diagnostic-email` requires admin verification (`ADMIN_EMAIL` + valid JWT), is rate-limited, and **only ever delivers to the admin's own email**.
- **No Leaked Data:** Never commit secrets, user passwords, real emails, or `.env` to Git. `data/users.json` is gitignored.
- **HTML & URL Sanitization:** In `public/js/chatbot/chatbot.js` and all page components, user input and scraped data are escaped via `escapeHtml()`. Image and link URLs are strictly sanitized with `sanitizeUrl()` to permit only `https://` or relative links (`/`, `#`).

### C. Theme & UI Styling
- **Default Theme:** **DARK** is the default theme for all first-time visitors, ignoring device `prefers-color-scheme`.
- **Theme Storage Key:** Stored in `localStorage` under `"haggle-theme"` (wrapped in `try/catch` for incognito/restricted iframe support).
- **Zero-Flash Script:** Synchronous inline `<script>` at the top of `<head>` in `index.html` sets `dataset.theme` and `data-theme` attribute before CSS parses.
- **Color Variables (CSS `:root`):**
  - `--jet-black`: `#0A0A0A` (Default background)
  - `--cerulean-blue`: `#007BA7` (Primary brand)
  - `--neon-rose`: `#FF2D95` (Accent brand)
  - `--cerulean-light`: `#2BB8EA` (Prices & links)
  - `--surface-charcoal`: `#141418` (Cards & panels)
  - `--border-graphite`: `#26262E` (1px borders)
  - `--text-snow`: `#F5F5F7` (Body text)
  - `--text-ash`: `#9A9AA8` (Muted labels)
- **Inline SVGs:** All UI status/navigation symbols (hearts, stars, trophy, bell, search, arrows) use inline SVGs with `currentColor` and `aria-hidden="true"`, ensuring clean rendering across both dark and light themes.

### D. Currency Formatting & Encoding
- **Shared Formatter:** All rupee amounts across the entire app use the helper from [`public/js/config.js`](file:///c:/Users/DELL/Downloads/haggle-modular/public/js/config.js):
  ```javascript
  export const inrFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  });
  export function formatPrice(amount) { ... }
  ```
- **Escape Sequences:** In JavaScript files, always use Unicode escape sequences for symbols:
  - Rupee: `\u20B9` (`₹`)
  - Star: `\u2605` (`★`)
  - North-East Arrow: `\u2197` (`↗`)
  - Checkmark: `\u2713` (`✓`)
  - Em Dash: `\u2014` (`—`)
- **Server Charset Headers:** Express serves `.js`, `.css`, `.html`, and `.json` with explicit `charset=utf-8`.
- **Windows File Redirection:** Never use PowerShell `>` or `Out-File` without `-Encoding utf8`, as it introduces UTF-16LE or CP1252 mojibake.

---

## 5. Environment Variables & Deployment (Render)

### Environment Variables (.env)
```ini
PORT=3000
NODE_ENV=production
DATA_DIR=/var/data                     # Required on Render for persistent disk
JWT_SECRET=super_secret_jwt_key_at_least_32_chars_long
ADMIN_EMAIL=admin@haggle.in            # Required for admin diagnostics
SITE_URL=https://haggle-2mki.onrender.com

# Email - Channel 1: Google Apps Script Webhook (Port 443)
GMAIL_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
MAIL_WEBHOOK_SECRET=your_shared_webhook_secret

# Email - Channel 2: SMTP Fallback (Port 587)
EMAIL_USER=your_smtp_email@gmail.com
EMAIL_PASS=your_gmail_app_password
```

### Render Deployment Instructions
1. **Persistent Disk:**
   - In Render dashboard, attach a Persistent Disk (e.g. 1GB, mount path: `/var/data`).
   - Add environment variable `DATA_DIR=/var/data`.
   - *Warning:* Without this disk, user accounts, wishlists, and price history will be wiped on every redeploy.
2. **Build & Start Commands:**
   - Build Command: `npm install`
   - Start Command: `npm start`

---

## 6. Testing & Quality Assurance

Run the test suite from the repository root:
```bash
npm test
```
The test suite executes 8 test files sequentially:
1. `tests/encoding.test.js`: Mojibake prevention, BOM absence, charset headers.
2. `tests/security-group1.test.js`: JWT security, diagnostic route restrictions, email leaks.
3. `tests/auth.test.js`: Casing tolerance, bcrypt hashing, rate limiting.
4. `tests/data-integrity-group2.test.js`: Scraper integrity, 12 platforms.
5. `tests/group3-group4.test.js`: DATA_DIR persistence, disk paths, affiliate link tagging.
6. `tests/links.test.js`: URL unwrapping, store domain validation.
7. `tests/qa-security-remediation.test.js`: Relevance, accessory exclusion, token collision.
8. `tests/assistant-suite.test.js`: Chatbot benchmarks, numerical price verification gatekeeper.

---

## 7. Next Potential Tasks & Backlog

If you are an agent taking over Haggle, here are ready-to-tackle improvements:
1. **Scraper Proxy Support:** Rotate proxies or user-agents for `html-scraper.js` if stores (Amazon/Flipkart) intermittently block cloud IPs.
2. **Push Notifications:** Web Push API integration for instant price drop alerts in addition to email.
3. **PWA Offline Shell:** Add a lightweight `service-worker.js` and `manifest.json` for mobile home screen installation.
4. **Additional Category Filters:** Extend `relevance.js` category heuristics for home appliances and fashion sizes.
