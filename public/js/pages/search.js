/**
 * public/js/pages/search.js — Search Results Page (v3 "demo" design) (#/search/<query>)
 *
 * Features:
 * - "Results for X — N real listings found" header
 * - Left filter panel: platform checkboxes with real counts, price range, in-stock
 * - Sort dropdown (relevance / price / rating / stores)
 * - Demo-style product cards with wishlist hearts
 */

import { searchProducts, addToWishlist, removeFromWishlist } from '../api.js';
import { renderProductCard, escapeHtml } from '../product-card.js';
import { AuthState } from '../auth.js';

export async function renderSearchPage(container, query) {
  if (!container) return;

  const decodedQuery = decodeURIComponent(query || '').trim();

  container.innerHTML = `
    <div class="search-page-container">
      <!-- Search Page Header -->
      <div class="search-page-top">
        <div class="search-breadcrumbs">
          <a href="#/" class="breadcrumb-link">← Home</a>
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-current">Search Results</span>
        </div>

        <!-- Inline search bar to quickly refine query -->
        <form id="searchPageForm" class="search-page-bar">
          <input
            type="search"
            id="searchPageInput"
            value="${escapeHtml(decodedQuery)}"
            placeholder="Search products..."
            required
            autocomplete="off"
          />
          <button type="submit" class="search-page-submit">Search</button>
        </form>

        <div class="search-heading-row">
          <h1 class="search-title">Results for <span class="query-highlight">“${escapeHtml(decodedQuery)}”</span></h1>
          <p id="searchStatusText" class="search-status-text">Fetching live offers across 12 platforms...</p>
        </div>
      </div>

      <!-- Loading layout: filters skeleton + cards skeleton -->
      <div class="search-layout">
        <aside id="searchFilterPanel" class="search-filter-panel" aria-label="Search filters">
          <div class="filter-skeleton-block"></div>
          <div class="filter-skeleton-block short"></div>
        </aside>

        <div class="search-results-area">
          <div id="searchGridContainer" class="search-results-grid">
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

  // Search input handler
  const form = container.querySelector('#searchPageForm');
  const input = container.querySelector('#searchPageInput');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const newQuery = input?.value.trim();
    if (newQuery) {
      window.location.hash = `#/search/${encodeURIComponent(newQuery)}`;
    }
  });

  const gridContainer = container.querySelector('#searchGridContainer');
  const statusText = container.querySelector('#searchStatusText');
  const filterPanel = container.querySelector('#searchFilterPanel');

  if (!decodedQuery) {
    if (gridContainer) {
      gridContainer.innerHTML = `
        <div class="search-empty-box">
          <span class="empty-icon">⌕</span>
          <h3>Enter a product name</h3>
          <p>Search for any smartphone, laptop, gadget, or appliance to compare prices.</p>
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
      if (statusText) statusText.textContent = '0 products found';
      if (filterPanel) filterPanel.style.display = 'none';
      gridContainer.innerHTML = `
        <div class="search-empty-box">
          <span class="empty-icon">🛍️</span>
          <h3>No matching products found</h3>
          <p>We could not find verified offers matching “${escapeHtml(decodedQuery)}”.</p>
          <p class="empty-tip">Tip: Try searching for a brand and model name (e.g. “iPhone 16” or “Sony WH-1000XM5”).</p>
          <a href="#/" class="back-home-btn">← Back to Home</a>
        </div>
      `;
      return;
    }

    if (statusText) {
      statusText.innerHTML = `<strong>${products.length} real listing${products.length === 1 ? '' : 's'}</strong> found — comparing ${countUniqueStores(products)}+ stores`;
    }

    // ---- Build platform counts from real results ----
    const storeCounts = new Map();
    products.forEach(p => {
      const stores = new Set();
      if (p.store) stores.add(p.store);
      if (Array.isArray(p.stores)) p.stores.forEach(s => { if (s.store) stores.add(s.store); });
      if (stores.size === 0) stores.add(p.brand || 'Other');
      stores.forEach(s => storeCounts.set(s, (storeCounts.get(s) || 0) + 1));
    });
    const storeOptions = Array.from(storeCounts.entries()).sort((a, b) => b[1] - a[1]);

    // ---- Price bounds from real results ----
    const prices = products.map(p => Number(p.lowestPrice ?? p.price)).filter(v => Number.isFinite(v) && v > 0);
    const minBound = prices.length ? Math.floor(Math.min(...prices)) : 0;
    const maxBound = prices.length ? Math.ceil(Math.max(...prices)) : 0;

    // ---- Render filter panel ----
    if (filterPanel) {
      filterPanel.innerHTML = `
        <div class="filter-panel-header">
          <h3>Filters</h3>
          <button type="button" id="clearFiltersBtn" class="filter-clear-btn">Clear all</button>
        </div>

        <div class="filter-section">
          <h4 class="filter-section-title">Platform</h4>
          <div class="filter-checkbox-list">
            ${storeOptions.map(([store, count]) => `
              <label class="filter-check-item">
                <input type="checkbox" class="store-filter-cb" value="${escapeHtml(store)}" />
                <span class="filter-check-name">${escapeHtml(store)}</span>
                <span class="filter-check-count">${count}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="filter-section">
          <h4 class="filter-section-title">Price range (₹)</h4>
          <div class="price-range-row">
            <input type="number" id="priceMinInput" class="price-range-input" placeholder="${minBound}" min="0" inputmode="numeric" aria-label="Minimum price" />
            <span class="price-range-dash">—</span>
            <input type="number" id="priceMaxInput" class="price-range-input" placeholder="${maxBound}" min="0" inputmode="numeric" aria-label="Maximum price" />
          </div>
        </div>

        <div class="filter-section">
          <h4 class="filter-section-title">Availability</h4>
          <label class="filter-check-item">
            <input type="checkbox" id="inStockCheckbox" />
            <span class="filter-check-name">In stock only</span>
          </label>
        </div>
      `;
    }

    // ---- Sort bar ----
    const resultsArea = container.querySelector('.search-results-area');
    const sortBarHtml = `
      <div class="search-toolbar">
        <span class="toolbar-count" id="filterCount">Showing ${products.length} of ${products.length}</span>
        <div class="filter-group">
          <label for="sortSelect" class="filter-label">Sort by</label>
          <select id="sortSelect" class="filter-select">
            <option value="relevance">Relevance</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating_desc">Highest Rated</option>
            <option value="stores_desc">Most Store Offers</option>
          </select>
        </div>
      </div>
    `;
    if (resultsArea && !container.querySelector('.search-toolbar')) {
      resultsArea.insertAdjacentHTML('afterbegin', sortBarHtml);
    }

    // ---- Filter state ----
    let activeSort = 'relevance';
    const activeStores = new Set();
    let priceMin = null;
    let priceMax = null;
    let onlyInStock = false;

    function applyFiltersAndRender() {
      let filtered = [...products];

      if (activeStores.size > 0) {
        filtered = filtered.filter(p => {
          const stores = new Set();
          if (p.store) stores.add(p.store);
          if (Array.isArray(p.stores)) p.stores.forEach(s => { if (s.store) stores.add(s.store); });
          if (stores.size === 0) stores.add(p.brand || 'Other');
          for (const s of stores) { if (activeStores.has(s)) return true; }
          return false;
        });
      }

      if (priceMin != null) {
        filtered = filtered.filter(p => (Number(p.lowestPrice ?? p.price) || 0) >= priceMin);
      }
      if (priceMax != null) {
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

      const countEl = container.querySelector('#filterCount');
      if (countEl) countEl.textContent = `Showing ${filtered.length} of ${products.length}`;

      if (filtered.length === 0) {
        gridContainer.innerHTML = `
          <div class="search-empty-box" style="grid-column: 1 / -1;">
            <span class="empty-icon">🔍</span>
            <h3>No products match these filters</h3>
            <p>Try removing some filters or widening the price range.</p>
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

    const priceMinInput = container.querySelector('#priceMinInput');
    const priceMaxInput = container.querySelector('#priceMaxInput');
    const debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    const onPriceChange = debounce(() => {
      priceMin = priceMinInput?.value ? Number(priceMinInput.value) : null;
      priceMax = priceMaxInput?.value ? Number(priceMaxInput.value) : null;
      applyFiltersAndRender();
    });
    priceMinInput?.addEventListener('input', onPriceChange);
    priceMaxInput?.addEventListener('input', onPriceChange);

    const inStockCb = container.querySelector('#inStockCheckbox');
    inStockCb?.addEventListener('change', (e) => {
      onlyInStock = e.target.checked;
      applyFiltersAndRender();
    });

    container.querySelector('#clearFiltersBtn')?.addEventListener('click', () => {
      activeStores.clear();
      priceMin = priceMax = null;
      onlyInStock = false;
      filterPanel?.querySelectorAll('.store-filter-cb').forEach(cb => { cb.checked = false; });
      if (priceMinInput) priceMinInput.value = '';
      if (priceMaxInput) priceMaxInput.value = '';
      if (inStockCb) inStockCb.checked = false;
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

function countUniqueStores(products) {
  const set = new Set();
  products.forEach(p => {
    if (p.store) set.add(p.store);
    if (Array.isArray(p.stores)) p.stores.forEach(s => { if (s.store) set.add(s.store); });
  });
  return set.size;
}

/**
 * Delegated wishlist heart handling for the results grid.
 * Clicking the heart never navigates — it toggles wishlist membership.
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

    // Must be signed in
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
