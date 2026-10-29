/**
 * public/js/pages/search.js — Search Results Page (v4 demo design) (#/search/<query>)
 *
 * Layout:
 * - Left sidebar: Filters (Category/Brand counts, Platform checkboxes with
 *   colored dots + real counts, MAX PRICE slider, In-stock, Clear all)
 * - Main: "Results for X" + "N real listings found" + Best match sort
 * - Demo-style product cards with wishlist hearts
 */

import { searchProducts, addToWishlist, removeFromWishlist } from '../api.js';
import { renderProductCard, escapeHtml, storeColor } from '../product-card.js';
import { AuthState } from '../auth.js';

export async function renderSearchPage(container, query) {
  if (!container) return;

  const decodedQuery = decodeURIComponent(query || '').trim();

  container.innerHTML = `
    <div class="search-page-container v4-search">
      <!-- Loading layout: filters + cards -->
      <div class="v4-search-layout">
        <aside id="searchFilterPanel" class="v4-filter-panel" aria-label="Search filters">
          <div class="filter-skeleton-block"></div>
          <div class="filter-skeleton-block short"></div>
        </aside>

        <div class="v4-results-area">
          <div class="v4-results-head">
            <div>
              <h1 class="v4-results-title">Results for <span class="v4-gradient-text">“${escapeHtml(decodedQuery)}”</span></h1>
              <p id="searchStatusText" class="v4-results-count">Searching live listings across 12 platforms...</p>
            </div>
            <div class="v4-sort-wrap">
              <label for="sortSelect" class="sr-only">Sort results</label>
              <select id="sortSelect" class="v4-sort-select">
                <option value="relevance">Best match</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating_desc">Highest Rated</option>
                <option value="stores_desc">Most Store Offers</option>
              </select>
            </div>
          </div>

          <div id="searchGridContainer" class="v4-results-grid">
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const gridContainer = container.querySelector('#searchGridContainer');
  const statusText = container.querySelector('#searchStatusText');
  const filterPanel = container.querySelector('#searchFilterPanel');

  if (!decodedQuery) {
    if (gridContainer) {
      gridContainer.innerHTML = `
        <div class="search-empty-box">
          <span class="empty-icon">⌕</span>
          <h3>Enter a product name</h3>
          <p>Search for any smartphone, gadget, grocery or appliance to compare live prices.</p>
        </div>
      `;
    }
    if (statusText) statusText.textContent = '';
    if (filterPanel) filterPanel.style.display = 'none';
    return;
  }

  try {
    const data = await searchProducts(decodedQuery);
    const products = Array.isArray(data.products) ? data.products : [];

    if (!gridContainer) return;

    if (products.length === 0) {
      if (statusText) statusText.textContent = '0 real listings found';
      if (filterPanel) filterPanel.style.display = 'none';
      gridContainer.innerHTML = `
        <div class="search-empty-box" style="grid-column: 1 / -1;">
          <span class="empty-icon">🛍️</span>
          <h3>No matching products found</h3>
          <p>We could not find live listings matching “${escapeHtml(decodedQuery)}”.</p>
          <p class="empty-tip">Tip: Try a brand and model name (e.g. “iPhone 16” or “Maggi noodles”).</p>
          <a href="#/" class="back-home-btn">← Back to Home</a>
        </div>
      `;
      return;
    }

    if (statusText) statusText.textContent = `${products.length} real listing${products.length === 1 ? '' : 's'} found`;

    // ---- Build platform counts from real results ----
    const storesOf = (p) => {
      const set = new Set();
      if (p.store) set.add(p.store);
      if (Array.isArray(p.stores)) p.stores.forEach(s => { if (s.store) set.add(s.store); });
      if (set.size === 0) set.add(p.brand || 'Other');
      return set;
    };

    const storeCounts = new Map();
    products.forEach(p => storesOf(p).forEach(s => storeCounts.set(s, (storeCounts.get(s) || 0) + 1)));
    const storeOptions = Array.from(storeCounts.entries()).sort((a, b) => b[1] - a[1]);

    // ---- Brand/category counts ----
    const brandOf = (p) => {
      const raw = (p.brand || '').trim();
      if (raw && !/^other\s*\/\s*unknown$/i.test(raw)) return raw;
      return (p.name || '').trim().split(/\s+/)[0] || 'Other';
    };
    const brandCounts = new Map();
    products.forEach(p => {
      const b = brandOf(p);
      brandCounts.set(b, (brandCounts.get(b) || 0) + 1);
    });
    const brandOptions = Array.from(brandCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // ---- Price bounds ----
    const prices = products.map(p => Number(p.lowestPrice ?? p.price)).filter(v => Number.isFinite(v) && v > 0);
    const minBound = prices.length ? Math.floor(Math.min(...prices)) : 0;
    const maxBound = prices.length ? Math.ceil(Math.max(...prices)) : 0;

    // ---- Render demo filter sidebar ----
    if (filterPanel) {
      filterPanel.innerHTML = `
        <div class="v4-filter-head">
          <h3><span aria-hidden="true">⚙</span> Filters</h3>
          <button type="button" id="clearFiltersBtn" class="v4-filter-clear">Clear all</button>
        </div>

        <div class="v4-filter-section">
          <h4 class="v4-filter-title">Category</h4>
          <button type="button" class="v4-cat-link" id="allCatBtn">All categories</button>
          ${brandOptions.map(([b, c]) => `
            <button type="button" class="v4-cat-link" data-brand="${escapeHtml(b)}">
              ${escapeHtml(b)} <span class="v4-cat-count">${c}</span>
            </button>
          `).join('')}
        </div>

        <div class="v4-filter-section">
          <h4 class="v4-filter-title">Platforms (${storeOptions.length})</h4>
          <div class="v4-platform-checks">
            ${storeOptions.map(([store, count]) => `
              <label class="v4-check-row">
                <input type="checkbox" class="store-filter-cb" value="${escapeHtml(store)}" />
                <i class="v4-store-dot" style="background:${storeColor(store)}"></i>
                <span class="v4-check-name">${escapeHtml(store)}</span>
                <span class="v4-cat-count">${count}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="v4-filter-section">
          <h4 class="v4-filter-title" id="priceLabel">Max price: any</h4>
          <input type="range" id="priceRangeSlider" class="v4-price-slider"
            min="${minBound}" max="${maxBound}" value="${maxBound}" step="1"
            aria-label="Maximum price" />
          <div class="v4-slider-bounds">
            <span>₹${minBound.toLocaleString('en-IN')}</span>
            <span>₹${maxBound.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div class="v4-filter-section">
          <label class="v4-check-row">
            <input type="checkbox" id="inStockCheckbox" />
            <span class="v4-check-name">In stock only</span>
          </label>
        </div>
      `;
    }

    // ---- Filter state ----
    let activeSort = 'relevance';
    const activeStores = new Set();
    let activeBrand = null;
    let priceMax = maxBound;
    let priceTouched = false;
    let onlyInStock = false;

    function applyFiltersAndRender() {
      let filtered = [...products];

      if (activeStores.size > 0) {
        filtered = filtered.filter(p => {
          const stores = storesOf(p);
          for (const s of stores) { if (activeStores.has(s)) return true; }
          return false;
        });
      }

      if (activeBrand) {
        filtered = filtered.filter(p => brandOf(p) === activeBrand);
      }

      if (priceTouched && priceMax != null) {
        filtered = filtered.filter(p => (Number(p.lowestPrice ?? p.price) || 0) <= priceMax);
      }

      if (onlyInStock) {
        filtered = filtered.filter(p => p.inStock !== false && p.outOfStock !== true);
      }

      if (activeSort === 'price_asc') {
        filtered.sort((a, b) => (Number(a.lowestPrice ?? a.price) || 0) - (Number(b.lowestPrice ?? b.price) || 0));
      } else if (activeSort === 'price_desc') {
        filtered.sort((a, b) => (Number(b.lowestPrice ?? b.price) || 0) - (Number(a.lowestPrice ?? a.price) || 0));
      } else if (activeSort === 'rating_desc') {
        filtered.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
      } else if (activeSort === 'stores_desc') {
        filtered.sort((a, b) => ((b.storeCount || b.stores?.length || 1) - (a.storeCount || a.stores?.length || 1)));
      }

      if (filtered.length === 0) {
        gridContainer.innerHTML = `
          <div class="search-empty-box" style="grid-column: 1 / -1;">
            <span class="empty-icon">🔍</span>
            <h3>No products match these filters</h3>
            <p>Try removing some filters or raising the max price.</p>
          </div>
        `;
      } else {
        gridContainer.innerHTML = filtered.map(renderProductCard).join('');
      }
    }

    // ---- Filter events ----
    filterPanel?.querySelectorAll('.store-filter-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) activeStores.add(cb.value);
        else activeStores.delete(cb.value);
        applyFiltersAndRender();
      });
    });

    filterPanel?.querySelectorAll('[data-brand]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeBrand = (activeBrand === btn.getAttribute('data-brand')) ? null : btn.getAttribute('data-brand');
        filterPanel.querySelectorAll('[data-brand]').forEach(b => b.classList.toggle('active', b.getAttribute('data-brand') === activeBrand));
        applyFiltersAndRender();
      });
    });

    filterPanel?.querySelector('#allCatBtn')?.addEventListener('click', () => {
      activeBrand = null;
      filterPanel.querySelectorAll('[data-brand]').forEach(b => b.classList.remove('active'));
      applyFiltersAndRender();
    });

    const slider = container.querySelector('#priceRangeSlider');
    const priceLabel = container.querySelector('#priceLabel');
    slider?.addEventListener('input', () => {
      priceMax = Number(slider.value);
      priceTouched = priceMax < maxBound;
      if (priceLabel) priceLabel.textContent = priceTouched ? `Max price: ₹${priceMax.toLocaleString('en-IN')}` : 'Max price: any';
      applyFiltersAndRender();
    });

    const inStockCb = container.querySelector('#inStockCheckbox');
    inStockCb?.addEventListener('change', (e) => {
      onlyInStock = e.target.checked;
      applyFiltersAndRender();
    });

    container.querySelector('#clearFiltersBtn')?.addEventListener('click', () => {
      activeStores.clear();
      activeBrand = null;
      priceTouched = false;
      priceMax = maxBound;
      onlyInStock = false;
      if (slider) { slider.value = String(maxBound); }
      if (priceLabel) priceLabel.textContent = 'Max price: any';
      if (inStockCb) inStockCb.checked = false;
      filterPanel?.querySelectorAll('.store-filter-cb').forEach(cb => { cb.checked = false; });
      filterPanel?.querySelectorAll('[data-brand]').forEach(b => b.classList.remove('active'));
      applyFiltersAndRender();
    });

    const sortSelect = container.querySelector('#sortSelect');
    sortSelect?.addEventListener('change', (e) => {
      activeSort = e.target.value;
      applyFiltersAndRender();
    });

    // ---- Wishlist hearts (delegated) ----
    setupWishlistHearts(gridContainer, products);

    applyFiltersAndRender();

  } catch (err) {
    console.error('Search error:', err);
    if (gridContainer) {
      gridContainer.innerHTML = `
        <div class="search-error-box">
          <span class="error-icon">⚠️</span>
          <h3>Could not complete search</h3>
          <p>${escapeHtml(err.message || 'Network problem or API quota exceeded. Please try again.')}</p>
          <button type="button" id="searchRetryBtn" class="retry-btn">Try Again</button>
        </div>
      `;
      gridContainer.querySelector('#searchRetryBtn')?.addEventListener('click', () => {
        renderSearchPage(container, query);
      });
    }
    if (statusText) statusText.textContent = 'Search failed';
  }
}

/**
 * Delegated wishlist heart handling for the results grid.
 */
function setupWishlistHearts(gridContainer, products) {
  if (!gridContainer) return;

  gridContainer.addEventListener('click', async (e) => {
    const heartBtn = e.target.closest('.card-wish-btn');
    if (!heartBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const card = heartBtn.closest('.product-card');
    const prodId = card?.getAttribute('data-product-id');
    if (!prodId) return;

    if (!AuthState.isLoggedIn()) {
      window.location.hash = '#/profile';
      return;
    }

    const product = products.find(p => (p.productId || p.id || encodeURIComponent(p.name)) === prodId);
    if (!product) return;

    const isActive = heartBtn.classList.contains('wish-active');

    try {
      if (isActive) {
        await removeFromWishlist(AuthState.getToken(), prodId);
        heartBtn.classList.remove('wish-active');
        heartBtn.setAttribute('aria-label', 'Add to wishlist');
      } else {
        await addToWishlist(AuthState.getToken(), {
          productId: prodId,
          name: product.name || '',
          image: product.image || '',
          price: product.lowestPrice ?? product.price ?? '',
          store: product.store || '',
          brand: product.brand || '',
          rating: product.rating || ''
        });
        heartBtn.classList.add('wish-active');
        heartBtn.setAttribute('aria-label', 'Remove from wishlist');
      }
    } catch (err) {
      console.error('Wishlist error:', err);
    }
  });
}
