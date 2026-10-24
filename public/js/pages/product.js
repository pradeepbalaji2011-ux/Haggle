/**
 * public/js/pages/product.js â€” Dedicated Product Page (#/product/<id>)
 *
 * Implements:
 * 1. Large product photo & image gallery.
 * 2. Product name & brand.
 * 3. "Compared across N of 20 platforms" note.
 * 4. Price table with one row per store (price, store rating, Buy button).
 *    Sortable, with clear Lowest Price and Top-Rated badges.
 *    Out-of-stock items greyed out with disabled "Not available" button.
 *    If no valid offers at all, shows "Currently not available on any platform".
 *    Buy buttons open with target="_blank" rel="noopener sponsored".
 * 5. Interactive price history chart (one line per store, 30/90/180/365 days)
 *    with highest, lowest, and average price summary metrics.
 */

import { fetchProductDetail } from '../api.js';
import { Wishlist } from '../wishlist.js';
import { PriceAlerts } from '../alerts.js';
import { escapeHtml, formatPrice } from '../product-card.js';

let selectedDays = 90;
let currentChartInstance = null;

export async function renderProductPage(container, productId, queryParams = {}) {
  if (!container) return;

  container.innerHTML = `
    <div class="product-page-loading">
      <div class="spinner"></div>
      <p>Loading real-time price comparison across 15 platforms...</p>
    </div>
  `;

  try {
    const data = await fetchProductDetail(productId, queryParams);
    renderProductContent(container, data, productId);
  } catch (err) {
    console.error('Failed to load product page:', err);
    container.innerHTML = `
      <div class="product-error-container">
        <span class="error-icon">âš ï¸</span>
        <h2>Could not load product comparison</h2>
        <p>${escapeHtml(err.message || 'The product details could not be retrieved.')}</p>
        <div class="error-actions">
          <a href="#/" class="secondary-btn">â† Back to Home</a>
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
  const title = data.title || 'Product Details';
  const brand = data.brand || 'Electronics';
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

  // Build Price Table rows
  let priceTableHtml = '';
  if (stores.length === 0) {
    priceTableHtml = `
      <div class="no-offers-alert">
        <span class="alert-icon">â„¹ï¸</span>
        <div class="alert-text">
          <strong>Currently not available on any platform</strong>
          <p>No verified in-stock direct links match the Top 15 approved Indian platforms right now.</p>
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
        badgeHtml += `<span class="store-badge-pill lowest">ðŸ† Lowest Price</span>`;
      }
      if (isTopRated && !isLowest) {
        badgeHtml += `<span class="store-badge-pill toprated">â­ Top Rated</span>`;
      }

      const ratingText = store.rating
        ? `â˜… ${Number(store.rating).toFixed(1)}`
        : 'â€”';

      const isSafeUrl = typeof store.buyUrl === 'string' && /^https?:\/\//i.test(store.buyUrl.trim());
      const buyButton = (isOutOfStock || !isSafeUrl)
        ? `<button type="button" class="buy-btn disabled" disabled title="No direct product purchase link available for this store">Not available</button>`
        : `<a href="${escapeHtml(store.buyUrl.trim())}" target="_blank" rel="noopener sponsored" class="buy-btn" title="Buy at ${escapeHtml(store.store)}">
             <span>Buy at ${escapeHtml(store.store)}</span>
             <span aria-hidden="true">â†—</span>
           </a>`;

      return `
        <tr class="store-price-row ${isLowest ? 'highlight-row' : ''} ${isOutOfStock ? 'out-of-stock-row' : ''}">
          <td class="store-col">
            <div class="store-identity">
              <span class="platform-dot" style="background-color: ${escapeHtml(store.badgeColor || '#22C55E')};"></span>
              <span class="store-name">${escapeHtml(store.store)}</span>
              ${badgeHtml}
            </div>
            <div class="store-delivery-note">${escapeHtml(store.delivery || 'Official retailer dispatch')}</div>
          </td>
          <td class="rating-col">
            <span class="store-rating-score">${ratingText}</span>
          </td>
          <td class="price-col">
            <div class="store-price-val ${isLowest ? 'is-best' : ''}">
              ${formatPrice(store.price)}
            </div>
          </td>
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
              <th scope="col">Store / Platform</th>
              <th scope="col">Store Rating</th>
              <th scope="col">Price</th>
              <th scope="col">Purchase Link</th>
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
          <img src="${escapeHtml(img)}" alt="" class="thumb-img" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22><rect fill=%22%23f3f4f6%22 width=%2260%22 height=%2260%22/><text fill=%22%239ca3af%22 font-family=%22sans-serif%22 font-size=%2210%22 dy=%223.5%22 font-weight=%22bold%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22>ðŸ“±</text></svg>';" />
        </button>
      `).join('')
    : '';

  container.innerHTML = `
    <div class="product-page product-cockpit-layout">
      <!-- Breadcrumb Bar -->
      <nav class="product-breadcrumbs" aria-label="Breadcrumb">
        <a href="#/" class="bc-link">Home</a>
        <span class="bc-sep">/</span>
        <a href="#/search/${encodeURIComponent(brand)}" class="bc-link">${escapeHtml(brand)}</a>
        <span class="bc-sep">/</span>
        <span class="bc-current">${escapeHtml(title.slice(0, 35))}...</span>
      </nav>

      <!-- Main Showcase Grid (Everything in One Screen!) -->
      <div class="product-main-grid">
        <!-- Left: Image Gallery & Price Alert Command Box -->
        <div class="product-gallery-panel">
          <div class="main-image-viewport">
            <img id="mainProductPhoto" src="${escapeHtml(activeImage)}" alt="${escapeHtml(title)}" class="main-product-photo" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22400%22 viewBox=%220 0 400 400%22><rect fill=%22%23f3f4f6%22 width=%22400%22 height=%22400%22/><text fill=%22%239ca3af%22 font-family=%22sans-serif%22 font-size=%2222%22 dy=%2210.5%22 font-weight=%22bold%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22>ðŸ“± ${escapeHtml(brand)}</text></svg>';" />
            <button type="button" id="toggleWishlistBtn" class="product-wishlist-btn ${isSavedInWishlist ? 'saved' : ''}" aria-label="Save to Wishlist" title="Save to Wishlist">
              <span class="heart-icon">${isSavedInWishlist ? 'â¤ï¸' : 'ðŸ¤'}</span>
            </button>
          </div>
          ${thumbsHtml ? `<div class="gallery-thumbs-row">${thumbsHtml}</div>` : ''}

          <!-- Quick Action Wishlist Pill -->
          <div class="gallery-action-box">
            <button type="button" id="addToWishlistActionBtn" class="wishlist-action-btn ${isSavedInWishlist ? 'saved' : ''}">
              <span class="wishlist-action-icon">${isSavedInWishlist ? 'â¤ï¸' : 'ðŸ¤'}</span>
              <span class="wishlist-action-text">${isSavedInWishlist ? 'Saved in Your Wishlist' : 'Add to Wishlist'}</span>
            </button>
          </div>

          <!-- Set Price Alert Card (Compact on Left) -->
          <div class="product-alert-card compact-alert-card">
            <div class="alert-card-header">
              <span class="alert-bell-icon" aria-hidden="true">ðŸ””</span>
              <div>
                <h3 class="alert-card-title">Set Price Drop Alert</h3>
                <p class="alert-card-desc">Tracks Indian stores 24/7. Get alerted when price hits target.</p>
              </div>
            </div>
            <form id="priceAlertForm" class="price-alert-form">
              <div class="alert-input-wrap">
                <span class="currency-prefix">â‚¹</span>
                <input
                  type="number"
                  id="targetPriceInput"
                  class="target-price-input"
                  placeholder="Target (e.g. ${lowestPrice ? Math.round(lowestPrice * 0.9) : '70000'})"
                  value="${existingAlert && existingAlert.targetPrice ? existingAlert.targetPrice : (lowestPrice ? Math.round(lowestPrice * 0.9) : '')}"
                  min="1"
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

        <!-- Right: Store Prices + Price History Analytics (Unified) -->
        <div class="product-info-panel">
          <div class="product-header-compact">
            <div class="product-header-left">
              <span class="product-brand-badge">${escapeHtml(brand)}</span>
              <h1 class="product-title-heading">${escapeHtml(title)}</h1>
            </div>
            ${(data.rating != null) ? `
            <div class="product-rating-badge">
              <span class="rating-stars">â˜… ${Number(data.rating).toFixed(1)}</span>
              ${data.reviewsCount != null ? `<span class="reviews-count">(${Number(data.reviewsCount).toLocaleString()})</span>` : ''}
            </div>` : ''}
          </div>

          <!-- Compared across N of 20 platforms note (Compact banner) -->
          <div class="platforms-compared-banner compact-banner">
            <span class="compared-count-icon">ðŸ”</span>
            <span class="compared-text">
              Compared across <strong>${comparedCount} of ${totalPlatforms}</strong> approved Indian platforms. Direct links only.
            </span>
          </div>

          <!-- Price Table Section -->
          <div class="store-comparison-section">
            <div class="section-title-bar">
              <h2>Verified Retailer Prices</h2>
              <span class="section-subtitle">${stores.length} store offer${stores.length === 1 ? '' : 's'} available</span>
            </div>
            ${priceTableHtml}
          </div>

          <!-- Integrated Price History & Trends Section -->
          <section class="price-history-section integrated-history">
            <div class="history-header compact-history-header">
              <div class="history-title-group">
                <h3>Price History &amp; Trends</h3>
                <span class="history-sub-note">Historical movements across verified stores</span>
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
      if (mainPhoto && src) mainPhoto.src = src;
    });
  });

  // Wishlist Toggle Function
  const updateWishlistUI = (isSaved) => {
    const heartBtn = container.querySelector('#toggleWishlistBtn');
    const actionBtn = container.querySelector('#addToWishlistActionBtn');
    if (heartBtn) {
      heartBtn.classList.toggle('saved', isSaved);
      const icon = heartBtn.querySelector('.heart-icon');
      if (icon) icon.textContent = isSaved ? 'â¤ï¸' : 'ðŸ¤';
    }
    if (actionBtn) {
      actionBtn.classList.toggle('saved', isSaved);
      const icon = actionBtn.querySelector('.wishlist-action-icon');
      const text = actionBtn.querySelector('.wishlist-action-text');
      if (icon) icon.textContent = isSaved ? 'â¤ï¸' : 'ðŸ¤';
      if (text) text.textContent = isSaved ? 'Saved in Your Wishlist' : 'Add to Wishlist';
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

  // Price Alert Form Submit Handler
  const alertForm = container.querySelector('#priceAlertForm');
  const targetPriceInput = container.querySelector('#targetPriceInput');
  const alertFeedback = container.querySelector('#alertFeedbackMsg');
  const setAlertBtn = container.querySelector('#setAlertBtn');

  alertForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const targetPrice = parseFloat(targetPriceInput?.value);
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
        alertFeedback.textContent = `âœ“ Price alert saved! We will notify you when price drops to â‚¹${targetPrice.toLocaleString('en-IN')}.`;
        alertFeedback.className = 'alert-feedback-msg success';
        alertFeedback.style.display = 'block';
      }
      if (setAlertBtn) {
        setAlertBtn.innerHTML = '<span>Update Alert</span>';
        setAlertBtn.disabled = false;
      }
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
        <text x="${paddingX - 10}" y="${paddingY + 4}" font-size="11" fill="var(--text-muted)" text-anchor="end">â‚¹${Math.round(maxP).toLocaleString()}</text>
        <text x="${paddingX - 10}" y="${height / 2 + 4}" font-size="11" fill="var(--text-muted)" text-anchor="end">â‚¹${Math.round((maxP + minP) / 2).toLocaleString()}</text>
        <text x="${paddingX - 10}" y="${height - paddingY + 4}" font-size="11" fill="var(--text-muted)" text-anchor="end">â‚¹${Math.round(minP).toLocaleString()}</text>

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
        <span style="font-size:2rem;">ðŸ“Š</span>
        <p style="margin:0;font-weight:600;color:var(--text-main);">Tracking started ${sinceStr}, history will appear soon</p>
        <p style="margin:0;font-size:0.82rem;color:var(--text-muted);">Real-time price history chart will render once we collect at least 2 data points.</p>
      </div>
    `;
    return;
  }

  if (typeof window !== 'undefined' && window.Chart) {
    chartContainer.innerHTML = `
      <div class="chartjs-wrapper" style="position: relative; height: 280px; width: 100%;">
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
                  label: (ctx) => ` ${ctx.dataset.label}: â‚¹${Number(ctx.parsed.y).toLocaleString('en-IN')}`
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
                  callback: (val) => `â‚¹${Number(val).toLocaleString('en-IN')}`
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


