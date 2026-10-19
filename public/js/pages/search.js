/**
 * public/js/pages/search.js — Search Results Page (#/search/<query>)
 *
 * Dedicated search results page displaying:
 * - Query header and result count
 * - Product cards with photo, name, lowest price, store count, and rating
 * - Loading skeletons, empty states, and error handling
 */

import { searchProducts } from '../api.js';
import { renderProductCard, escapeHtml } from '../product-card.js';

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
          <p id="searchStatusText" class="search-status-text">Fetching verified offers across 15 platforms...</p>
        </div>
      </div>

      <!-- Results Grid Container -->
      <div id="searchGridContainer" class="search-results-grid">
        <!-- Loading skeletons -->
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
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
    return;
  }

  try {
    const data = await searchProducts(decodedQuery);
    const products = Array.isArray(data.products) ? data.products : [];

    if (!gridContainer) return;

    if (products.length === 0) {
      if (statusText) statusText.textContent = '0 products found';
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
      statusText.textContent = `Found ${products.length} product${products.length === 1 ? '' : 's'} across top Indian platforms`;
    }

    // Extract unique stores from current products
    const storeSet = new Set();
    products.forEach(p => {
      if (p.store) storeSet.add(p.store);
      if (Array.isArray(p.stores)) {
        p.stores.forEach(s => { if (s.store) storeSet.add(s.store); });
      }
    });
    const storeOptions = Array.from(storeSet).sort();

    // Insert Sort and Filter Bar
    const filterBarHtml = `
      <div class="search-filter-bar">
        <div class="filter-controls-left">
          <div class="filter-group">
            <label for="sortSelect" class="filter-label">Sort by:</label>
            <select id="sortSelect" class="filter-select">
              <option value="relevance">Relevance</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating_desc">Highest Rated</option>
              <option value="stores_desc">Most Store Offers</option>
            </select>
          </div>

          <div class="filter-group">
            <label for="storeSelect" class="filter-label">Filter Store:</label>
            <select id="storeSelect" class="filter-select">
              <option value="all">All Stores (${storeOptions.length})</option>
              ${storeOptions.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
            </select>
          </div>

          <label class="filter-checkbox-label">
            <input type="checkbox" id="inStockCheckbox">
            <span>In stock only</span>
          </label>
        </div>

        <div class="filter-results-count" id="filterCount">
          Showing ${products.length} of ${products.length}
        </div>
      </div>
    `;

    // Append filter bar before gridContainer
    const topSection = container.querySelector('.search-page-top');
    if (topSection && !container.querySelector('.search-filter-bar')) {
      topSection.insertAdjacentHTML('afterend', filterBarHtml);
    }

    let activeSort = 'relevance';
    let activeStore = 'all';
    let onlyInStock = false;

    function applyFiltersAndRender() {
      let filtered = [...products];

      // Store filter
      if (activeStore !== 'all') {
        filtered = filtered.filter(p => {
          if (p.store === activeStore) return true;
          if (Array.isArray(p.stores) && p.stores.some(s => s.store === activeStore)) return true;
          return false;
        });
      }

      // In stock filter
      if (onlyInStock) {
        filtered = filtered.filter(p => p.inStock !== false && p.outOfStock !== true);
      }

      // Sort
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
            <p>Try resetting the store filter or showing all items.</p>
          </div>
        `;
      } else {
        gridContainer.innerHTML = filtered.map(renderProductCard).join('');
      }
    }

    // Attach filter event listeners
    const sortSelect = container.querySelector('#sortSelect');
    const storeSelect = container.querySelector('#storeSelect');
    const inStockCb = container.querySelector('#inStockCheckbox');

    sortSelect?.addEventListener('change', (e) => {
      activeSort = e.target.value;
      applyFiltersAndRender();
    });

    storeSelect?.addEventListener('change', (e) => {
      activeStore = e.target.value;
      applyFiltersAndRender();
    });

    inStockCb?.addEventListener('change', (e) => {
      onlyInStock = e.target.checked;
      applyFiltersAndRender();
    });

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
