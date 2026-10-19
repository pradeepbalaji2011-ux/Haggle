/**
 * public/js/product-card.js — Product Card Component
 *
 * Displays a clean, mobile-first card for search results:
 * - Photo
 * - Name
 * - Lowest price (in ₹ INR)
 * - Store count
 * - Rating
 * - Click target navigates to #/product/<id>
 */

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
 * Creates HTML string for a product card
 *
 * @param {object} product - Product object
 * @returns {string} HTML string
 */
export function renderProductCard(product) {
  const prodId = product.productId || product.id || encodeURIComponent(product.name);
  const detailUrl = `#/product/${encodeURIComponent(prodId)}?title=${encodeURIComponent(product.name || '')}&image=${encodeURIComponent(product.image || '')}&price=${encodeURIComponent(product.price || '')}&store=${encodeURIComponent(product.store || '')}&brand=${encodeURIComponent(product.brand || '')}&rating=${encodeURIComponent(product.rating || '')}&pageToken=${encodeURIComponent(product.pageToken || '')}&buyUrl=${encodeURIComponent(product.buyUrl || '')}`;

  const imageSrc = product.image
    ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="card-img" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22 viewBox=%220 0 200 200%22><rect fill=%22%23f3f4f6%22 width=%22200%22 height=%22200%22/><text fill=%22%239ca3af%22 font-family=%22sans-serif%22 font-size=%2214%22 dy=%2210.5%22 font-weight=%22bold%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22>No Image</text></svg>';">`
    : `<div class="card-img-placeholder" aria-hidden="true">🛍️</div>`;

  const lowestPrice = product.lowestPrice ?? product.price;
  const storeCount = product.storeCount || (product.stores ? product.stores.length : 1);
  const storeCountText = storeCount > 1 ? `${storeCount} store offers` : (product.store || 'Verified store');

  const ratingHtml = product.rating
    ? `<span class="card-rating">★ ${Number(product.rating).toFixed(1)}${product.reviews ? ` <span class="card-reviews">(${Number(product.reviews).toLocaleString()})</span>` : ''}</span>`
    : `<span class="card-rating-na">Ratings available at checkout</span>`;

  const primaryStore = product.store || (product.stores && product.stores[0]?.store) || 'Verified Retailer';
  const isAvailable = product.inStock !== false && product.outOfStock !== true;
  const stockBadge = isAvailable
    ? `<span class="stock-badge in-stock">● In stock</span>`
    : `<span class="stock-badge out-of-stock">○ Not available</span>`;

  return `
    <article class="product-card" data-product-id="${escapeHtml(prodId)}">
      <a href="${detailUrl}" class="card-link" aria-label="View details for ${escapeHtml(product.name)}">
        <div class="card-image-wrap">
          ${imageSrc}
          <div class="card-badge-row">
            ${stockBadge}
            ${product.savings > 0 ? `<span class="card-savings-badge">Save ${formatPrice(product.savings)}</span>` : ''}
          </div>
        </div>
        <div class="card-content">
          <div class="card-meta-top">
            <span class="card-brand">${escapeHtml(product.brand || 'Electronics')}</span>
            <span class="card-store-count">${escapeHtml(storeCountText)}</span>
          </div>
          <h3 class="card-title" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</h3>
          <div class="card-pricing-row">
            <div class="price-stack">
              <span class="card-price-label">Lowest at <strong class="store-highlight">${escapeHtml(primaryStore)}</strong></span>
              <div class="card-price">${formatPrice(lowestPrice)}</div>
            </div>
          </div>
          <div class="card-meta-bottom">
            ${ratingHtml}
            <span class="card-view-btn">Compare Stores ↗</span>
          </div>
        </div>
      </a>
    </article>
  `;
}