/**
 * public/js/product-card.js — Product Card Component (v4 demo design)
 *
 * Demo-style card:
 * - Photo with wishlist heart (top-right)
 * - BRAND · CATEGORY small-caps label
 * - Name
 * - Cyan price (+ optional strikethrough original)
 * - "on Store" row with colored dot + offer count
 * Click navigates to #/product/<id>
 */

import { proxyImg, IMG_FALLBACK, IMG_PERF_ATTRS } from './img.js';

export function escapeHtml(str = '') {
  return String(str || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

export function formatPrice(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return 'Price unavailable';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(value));
}

/**
 * Shared store-name → brand color map (matches backend platforms.js)
 */
const STORE_COLORS = [
  [/amazon/i,  '#FF9900'],
  [/flipkart/i, '#2874F0'],
  [/myntra/i,  '#FF3F6C'],
  [/meesho/i,  '#E91E63'],
  [/ajio/i,    '#2C4152'],
  [/jiomart/i, '#0078AD'],
  [/shopsy/i,  '#7C3AED'],
  [/snapdeal/i, '#E40046'],
  [/tata\s*cliq/i, '#0F172A'],
  [/nykaa/i,   '#FC2779'],
  [/firstcry/i, '#FF6F61'],
  [/indiamart/i, '#00A699'],
  [/croma/i,   '#22D3EE'],
  [/reliance/i, '#EF4444'],
  [/vijay/i,   '#F97316']
];

export function storeColor(storeName = '') {
  for (const [re, color] of STORE_COLORS) {
    if (re.test(storeName)) return color;
  }
  return '#22D3EE';
}

/**
 * Decodes HTML entities that upstream providers already escaped once,
 * so escapeHtml() can be applied exactly once at render time.
 */
export function decodeEntities(str = '') {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

/**
 * Creates HTML string for a demo-style product card
 *
 * @param {object} product - Product object
 * @returns {string} HTML string
 */
export function renderProductCard(product) {
  const decodedName = decodeEntities(product.name || '');
  const prodId = product.productId || product.id || encodeURIComponent(decodedName);
  const detailUrl = `#/product/${encodeURIComponent(prodId)}?title=${encodeURIComponent(decodedName)}&image=${encodeURIComponent(product.image || '')}&price=${encodeURIComponent(product.price || '')}&store=${encodeURIComponent(product.store || '')}&brand=${encodeURIComponent(product.brand || '')}&rating=${encodeURIComponent(product.rating || '')}&pageToken=${encodeURIComponent(product.pageToken || '')}&buyUrl=${encodeURIComponent(product.buyUrl || '')}`;

  const imageSrc = product.image
    ? `<img src="${escapeHtml(proxyImg(product.image))}" alt="${escapeHtml(decodedName)}" class="card-img" loading="lazy" ${IMG_PERF_ATTRS} width="300" height="300" onerror="this.onerror=null; this.src='${IMG_FALLBACK}';">`
    : `<div class="card-img-placeholder" aria-hidden="true">🛍️</div>`;

  const lowestPrice = product.lowestPrice ?? product.price;
  const hasPrice = Number.isFinite(Number(lowestPrice)) && Number(lowestPrice) > 0;
  const priceHtml = hasPrice
    ? `<span class="v4-card-price">${formatPrice(lowestPrice)}</span>`
    : `<span class="v4-card-price v4-card-price-see">See price</span>`;
  const wasPrice = (product.highestPrice && hasPrice && Number(product.highestPrice) > Number(lowestPrice))
    ? `<span class="v4-card-price-was">${formatPrice(product.highestPrice)}</span>`
    : '';

  const primaryStore = product.store || (product.stores && product.stores[0]?.store) || 'Verified store';
  const storeCount = product.storeCount || (product.stores ? product.stores.length : 1);
  const dotColor = product.storeColor || storeColor(primaryStore);

  const rawBrand = (product.brand || '').trim();
  const fallbackBrand = decodedName.trim().split(/\s+/)[0] || 'Haggle';
  const brandValue = (!rawBrand || /^other\s*\/\s*unknown$/i.test(rawBrand)) ? fallbackBrand : rawBrand;
  const brandLine = `${brandValue.toUpperCase()}${product.category ? ' · ' + String(product.category).toUpperCase() : ''}`;

  const ratingHtml = product.rating
    ? `<span class="v4-card-rating">★★★★★<em>(${Number(product.reviews || 0).toLocaleString('en-IN')})</em></span>`
    : '';

  const isAvailable = product.inStock !== false && product.outOfStock !== true;

  return `
    <article class="product-card v4-card" data-product-id="${escapeHtml(prodId)}">
      <button type="button" class="card-wish-btn" aria-label="Add to wishlist" title="Save to wishlist">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
      <a href="${detailUrl}" class="card-link" aria-label="View details for ${escapeHtml(product.name)}">
        <div class="card-image-wrap">
          ${imageSrc}
          ${!isAvailable ? `<span class="v4-card-oos">Out of stock</span>` : ''}
        </div>
        <div class="v4-card-body">
          <span class="v4-card-brand">${escapeHtml(brandLine)}</span>
          <h3 class="v4-card-title" title="${escapeHtml(decodedName)}">${escapeHtml(decodedName)}</h3>
          ${ratingHtml}
          <div class="v4-card-price-row">
            ${priceHtml}
            ${wasPrice}
          </div>
          <div class="v4-card-store-row">
            <span class="v4-card-store"><i class="v4-store-dot" style="background:${dotColor}"></i>on ${escapeHtml(primaryStore)}</span>
            ${storeCount > 1 ? `<span class="v4-card-offers" title="Store offers">🛍 ${storeCount}</span>` : ''}
          </div>
        </div>
      </a>
    </article>
  `;
}
