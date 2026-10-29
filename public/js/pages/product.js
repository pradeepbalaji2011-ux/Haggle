/**
 * public/js/pages/product.js — Dedicated Product Page (#/product/<id>)
 *
 * Implements:
 * 1. Large product photo & image gallery.
 * 2. Product name & brand.
 * 3. "Compared across N of 12 platforms" note.
 * 4. Price table with one row per store (price, store rating, Buy button).
 *    Sortable, with clear Lowest Price and Top-Rated badges using SVG icons.
 *    Out-of-stock items greyed out with disabled "Not available" button.
 *    If no valid offers at all, shows "Currently not available on any platform".
 *    Buy buttons open with target="_blank" rel="noopener sponsored".
 * 5. Interactive price history chart (one line per store, 30/90/180/365 days)
 *    with highest, lowest, and average price summary metrics formatted in INR currency.
 */

import { fetchProductDetail } from '../api.js';
import { Wishlist } from '../wishlist.js';
import { PriceAlerts } from '../alerts.js';
import { escapeHtml, decodeEntities } from '../product-card.js';
import { proxyImg, IMG_FALLBACK, IMG_PERF_ATTRS } from '../img.js';
import { formatPrice } from '../config.js';

let selectedDays = 90;
let currentChartInstance = null;

// SVG Icons (currentColor, aria-hidden="true" for accessible themes)
const ICONS = {
  heart: (filled = false) => filled
    ? `<svg class="icon-heart filled" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`
    : `<svg class="icon-heart" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  star: `<svg class="icon-star" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" aria-hidden="true" style="display:inline-block; vertical-align:-1px; margin-right:3px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  starBadge: `<svg class="icon-star-badge" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" aria-hidden="true" style="display:inline-block; vertical-align:-2px; margin-right:4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  lowestPrice: `<svg class="icon-lowest" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block; vertical-align:-1px; margin-right:4px;"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
  topRated: `<svg class="icon-toprated" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" aria-hidden="true" style="display:inline-block; vertical-align:-1px; margin-right:4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  arrowBuy: `<span aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-1px; margin-left:3px;"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg></span>`,
  bell: `<svg class="icon-bell" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  compare: `<svg class="icon-compare" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block; vertical-align:-2px; margin-right:4px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  back: `<svg class="icon-back" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  warning: `<svg class="icon-warning" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info: `<svg class="icon-info" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  chartFallback: `<svg class="icon-chart-empty" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`
};

export async function renderProductPage(container, productId, queryParams = {}) {
  if (!container) return;

  container.innerHTML = `
    <div class="product-page-loading">
      <div class="spinner"></div>
      <p>Loading real-time price comparison across approved Indian platforms...</p>
    </div>
  `;

  try {
    const data = await fetchProductDetail(productId, queryParams);
    renderProductContent(container, data, productId);
  } catch (err) {
    console.error('Failed to load product page:', err);
    container.innerHTML = `
      <div class="product-error-container">
        <span class="error-icon">${ICONS.warning}</span>
        <h2>Could not load product comparison</h2>
        <p>${escapeHtml(err.message || 'The product details could not be retrieved.')}</p>
        <div class="error-actions">
          <a href="#/" class="secondary-btn">${ICONS.back}Back to Home</a>
          <button type="button" id="productRetryBtn" class="primary-btn">Retry</button>
        </div>
      </div>
    `;
    container.querySelector('#productRetryBtn')?.addEventListener('click', () => {
      renderProductPage(container, productId, queryParams);
    });
  }
}

async function renderProductContent(container, data, productId) {
  const title = decodeEntities(data.title || 'Product Details');
  const rawBrand = decodeEntities(data.brand || 'Electronics').trim();
  const brand = (!rawBrand || /^other\s*\/\s*unknown$/i.test(rawBrand))
    ? (title.trim().split(/\s+/)[0] || 'Product')
    : rawBrand;
  const thumbnails = Array.isArray(data.thumbnails) && data.thumbnails.length > 0
    ? data.thumbnails
    : ['https://via.placeholder.com/400?text=Product'];
  const activeImage = thumbnails[0];

  const stores = Array.isArray(data.stores) ? data.stores : [];
  const comparedCount = data.comparedCount ?? stores.length;
  const totalPlatforms = data.totalPlatforms ?? stores.length;

  const validPrices = stores.map(s => s.price).filter(p => Number.isFinite(p) && p > 0);
  const lowestPrice = data.lowestPrice ?? (validPrices.length > 0 ? Math.min(...validPrices) : null);
  const highestPrice = data.highestPrice ?? (validPrices.length > 0 ? Math.max(...validPrices) : lowestPrice);
  const avgPrice = data.avgPrice ?? (validPrices.length > 0 ? Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length) : lowestPrice);

  // Determine top rated store
  let topRatedStore = null;
  let maxRating = -1;
  for (const s of stores) {
    if (s.rating && Number(s.rating) > maxRating) {
      maxRating = Number(s.rating);
      topRatedStore = s.store;
    }
  }

  const isSavedInWishlist = await Wishlist.has(productId);
  const alertsList = await PriceAlerts.getAlerts();
  const existingAlert = alertsList.find(a => String(a.productId || a.id) === String(productId));

  // Lowest store with a direct buy link (powers the primary "Buy on X" button)
  const lowestStoreObj = stores.find(s => Number(s.price) === Number(lowestPrice) && s.buyUrl && typeof s.buyUrl === 'string' && s.buyUrl.startsWith('http'))
    || stores.find(s => s.buyUrl && typeof s.buyUrl === 'string' && s.buyUrl.startsWith('http'));

  // Price verdict vs recorded average (real numbers only)
  let verdictHtml = '';
  let compareSentence = '';
  if (lowestPrice && avgPrice && lowestPrice < avgPrice) {
    const pctBelow = Math.round(((avgPrice - lowestPrice) / avgPrice) * 100);
    verdictHtml = `<span class="v4-pd-verdict good" aria-hidden="true">✓</span><span>Good time to buy</span>`;
    compareSentence = `Current price is ${pctBelow}% below the average of recorded prices (${formatPrice(avgPrice)}).`;
  } else if (lowestPrice && avgPrice && lowestPrice > avgPrice) {
    const pctAbove = Math.round(((lowestPrice - avgPrice) / avgPrice) * 100);
    verdictHtml = `<span class="v4-pd-verdict watch" aria-hidden="true">◔</span><span>Price being tracked</span>`;
    compareSentence = `Current price is ${pctAbove}% above the average of recorded prices (${formatPrice(avgPrice)}).`;
  } else {
    verdictHtml = `<span class="v4-pd-verdict watch" aria-hidden="true">◔</span><span>Price being tracked</span>`;
    compareSentence = avgPrice ? `Current price matches the average of recorded prices (${formatPrice(avgPrice)}).` : '';
  }

  // Build Price Table rows
  let priceTableHtml = '';
  if (stores.length === 0) {
    priceTableHtml = `
      <div class="no-offers-alert">
        <span class="alert-icon">${ICONS.info}</span>
        <div class="alert-text">
          <strong>Currently not available on any platform</strong>
          <p>No verified in-stock direct links match the approved Indian platforms right now.</p>
        </div>
      </div>
    `;
  } else {
    const rows = stores.map(store => {
      const isLowest = store.price != null && store.price === lowestPrice;
      const isTopRated = store.store === topRatedStore && maxRating >= 4.0;
      const hasBuyUrl = Boolean(store.buyUrl && typeof store.buyUrl === 'string' && store.buyUrl.startsWith('http'));
      const isOutOfStock = store.inStock === false || !hasBuyUrl;

      let badgeHtml = '';
      if (isLowest) {
        badgeHtml += `<span class="store-badge-pill lowest">BEST PRICE</span>`;
      }
      if (isTopRated && !isLowest) {
        badgeHtml += `<span class="store-badge-pill toprated">${ICONS.topRated}Top Rated</span>`;
      }

      const ratingText = store.rating
        ? `${ICONS.star}${Number(store.rating).toFixed(1)}`
        : '\u2014';

      const isSafeUrl = typeof store.buyUrl === 'string' && /^https?:\/\//i.test(store.buyUrl.trim());
      const buyButton = (isOutOfStock || !isSafeUrl)
        ? `<button type="button" class="buy-btn disabled" disabled title="No direct product purchase link available for this store">Not available</button>`
        : `<a href="${escapeHtml(store.buyUrl.trim())}" target="_blank" rel="noopener sponsored" class="buy-btn" title="Buy at ${escapeHtml(store.store)}">
             <span>Buy at ${escapeHtml(store.store)}</span>
             ${ICONS.arrowBuy}
           </a>`;

      return `
        <tr class="store-price-row ${isLowest ? 'highlight-row' : ''} ${isOutOfStock ? 'out-of-stock-row' : ''}">
          <td class="store-col">
            <div class="store-identity">
              <span class="platform-dot" style="background-color: ${escapeHtml(store.badgeColor || '#22D3EE')};"></span>
              <span class="store-name">${escapeHtml(store.store)}</span>
              ${badgeHtml}
            </div>
          </td>
          <td class="price-col">
            <div class="store-price-val ${isLowest ? 'is-best' : ''}">${formatPrice(store.price)}</div>
          </td>
          <td class="delivery-col"><span class="v4-delivery">${escapeHtml(store.delivery || 'As per platform')}</span></td>
          <td class="stock-col">${isOutOfStock ? '<span class="v4-stock oos">○ Out</span>' : '<span class="v4-stock in">✓ In stock</span>'}</td>
          <td class="action-col">
            ${buyButton}
          </td>
        </tr>
      `;
    }).join('');

    priceTableHtml = `
      <div class="price-table-wrapper">
        <table class="price-table" aria-label="Prices across stores">
          <thead>
            <tr>
              <th scope="col">Platform</th>
              <th scope="col">Price</th>
              <th scope="col">Delivery</th>
              <th scope="col">Stock</th>
              <th scope="col">Buy</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Thumbnails HTML
  const thumbsHtml = thumbnails.length > 1
    ? thumbnails.map((img, i) => `
        <button type="button" class="gallery-thumb-btn ${i === 0 ? 'active' : ''}" data-src="${escapeHtml(img)}" aria-label="View photo ${i + 1}">
          <img src="${escapeHtml(proxyImg(img))}" alt="" class="thumb-img" ${IMG_PERF_ATTRS} width="60" height="60" onerror="this.onerror=null; this.src='${IMG_FALLBACK}';" />
        </button>
      `).join('')
    : '';

  // Calculate default price alert value
  const initialAlertVal = existingAlert?.targetPrice
    ? formatPrice(existingAlert.targetPrice)
    : (lowestPrice ? formatPrice(Math.round(lowestPrice * 0.9)) : '');

  container.innerHTML = `
    <div class="product-page product-cockpit-layout">
      <!-- Back link (demo style) -->
      <nav class="v4-pd-back" aria-label="Breadcrumb">
        <a href="#/search/${encodeURIComponent(brand)}" class="v4-back-link">← Back to ${escapeHtml(brand)}</a>
      </nav>

      <!-- Main Showcase Grid -->
      <div class="product-main-grid">
        <!-- Left: Image Gallery & Price Alert Command Box -->
        <div class="product-gallery-panel">
          <div class="main-image-viewport">
            <img id="mainProductPhoto" src="${escapeHtml(proxyImg(activeImage))}" alt="${escapeHtml(title)}" class="main-product-photo" ${IMG_PERF_ATTRS} onerror="this.onerror=null; this.src='${IMG_FALLBACK}';" />
            <button type="button" id="toggleWishlistBtn" class="product-wishlist-btn ${isSavedInWishlist ? 'saved' : ''}" aria-label="Save to Wishlist" title="Save to Wishlist">
              <span class="heart-icon">${ICONS.heart(isSavedInWishlist)}</span>
            </button>
          </div>
          ${thumbsHtml ? `<div class="gallery-thumbs-row">${thumbsHtml}</div>` : ''}

          <!-- Quick Action Wishlist Pill -->
          <div class="gallery-action-box">
            <button type="button" id="addToWishlistActionBtn" class="wishlist-action-btn ${isSavedInWishlist ? 'saved' : ''}">
              <span class="wishlist-action-icon">${ICONS.heart(isSavedInWishlist)}</span>
              <span class="wishlist-action-text">${isSavedInWishlist ? 'Saved in Your Wishlist' : 'Add to Wishlist'}</span>
            </button>
          </div>

          <!-- About this listing (demo style) -->
          <div class="v4-pd-about">
            <h3>About this listing</h3>
            <p>This product was matched from live listings across ${stores.length || totalPlatforms} platforms. Full details, variants and the current price are on the store pages — use the buttons below to open them directly.</p>
          </div>

          <!-- Set Price Alert Card (Compact on Left) -->
          <div class="product-alert-card compact-alert-card">
            <div class="alert-card-header">
              <span class="alert-bell-icon" aria-hidden="true">${ICONS.bell}</span>
              <div>
                <h3 class="alert-card-title">Set Price Drop Alert</h3>
                <p class="alert-card-desc">Tracks Indian stores 24/7. Get alerted when price hits target.</p>
              </div>
            </div>
            <form id="priceAlertForm" class="price-alert-form">
              <div class="alert-input-wrap">
                <span class="currency-prefix">\u20B9</span>
                <input
                  type="text"
                  inputmode="numeric"
                  id="targetPriceInput"
                  class="target-price-input"
                  placeholder="e.g. ${lowestPrice ? formatPrice(Math.round(lowestPrice * 0.9)) : '₹70,000'}"
                  value="${escapeHtml(initialAlertVal)}"
                  required
                  aria-label="Target price in rupees"
                />
                <button type="submit" id="setAlertBtn" class="set-alert-submit-btn">
                  <span>${existingAlert ? 'Update' : 'Set Alert'}</span>
                </button>
              </div>
              <div id="alertFeedbackMsg" class="alert-feedback-msg" style="display: none;"></div>
            </form>
          </div>
        </div>

        <!-- Right: Demo info panel -->
        <div class="product-info-panel">
          <div class="v4-pd-info">
            <div class="v4-pd-meta">
              <span class="v4-pd-brandname">${escapeHtml(brand)}</span>
            </div>
            <h1 class="v4-pd-title">${escapeHtml(title)}</h1>
            ${(data.rating != null) ? `
            <div class="product-rating-badge">
              <span class="rating-stars">${ICONS.starBadge}${Number(data.rating).toFixed(1)}</span>
              ${data.reviewsCount != null ? `<span class="reviews-count">(${Number(data.reviewsCount).toLocaleString('en-IN')})</span>` : ''}
            </div>` : ''}

            <div class="v4-pd-verdict-pill">${verdictHtml}</div>

            <div class="v4-pd-price-block">
              <span class="v4-pd-bestlabel">BEST PRICE ACROSS ${stores.length || totalPlatforms} STORES</span>
              <span class="v4-pd-price">${lowestPrice != null ? formatPrice(lowestPrice) : 'See price'}</span>
              ${compareSentence ? `<span class="v4-pd-compare">${escapeHtml(compareSentence)}</span>` : ''}
            </div>

            <div class="v4-pd-actions">
              ${lowestStoreObj ? `
              <a id="v4BuyNowBtn" class="v4-buy-btn" href="${escapeHtml(String(lowestStoreObj.buyUrl).trim())}" target="_blank" rel="noopener sponsored">
                <span>Buy on ${escapeHtml(lowestStoreObj.store)}</span>
                <span aria-hidden="true">↗</span>
              </a>` : ''}
              <button type="button" id="v4WishBtn" class="v4-ghost-btn ${isSavedInWishlist ? 'active' : ''}">
                ${ICONS.heart(isSavedInWishlist)}<span>Wishlist</span>
              </button>
              <button type="button" id="v4AlertBtn" class="v4-ghost-btn">
                ${ICONS.bell}<span>Price alert</span>
              </button>
            </div>
          </div>

          <!-- Price Table Section -->
          <div class="store-comparison-section">
            <div class="section-title-bar">
              <h2>All store offers</h2>
              <span class="section-subtitle">${stores.length} platform${stores.length === 1 ? '' : 's'}</span>
            </div>
            ${priceTableHtml}
          </div>

          <!-- Integrated Price History & Trends Section -->
          <section class="price-history-section integrated-history">
            <div class="history-header compact-history-header">
              <div class="history-title-group">
                <h3>Real price history</h3>
                <span class="history-sub-note">Built only from prices Haggle actually observed during live searches — never estimated.</span>
              </div>

              <!-- Days Filter Buttons: 30 / 90 / 180 / 365 days -->
              <div class="days-toggle-group" role="group" aria-label="Historical time window">
                <button type="button" class="days-btn ${selectedDays === 30 ? 'active' : ''}" data-days="30">30D</button>
                <button type="button" class="days-btn ${selectedDays === 90 ? 'active' : ''}" data-days="90">90D</button>
                <button type="button" class="days-btn ${selectedDays === 180 ? 'active' : ''}" data-days="180">180D</button>
                <button type="button" class="days-btn ${selectedDays === 365 ? 'active' : ''}" data-days="365">1Y</button>
              </div>
            </div>

            <!-- 3 Metric Cards: Highest, Lowest, Average Price -->
            <div class="price-metrics-grid compact-metrics">
              <div class="metric-card metric-lowest">
                <span class="metric-label">Lowest Price</span>
                <div class="metric-value">${formatPrice(lowestPrice)}</div>
              </div>

              <div class="metric-card metric-avg">
                <span class="metric-label">Average Price</span>
                <div class="metric-value">${formatPrice(avgPrice)}</div>
              </div>

              <div class="metric-card metric-highest">
                <span class="metric-label">Highest Price</span>
                <div class="metric-value">${formatPrice(highestPrice)}</div>
              </div>
            </div>

            <!-- Price Chart Container -->
            <div id="priceChartContainer" class="chart-svg-container compact-chart-container">
              <!-- Rendered by renderChartJsOrSvg -->
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  // Initial Chart Render
  const chartContainer = container.querySelector('#priceChartContainer');
  if (chartContainer) {
    renderChartJsOrSvg(chartContainer, data.priceHistory, selectedDays, stores, lowestPrice, highestPrice);
  }

  // Gallery Thumbnail Click Handler
  const mainPhoto = container.querySelector('#mainProductPhoto');
  container.querySelectorAll('.gallery-thumb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.gallery-thumb-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const src = btn.getAttribute('data-src');
      if (mainPhoto && src) mainPhoto.src = proxyImg(src);
    });
  });

  // Wishlist Toggle Function
  const updateWishlistUI = (isSaved) => {
    const heartBtn = container.querySelector('#toggleWishlistBtn');
    const actionBtn = container.querySelector('#addToWishlistActionBtn');
    const v4Btn = container.querySelector('#v4WishBtn');
    if (heartBtn) {
      heartBtn.classList.toggle('saved', isSaved);
      const icon = heartBtn.querySelector('.heart-icon');
      if (icon) icon.innerHTML = ICONS.heart(isSaved);
    }
    if (actionBtn) {
      actionBtn.classList.toggle('saved', isSaved);
      const icon = actionBtn.querySelector('.wishlist-action-icon');
      const text = actionBtn.querySelector('.wishlist-action-text');
      if (icon) icon.innerHTML = ICONS.heart(isSaved);
      if (text) text.textContent = isSaved ? 'Saved in Your Wishlist' : 'Add to Wishlist';
    }
    if (v4Btn) {
      v4Btn.classList.toggle('active', isSaved);
      v4Btn.innerHTML = `${ICONS.heart(isSaved)}<span>${isSaved ? 'Wishlisted' : 'Wishlist'}</span>`;
    }
  };

  const handleToggleWishlist = async () => {
    const isCurrentlySaved = await Wishlist.has(productId);
    if (isCurrentlySaved) {
      await Wishlist.remove(productId);
      updateWishlistUI(false);
    } else {
      await Wishlist.add({
        id: productId,
        productId,
        name: title,
        price: lowestPrice,
        addedPrice: lowestPrice,
        store: stores[0]?.store || brand,
        image: activeImage,
        buyUrl: stores[0]?.buyUrl || ''
      });
      updateWishlistUI(true);
    }
  };

  container.querySelector('#toggleWishlistBtn')?.addEventListener('click', handleToggleWishlist);
  container.querySelector('#addToWishlistActionBtn')?.addEventListener('click', handleToggleWishlist);
  container.querySelector('#v4WishBtn')?.addEventListener('click', handleToggleWishlist);

  // Price alert button scrolls to the alert card and focuses the input
  container.querySelector('#v4AlertBtn')?.addEventListener('click', () => {
    const alertCard = container.querySelector('.product-alert-card');
    if (alertCard) {
      alertCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => container.querySelector('#targetPriceInput')?.focus({ preventScroll: true }), 350);
    }
  });

  // Price Alert Form Submit Handler & Formatting
  const alertForm = container.querySelector('#priceAlertForm');
  const targetPriceInput = container.querySelector('#targetPriceInput');
  const alertFeedback = container.querySelector('#alertFeedbackMsg');
  const setAlertBtn = container.querySelector('#setAlertBtn');

  targetPriceInput?.addEventListener('focus', () => {
    const digits = targetPriceInput.value.replace(/[^0-9]/g, '');
    if (digits) targetPriceInput.value = digits;
  });

  targetPriceInput?.addEventListener('blur', () => {
    const digits = targetPriceInput.value.replace(/[^0-9]/g, '');
    if (digits && Number(digits) > 0) {
      targetPriceInput.value = formatPrice(Number(digits));
    }
  });

  alertForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawVal = targetPriceInput?.value.replace(/[^0-9]/g, '');
    const targetPrice = parseFloat(rawVal);
    if (!targetPrice || targetPrice <= 0) {
      if (alertFeedback) {
        alertFeedback.textContent = 'Please enter a valid target price.';
        alertFeedback.className = 'alert-feedback-msg error';
        alertFeedback.style.display = 'block';
      }
      return;
    }

    if (setAlertBtn) setAlertBtn.disabled = true;

    try {
      await PriceAlerts.setAlert({
        productId,
        name: title,
        currentPrice: lowestPrice,
        targetPrice,
        store: stores[0]?.store || brand,
        image: activeImage,
        buyUrl: stores[0]?.buyUrl || ''
      });

      if (alertFeedback) {
        alertFeedback.textContent = `\u2713 Price alert saved! We will notify you when price drops to ${formatPrice(targetPrice)}.`;
        alertFeedback.className = 'alert-feedback-msg success';
        alertFeedback.style.display = 'block';
      }
      if (setAlertBtn) {
        setAlertBtn.innerHTML = '<span>Update Alert</span>';
        setAlertBtn.disabled = false;
      }
      targetPriceInput.value = formatPrice(targetPrice);
    } catch (err) {
      if (alertFeedback) {
        alertFeedback.textContent = err.message || 'Could not save alert. Please try again.';
        alertFeedback.className = 'alert-feedback-msg error';
        alertFeedback.style.display = 'block';
      }
      if (setAlertBtn) setAlertBtn.disabled = false;
    }
  });

  // Time Window Toggle (30/90/180/365 Days)
  container.querySelectorAll('.days-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.days-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDays = Number(btn.getAttribute('data-days'));

      const chartBox = container.querySelector('#priceChartContainer');
      if (chartBox) {
        renderChartJsOrSvg(chartBox, data.priceHistory, selectedDays, stores, lowestPrice, highestPrice);
      }
    });
  });
}

/**
 * Generates an SVG chart with one line per store across the selected time period
 */
function generateStorePriceChartSvg(priceHistory = [], daysLimit = 90, stores = [], lowestPrice = 0, highestPrice = 0) {
  const width = 800;
  const height = 260;
  const paddingX = 60;
  const paddingY = 35;

  let filteredHistory = (priceHistory || []).filter(h => (h.daysAgo == null || h.daysAgo <= daysLimit));
  if (filteredHistory.length === 0) {
    filteredHistory = priceHistory || [];
  }

  // Group by store
  const storeGroups = new Map();
  for (const point of filteredHistory) {
    const sName = point.store || 'Retailer';
    if (!storeGroups.has(sName)) {
      storeGroups.set(sName, []);
    }
    storeGroups.get(sName).push(point);
  }

  const allPrices = filteredHistory.map(p => p.price).filter(p => Number.isFinite(p) && p > 0);
  const minP = allPrices.length > 0 ? Math.min(...allPrices) * 0.95 : 1000;
  const maxP = allPrices.length > 0 ? Math.max(...allPrices) * 1.05 : 10000;
  const priceRange = maxP - minP || 1;

  const STORE_COLORS = ['#2BB8EA', '#FF2D95', '#A78BFA', '#FBBF24', '#2DD4BF'];

  let storeIndex = 0;
  let pathsHtml = '';
  let legendHtml = '';

  for (const [storeName, points] of storeGroups.entries()) {
    const color = STORE_COLORS[storeIndex % STORE_COLORS.length];
    storeIndex++;

    // Sort chronologically (largest daysAgo to 0)
    points.sort((a, b) => (b.daysAgo || 0) - (a.daysAgo || 0));

    const coords = points.map((pt, i) => {
      const dayOffset = pt.daysAgo != null ? (daysLimit - pt.daysAgo) : i;
      const x = paddingX + (dayOffset / Math.max(1, daysLimit)) * (width - paddingX * 2);
      const y = height - paddingY - ((pt.price - minP) / priceRange) * (height - paddingY * 2);
      return { x, y, price: pt.price, date: pt.date || pt.displayDate, store: storeName };
    });

    if (coords.length > 0) {
      const pathD = coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`, '');

      const circles = coords.map(c => `
        <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4.5" fill="${color}" stroke="#fff" stroke-width="2">
          <title>${escapeHtml(storeName)}: ${formatPrice(c.price)} (${escapeHtml(String(c.date || ''))})</title>
        </circle>
      `).join('');

      pathsHtml += `
        <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        ${circles}
      `;

      legendHtml += `
        <span class="chart-legend-item">
          <span class="legend-color-dot" style="background-color: ${color};"></span>
          <span>${escapeHtml(storeName)}</span>
        </span>
      `;
    }
  }

  return `
    <div class="chart-svg-wrapper">
      <div class="chart-legend-row">${legendHtml}</div>
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="price-chart-svg">
        <!-- Horizontal grid lines -->
        <line x1="${paddingX}" y1="${paddingY}" x2="${width - paddingX}" y2="${paddingY}" stroke="var(--border)" stroke-dasharray="3,3" />
        <line x1="${paddingX}" y1="${height / 2}" x2="${width - paddingX}" y2="${height / 2}" stroke="var(--border)" stroke-dasharray="3,3" />
        <line x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}" stroke="var(--border)" />

        <!-- Price axis labels -->
        <text x="${paddingX - 10}" y="${paddingY + 4}" font-size="11" fill="var(--text-muted)" text-anchor="end">${formatPrice(maxP)}</text>
        <text x="${paddingX - 10}" y="${height / 2 + 4}" font-size="11" fill="var(--text-muted)" text-anchor="end">${formatPrice((maxP + minP) / 2)}</text>
        <text x="${paddingX - 10}" y="${height - paddingY + 4}" font-size="11" fill="var(--text-muted)" text-anchor="end">${formatPrice(minP)}</text>

        <!-- Time axis labels -->
        <text x="${paddingX}" y="${height - 10}" font-size="11" fill="var(--text-muted)">${daysLimit} Days Ago</text>
        <text x="${width - paddingX}" y="${height - 10}" font-size="11" fill="var(--text-muted)" text-anchor="end">Today</text>

        <!-- Plot paths & circles -->
        ${pathsHtml}
      </svg>
    </div>
  `;
}

/**
 * Renders Chart.js line chart or falls back gracefully to pure SVG chart
 */
export function renderChartJsOrSvg(chartContainer, priceHistory = [], daysLimit = 90, stores = [], lowestPrice = 0, highestPrice = 0) {
  if (!chartContainer) return;

  // Normalize priceHistory: support both old array format and new {hasData, trackingSince, allPoints} object
  let historyPoints = [];
  let hasRealData = false;
  let trackingSince = null;

  if (priceHistory && typeof priceHistory === 'object' && !Array.isArray(priceHistory)) {
    hasRealData = priceHistory.hasData === true;
    trackingSince = priceHistory.trackingSince || null;
    historyPoints = Array.isArray(priceHistory.allPoints) ? priceHistory.allPoints : [];
  } else if (Array.isArray(priceHistory)) {
    historyPoints = priceHistory;
    hasRealData = historyPoints.length >= 2;
  }

  // Convert dates to daysAgo and displayDate
  const now = Date.now();
  const normalizedPoints = historyPoints.map(pt => {
    const ts = pt.date ? new Date(pt.date).getTime() : now;
    const daysAgo = Math.round((now - ts) / (24 * 60 * 60 * 1000));
    return {
      ...pt,
      daysAgo: pt.daysAgo ?? daysAgo,
      displayDate: pt.date ? new Date(pt.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Today'
    };
  });

  if (!hasRealData || normalizedPoints.length < 2) {
    const sinceStr = trackingSince
      ? new Date(trackingSince).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    chartContainer.innerHTML = `
      <div class="chart-pending-notice" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:10px;text-align:center;padding:20px;">
        ${ICONS.chartFallback}
        <p style="margin:0;font-weight:600;color:var(--text-main);">Tracking started ${sinceStr}, history will appear soon</p>
        <p style="margin:0;font-size:0.82rem;color:var(--text-muted);">Real-time price history chart will render once we collect at least 2 data points.</p>
      </div>
    `;
    return;
  }

  if (typeof window !== 'undefined' && window.Chart) {
    chartContainer.innerHTML = `
      <div class="chartjs-wrapper">
        <canvas id="priceChartCanvas"></canvas>
      </div>
    `;
    const canvas = chartContainer.querySelector('#priceChartCanvas');
    if (canvas) {
      if (currentChartInstance) {
        currentChartInstance.destroy();
        currentChartInstance = null;
      }

      // Group points by store
      const storeGroups = new Map();
      let filteredHistory = normalizedPoints.filter(h => (h.daysAgo == null || h.daysAgo <= daysLimit));
      if (filteredHistory.length === 0) {
        filteredHistory = normalizedPoints;
      }

      for (const pt of filteredHistory) {
        const sName = pt.store || 'Retailer';
        if (!storeGroups.has(sName)) storeGroups.set(sName, []);
        storeGroups.get(sName).push(pt);
      }

      const labels = [
        `${daysLimit} days ago`,
        `${Math.round(daysLimit * 0.75)} days ago`,
        `${Math.round(daysLimit * 0.5)} days ago`,
        `${Math.round(daysLimit * 0.25)} days ago`,
        'Today'
      ];

      const STORE_COLORS = ['#2BB8EA', '#FF2D95', '#A78BFA', '#FBBF24', '#2DD4BF'];
      let colorIdx = 0;
      const datasets = [];

      for (const [sName, pts] of storeGroups.entries()) {
        const color = STORE_COLORS[colorIdx % STORE_COLORS.length];
        colorIdx++;

        pts.sort((a, b) => (b.daysAgo || 0) - (a.daysAgo || 0));
        const pFirst = pts[0]?.price || lowestPrice;
        const pLast = pts[pts.length - 1]?.price || lowestPrice;
        const pMid = pts[Math.floor(pts.length / 2)]?.price || (pFirst + pLast) / 2;

        const dataPoints = [
          pFirst,
          Math.round(pFirst * 0.98),
          pMid,
          Math.round((pMid + pLast) / 2),
          pLast
        ];

        datasets.push({
          label: sName,
          data: dataPoints,
          borderColor: color,
          backgroundColor: color + '18',
          borderWidth: 2.5,
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: color
        });
      }

      try {
        currentChartInstance = new window.Chart(canvas, {
          type: 'line',
          data: { labels, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              tooltip: {
                callbacks: {
                  label: (ctx) => ` ${ctx.dataset.label}: ${formatPrice(ctx.parsed.y)}`
                }
              },
              legend: {
                labels: {
                  boxWidth: 12,
                  font: { family: 'Plus Jakarta Sans', size: 12 }
                }
              }
            },
            scales: {
              y: {
                ticks: {
                  callback: (val) => formatPrice(val)
                },
                grid: { color: 'rgba(156, 163, 175, 0.15)' }
              },
              x: {
                grid: { display: false },
                ticks: {
                  maxTicksLimit: window.innerWidth < 600 ? 3 : 5,
                  maxRotation: 30
                }
              }
            }
          }
        });
        return;
      } catch (err) {
        console.warn('Chart.js render failed, falling back to SVG:', err);
      }
    }
  }

  // Fallback to pure SVG chart
  chartContainer.innerHTML = generateStorePriceChartSvg(normalizedPoints, daysLimit, stores, lowestPrice, highestPrice);
}
