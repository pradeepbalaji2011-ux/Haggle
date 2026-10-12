
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
    ? `â˜… ${escapeHtml(product.rating)}${product.reviews ? ` Â· ${escapeHtml(product.reviews)} reviews` : ''}`
    : 'Check details at retailer';

  const badge = options.isLowestPrice
    ? '<span class="offer-badge">🏆 Lowest Price</span>'
    : '';

  const savings = Number(options.savings) > 0
    ? `<div class="savings">Save ${money(options.savings)} vs. highest offer</div>`
    : '';

  const buy = product.buyUrl
    ? `<a class="buy" href="${escapeHtml(product.buyUrl)}" target="_blank" rel="sponsored nofollow noopener noreferrer">Buy at ${escapeHtml(product.store)}</a>`
    : `<button class="buy" type="button" disabled>Buy link unavailable</button>`;

  return `
    <article class="product-card">
      <div class="image-wrap">${image}</div>
      <div class="product-info">
        ${badge}
        <span class="store">${escapeHtml(product.store)}</span>
        <h3 class="product-title">${escapeHtml(product.name)}</h3>
        <div class="price">${money(product.price)}</div>
        ${savings}
        <div class="meta">${rating}</div>
        <div class="meta">${escapeHtml(product.delivery || 'Delivery details at retailer')}</div>
        ${buy}
      </div>
    </article>
  `;
}
