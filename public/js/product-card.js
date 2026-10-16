import { CONFIG } from './config.js';
import { WishlistManager } from './wishlist.js';

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

  // === NEW: Wishlist Heart Icon Button (Absolute positioned on top of the image) ===
  const wishlistBtn = `
    <button class="btn-wishlist-card" type="button" data-product-id="${escapeHtml(product.id)}" title="Save to Wishlist" style="position: absolute; top: 12px; right: 12px; z-index: 5; background: rgba(255,255,255,0.9); border: 1px solid var(--border); border-radius: 50%; width: 38px; height: 38px; display: grid; place-items: center; cursor: pointer; box-shadow: var(--shadow-sm); transition: transform 0.2s ease;">
      ❤️
    </button>
  `;

  const viewDetailBtn = `
    <button class="btn-view-details" type="button"
      data-product-id="${escapeHtml(product.productId || product.id)}"
      data-product-title="${escapeHtml(product.name)}"
      data-product-image="${escapeHtml(product.image || '')}"
      data-product-price="${escapeHtml(product.price != null ? String(product.price) : '')}"
      data-product-store="${escapeHtml(product.store || '')}"
      data-product-buy-url="${escapeHtml(product.buyUrl || '')}"
      data-product-brand="${escapeHtml(product.brand || '')}"
      data-product-delivery="${escapeHtml(product.delivery || '')}"
      data-product-rating="${escapeHtml(product.rating || '')}"
      data-product-reviews="${escapeHtml(product.reviews || '')}"
      style="width: 100%; background: var(--surface); color: var(--text-main); border: 1.5px solid var(--border); padding: 9px 12px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 6px;">
      🔍 View Details &amp; History
    </button>
  `;

  return `
    <article class="product-card"
      data-product-id="${escapeHtml(product.id)}"
      data-lookup-id="${escapeHtml(product.productId || product.id)}"
      data-product-title="${escapeHtml(product.name)}"
      data-product-image="${escapeHtml(product.image || '')}"
      data-product-price="${escapeHtml(product.price != null ? String(product.price) : '')}"
      data-product-store="${escapeHtml(product.store || '')}"
      data-product-buy-url="${escapeHtml(product.buyUrl || '')}"
      data-product-brand="${escapeHtml(product.brand || '')}"
      data-product-delivery="${escapeHtml(product.delivery || '')}"
      data-product-rating="${escapeHtml(product.rating || '')}"
      data-product-reviews="${escapeHtml(product.reviews || '')}">
      <div class="image-wrap clickable-product-view"
        data-product-id="${escapeHtml(product.productId || product.id)}"
        data-product-title="${escapeHtml(product.name)}"
        data-product-image="${escapeHtml(product.image || '')}"
        data-product-price="${escapeHtml(product.price != null ? String(product.price) : '')}"
        data-product-store="${escapeHtml(product.store || '')}"
        data-product-buy-url="${escapeHtml(product.buyUrl || '')}"
        data-product-brand="${escapeHtml(product.brand || '')}"
        data-product-delivery="${escapeHtml(product.delivery || '')}"
        data-product-rating="${escapeHtml(product.rating || '')}"
        data-product-reviews="${escapeHtml(product.reviews || '')}"
        style="position: relative; cursor: pointer;">
        ${image}
        ${wishlistBtn}
      </div>
      <div class="product-info">
        ${badge}
        <div class="product-meta-top">
          <span class="store">${escapeHtml(product.store)}</span>
          ${product.brand && product.brand !== 'Other / Unknown' ? `<span class="product-brand-tag">${escapeHtml(product.brand)}</span>` : ''}
        </div>
        <h3 class="product-title clickable-product-view"
          data-product-id="${escapeHtml(product.productId || product.id)}"
          data-product-title="${escapeHtml(product.name)}"
          data-product-image="${escapeHtml(product.image || '')}"
          data-product-price="${escapeHtml(product.price != null ? String(product.price) : '')}"
          data-product-store="${escapeHtml(product.store || '')}"
          data-product-buy-url="${escapeHtml(product.buyUrl || '')}"
          data-product-brand="${escapeHtml(product.brand || '')}"
          data-product-delivery="${escapeHtml(product.delivery || '')}"
          data-product-rating="${escapeHtml(product.rating || '')}"
          data-product-reviews="${escapeHtml(product.reviews || '')}"
          title="${escapeHtml(product.name)}" style="cursor: pointer;">${escapeHtml(product.name)}</h3>
        <div class="price">${money(product.price)}</div>
        ${savings}
        <div class="meta">${rating}</div>
        <div class="meta">${escapeHtml(product.delivery || 'Delivery details at retailer')}</div>
        <div class="card-actions" style="display: flex; flex-direction: column; gap: 8px;">
          ${viewDetailBtn}
          <div style="display: flex; gap: 8px; width: 100%; flex-wrap: wrap; min-width: 0;">
            <div style="flex: 1; min-width: 0;">${buy}</div>
            ${compareBtn ? `<div style="flex: 1; min-width: 0;">${compareBtn}</div>` : ''}
          </div>
        </div>
      </div>
    </article>
  `;
}