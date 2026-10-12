# Haggle — modular product price comparison starter

This project separates the website into small modules so product data providers, UI, and backend logic can be updated independently.

## Modules

- `public/index.html` — page structure only
- `public/css/styles.css` — all styling
- `public/js/app.js` — search form, loading states, refresh, and rendering orchestration
- `public/js/api.js` — frontend-to-backend API requests
- `public/js/product-card.js` — product image, title, price, retailer, and Buy link card
- `public/js/config.js` — frontend display settings
- `server/index.js` — Express server and static hosting
- `server/routes/products.js` — API route, input validation, and short-lived search cache
- `server/providers/serpapi.js` — provider-specific request and response mapping
- `.env.example` — configuration template; copy to `.env` and add your key

## Start locally (Windows)

1. Install Node.js LTS from https://nodejs.org/.
2. Extract this folder.
3. Open the folder in VS Code, then choose **Terminal → New Terminal**.
4. Run `npm install`.
5. Copy `.env.example` to a new file named `.env`.
6. Get an API key from https://serpapi.com/ and set `SERPAPI_KEY=your_real_key` in `.env`.
7. Run `npm start`.
8. Open http://localhost:3000 in your browser.

Do not commit `.env` or expose the API key in frontend JavaScript. The key is read only by the server.

## Live-data notes

The included provider adapter uses SerpApi's Google Shopping results with India locale. It is not a direct official API for Amazon, Flipkart, Croma, or Reliance Digital. Coverage, freshness, result links, and quota depend on the provider and its plan. Treat offers as search results and ask shoppers to confirm final price, delivery, and stock at checkout. To use official retailer/affiliate feeds instead, replace only `server/providers/serpapi.js` with an adapter for the provider you are approved to use.

The cache duration is configurable with `CACHE_TTL_SECONDS` (default 300 seconds). Provider quotas may limit how often a search can be refreshed; refreshing the page does not guarantee a new upstream result.

## Current scope and next steps

This starter provides live shopping search, product images, returned prices, retailer names, and outbound offer links. It is a modular replacement foundation, not a line-for-line migration of every feature in the original single-file page. Price history, user accounts, wishlist sync, alerts, and verified review summaries need persistent storage and/or their own reliable data sources before they should be presented as real.
