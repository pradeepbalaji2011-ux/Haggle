# Haggle — Universal Price Comparison & Deal Engine

A modular, mobile-first product price comparison platform for Indian shoppers, comparing live verified prices strictly across the top 20 authorized Indian e-commerce platforms.

---

## 📁 File Map & Architecture

Haggle enforces a clean modular architecture where each feature lives in its own dedicated file:

```
haggle-modular/
├── public/                      # Static client assets & single-page application
│   ├── css/
│   │   └── styles.css           # Complete design system: mobile-first, dark mode, responsive tables
│   ├── js/
│   │   ├── pages/               # Dedicated page controllers (Task 1)
│   │   │   ├── home.js          # Minimal Home page: search & live rotating real product cards
│   │   │   ├── search.js        # Search Results page (#/search/<query>)
│   │   │   ├── product.js       # Product page (#/product/<id>): store price table & history chart
│   │   │   └── profile.js       # Profile page (#/profile): auth prompt, name edit, saved wishlist
│   │   ├── api.js               # Frontend-to-backend API client
│   │   ├── app.js               # Client hash router (#/page) & theme management
│   │   ├── auth.js              # Auth state manager synced with /api/me single source of truth
│   │   ├── config.js            # UI formatting settings (currency: INR ₹, en-IN locale)
│   │   ├── product-card.js      # Reusable product card component
│   │   └── wishlist.js          # Wishlist client manager (server sync & guest mode)
│   └── index.html               # Semantic HTML shell (topbar, app root, footer)
│
├── server/                      # Node.js backend services
│   ├── providers/
│   │   └── serpapi.js           # SerpApi Google Shopping & Google Product API adapter
│   ├── routes/
│   │   ├── products.js          # /api/products/search, /api/products/detail & /api/featured
│   │   └── wishlist.js          # /api/wishlist, /add, /remove/:id endpoints
│   ├── affiliate.js             # Partner affiliate tag injector for Amazon, Flipkart, etc.
│   ├── auth.js                  # Authentication router, password hashing & /api/me endpoint
│   ├── dedupe.js                # Product deduplication & multi-seller offer merger (Task 3)
│   ├── featured.js              # Real cached popular product search cache for home shuffle
│   ├── index.js                 # Express application entry point & static hosting
│   ├── links.js                 # Buy URL validation, Google redirect unwrapping & sanitization (Task 5)
│   ├── platforms.js             # Top 20 approved Indian platforms registry (Task 2)
│   ├── relevance.js             # Search relevance & accessory/model filter (Task 3)
│   └── users.js                 # User database store & wishlist persistence (Task 4)
│
├── tests/                       # Automated test suite using Node built-in test runner
│   ├── auth.test.js             # Tests for email normalization, login casing, lockout & sessions
│   ├── links.test.js            # Tests for URL validation, Google redirect unwrap & affiliate tags
│   └── relevance-dedupe.test.js # Tests for accessory exclusion, model matching & deduplication
│
├── data/
│   └── users.json               # Atomic JSON data store for user accounts & wishlists
│
├── .env.example                 # Configuration template
├── package.json                 # Project dependencies & npm scripts
└── README.md                    # Project documentation, file map, and manual test checklist
```

---

## 🛠️ Where to Change Each Feature

| Feature / Requirement | File to Edit | Notes |
| :--- | :--- | :--- |
| **Top 20 Platforms Registry** | `server/platforms.js` | Edit `TOP_PLATFORMS` array to adjust domains, aliases, categories, or badge colors. Offers outside this list are dropped. |
| **Accessory Keywords List** | `server/relevance.js` | Edit `ACCESSORY_KEYWORDS` array to add or remove accessory terms (case, cover, charger, cable, etc.). |
| **Model Variant Modifiers** | `server/relevance.js` | Edit `MODEL_MODIFIERS` array (`pro`, `plus`, `ultra`, `max`, etc.) to refine model matching. |
| **Product Deduplication Rules** | `server/dedupe.js` | Update `KNOWN_COLORS`, storage regex, or `normalizeCoreModel` to adjust how duplicate listings merge. |
| **Affiliate Tags & Parameters** | `server/affiliate.js` | Update `AFFILIATE_CONFIG` with your approved partner IDs (Amazon Associates `tag`, Flipkart `affid`, etc.). |
| **Buy Link Validation Rules** | `server/links.js` | Modify `isExactProductPath` or `BARE_NON_PRODUCT_PATHS` to adjust platform-specific product URL validation. |
| **User Accounts & Storage** | `server/users.js` | Manages user schema, email normalization, and wishlist persistence in `data/users.json`. |
| **Auth & Rate Limiting** | `server/auth.js` | Adjust password hashing salt, login lockout window (`LOCKOUT_WINDOW_MS`), or JWT expiry (`TOKEN_EXPIRY`). |
| **Featured Products Cache** | `server/featured.js` | Edit `POPULAR_SEARCHES` or `FEATURED_CACHE_TTL_MS` (default 6 hours) for home page rotation. |
| **Home Page Layout** | `public/js/pages/home.js` | Controls the minimal hero search box and auto-rotating product cards. |
| **Search Results Page** | `public/js/pages/search.js` | Controls product card grid and query filters for `#/search/<query>`. |
| **Product Page & Table** | `public/js/pages/product.js` | Controls store comparison table, "Compared across N of 20", and price history SVG chart. |
| **Profile & Wishlist Page** | `public/js/pages/profile.js` | Controls the profile view, login prompt, display name editor, and wishlist actions. |
| **Styles & Dark Mode** | `public/css/styles.css` | CSS variables for light/dark themes (`:root` and `[data-theme="dark"]`). |

---

## 📊 Honest Platform Data Source Report & Gap Analysis

Haggle monitors strictly **20 designated Indian platforms**:
1. **Amazon India** (`amazon.in`)
2. **Flipkart** (`flipkart.com`)
3. **Meesho** (`meesho.com`)
4. **Shopsy** (`shopsy.in`)
5. **IndiaMART** (`indiamart.com`)
6. **Myntra** (`myntra.com`)
7. **AJIO** (`ajio.com`)
8. **Nykaa** (`nykaa.com`)
9. **Tata CLiQ** (`tatacliq.com`)
10. **JioMart** (`jiomart.com`)
11. **BigBasket** (`bigbasket.com`)
12. **FirstCry** (`firstcry.com`)
13. **Snapdeal** (`snapdeal.com`)
14. **ShopClues** (`shopclues.com`)
15. **Blinkit** (`blinkit.com`)
16. **Zepto** (`zepto.now`)
17. **Swiggy Instamart** (`swiggy.com/instamart`)
18. **Lenskart** (`lenskart.com`)
19. **Pepperfry** (`pepperfry.com`)
20. **Tata Neu** (`tataneu.com`)

### Gaps & Limitations with Google Shopping Data Source:
SerpApi aggregates public Google Shopping results (`engine: 'google_shopping'` and `'google_product'`). Google Shopping indexes standard public web storefronts with nationwide delivery feeds. This creates distinct gaps for certain platforms:

| Platform Category | Affected Platforms | Why Google Shopping Cannot Return Prices | Suggested Real Alternative Data Source |
| :--- | :--- | :--- | :--- |
| **Quick Commerce** | **Blinkit, Zepto, Swiggy Instamart** | Quick-commerce platforms operate hyper-locally from dark stores based on real-time GPS/pincode location and mobile APIs. They do not publish static nationwide Google Shopping feeds. | Use an **ONDC (Open Network for Digital Commerce)** buyer API or direct session-based scrapers with dark-store pincode cookies (e.g. Blinkit/Zepto internal search APIs). |
| **B2B / Wholesale** | **IndiaMART** | IndiaMART is an RFQ (Request for Quote) directory where pricing is negotiable by bulk quantity, not a fixed single-click consumer checkout price. | IndiaMART Lead API / Webhook integration for bulk quotations rather than consumer retail comparison. |
| **Mobile-First / Super Apps** | **Tata Neu, Shopsy, Meesho** | Shopsy and Tata Neu primarily operate inside mobile super-apps; public desktop web crawlers receive generic landing pages rather than direct indexed offers. | Official affiliate feeds (e.g. Flipkart Affiliate API for Shopsy; Tata Neu partner integration). |

> [!NOTE]
> Haggle **never invents prices**. If an approved platform does not sell a given item or does not have a verified direct product URL, it is omitted from the comparison table, and the note accurately reflects `"Compared across N of 20 platforms"`.

---

## 🚀 Getting Started

### 1. Requirements
- Node.js LTS (v18.0.0 or higher)

### 2. Installation
```bash
# Extract and navigate to directory
cd haggle-modular

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 3. Configure `.env`
Open `.env` and add your SerpApi key:
```env
SERPAPI_KEY=your_serpapi_key_here
PORT=3000
CACHE_TTL_SECONDS=300
JWT_SECRET=haggle_super_secret_key_12345
```

### 4. Run Automated Tests
Haggle includes tests for relevance, deduplication, URL validation, and authentication:
```bash
npm test
```

### 5. Start Server
```bash
npm start
```
Open **http://localhost:3000** in your browser.

---

## 📋 Manual Verification Checklist

You can verify all requirements by hand following this step-by-step checklist:

- [ ] **1. Search "iphone 16"**
  - Type `iphone 16` in the search box and press Enter.
  - Verify that only iPhone 16 phones appear (no cases, covers, tempered glass, cables, or chargers).
  - Verify that `iPhone 16 Pro` or `iPhone 16 Plus` do NOT appear for this query.
  - Verify that duplicate listings (e.g. same 128GB Black model) are merged into one card with multiple store offers.

- [ ] **2. Search "iphone 16 case"**
  - Type `iphone 16 case` and press Enter.
  - Verify that iPhone 16 cases and covers now properly appear because the search term explicitly requested an accessory.

- [ ] **3. Product Page & Buy Buttons (Click 5 different products)**
  - Open 5 different products from search results or home page.
  - Verify that the Product page displays:
    - Large product photo and name
    - "Compared across N of 20 platforms" note
    - Price table with one row per store (price, store rating, and Buy button)
    - Stores sorted lowest price first with "🏆 Lowest Price" highlighted
    - Price history chart with 30, 90, 180, and 365 days toggle buttons and Lowest, Average, and Highest price summary cards
  - Click the **"Buy at [Store]"** button on each.
  - Verify that each button opens a direct product page in a new tab with `target="_blank" rel="noopener sponsored"`, and NEVER a bare homepage or generic search page.

- [ ] **4. Sign Up & Login with Uppercase Email**
  - Click the "Sign In" button in the topbar to open `#/profile`.
  - Click "Create Account" tab and sign up with an email like `  MYTEST@EXAMPLE.COM  ` (with spaces and uppercase).
  - Log out and log back in by typing `  mytest@example.com  ` with mixed casing.
  - Verify login succeeds smoothly without "Invalid email" rejection.
  - Verify typing a wrong password shows the specific error: `"Wrong password"`.
  - Verify typing a non-existent email shows: `"Email not registered"`.

- [ ] **5. Refresh the Profile Page**
  - While logged in, verify your first name appears in the topbar profile button.
  - Refresh the browser (F5) on `#/profile`.
  - Verify that the profile page loads and the header name still displays your name (reads from `/api/me`, never getting out of sync).
  - Edit your display name, click "Save Changes", and verify the name updates in both the profile and topbar.

- [ ] **6. Add & Remove Wishlist Items**
  - Open a product page and click the heart icon (🤍). Verify it turns into ❤️.
  - Go to `#/profile` and verify the product appears in the "❤️ Saved Wishlist" section with its price, store, and direct Buy button.
  - Click "Remove" on the wishlist item. Verify it is removed immediately.
