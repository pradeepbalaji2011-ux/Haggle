import { CONFIG } from './config.js';

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));

const money = value =>
  value == null || !Number.isFinite(Number(value))
    ? 'Price unavailable'
    : new Intl.NumberFormat(CONFIG.locale, {
        style: 'currency',
        currency: CONFIG.currency,
        maximumFractionDigits: 0
      }).format(Number(value));

export function productCard(product, options = {}) {
  const image = product.image
    ? `<img class="product-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="image-fallback" aria-hidden="true">${CONFIG.fallbackImageEmoji}</span>`;

  const rating = product.rating
    ? `★ ${escapeHtml(product.rating)}${product.reviews ? ` · ${escapeHtml(product.reviews)} reviews` : ''}`
    : 'Check details at retailer';

  const badge = options.isLowestPrice
    ? '<span class="offer-badge">🏆 Lowest Price</span>'
    : '';

  const savings = Number(options.savings) > 0
    ? `<div class="savings">Save ${money(options.savings)} vs. highest offer</div>`
    : '';

  const isDirect = product.isDirectRetailer !== false;
  const buyLabel = isDirect
    ? `Buy at ${escapeHtml(product.store)} ↗`
    : `View deal at ${escapeHtml(product.store)} ↗`;

  const buy = product.buyUrl
    ? `<a class="buy" href="${escapeHtml(product.buyUrl)}" target="_blank" rel="sponsored nofollow noopener noreferrer">${buyLabel}</a>`
    : `<button class="buy" type="button" disabled>Buy link unavailable</button>`;

  const compareBtn = product.productId
    ? `<button class="btn-compare" type="button" data-product-id="${escapeHtml(product.productId)}" data-product-title="${escapeHtml(product.name)}" aria-label="Compare sellers for ${escapeHtml(product.name)}">⇄ Compare all sellers</button>`
    : '';

  return `
    <article class="product-card" data-product-id="${escapeHtml(product.id)}">
      <div class="image-wrap">${image}</div>
      <div class="product-info">
        ${badge}
        <div class="product-meta-top">
          <span class="store">${escapeHtml(product.store)}</span>
          ${product.brand && product.brand !== 'Other / Unknown' ? `<span class="product-brand-tag">${escapeHtml(product.brand)}</span>` : ''}
        </div>
        <h3 class="product-title" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</h3>
        <div class="price">${money(product.price)}</div>
        ${savings}
        <div class="meta">${rating}</div>
        <div class="meta">${escapeHtml(product.delivery || 'Delivery details at retailer')}</div>
        <div class="card-actions">
          ${buy}
          ${compareBtn}
        </div>
      </div>
    </article>
  `;
}
