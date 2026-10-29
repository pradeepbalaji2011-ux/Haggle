/**
 * public/js/pages/home.js — Home Page (v3 "demo" design)
 *
 * Layout:
 * 1. Hero: live badge, "Search anything. Compare everywhere." gradient title,
 *    big search bar, suggestion chips, category chips
 * 2. Live stats band (real numbers from /api/health — stores responding now)
 * 3. Live Trending Deals (rotating real product cards from /api/featured)
 * 4. Top 12 stores launcher (accurate platform list)
 */

import { fetchFeaturedProducts } from '../api.js';
import { escapeHtml, formatPrice } from '../product-card.js';
import { proxyImg, IMG_FALLBACK, IMG_PERF_ATTRS } from '../img.js';

let rotationTimer = null;
let isPaused = false;
let currentProducts = [];
let currentIndex = 0;

/** The 12 platforms Haggle actually monitors (accurate, matches footer) */
const PLATFORMS = [
  { name: 'Amazon India', color: '#FF9900' },
  { name: 'Flipkart',     color: '#2874F0' },
  { name: 'Myntra',       color: '#FF3F6C' },
  { name: 'Meesho',       color: '#E91E63' },
  { name: 'AJIO',         color: '#2C4152' },
  { name: 'JioMart',      color: '#0078AD' },
  { name: 'Shopsy',       color: '#7C3AED' },
  { name: 'Snapdeal',     color: '#E40046' },
  { name: 'Nykaa',        color: '#FC2779' },
  { name: 'FirstCry',     color: '#FF6F61' },
  { name: 'Tata CLiQ',    color: '#0F172A' },
  { name: 'IndiaMART',    color: '#00A699' }
];

const CATEGORIES = [
  { icon: '📱', label: 'Mobiles',       query: 'smartphone 5G' },
  { icon: '💻', label: 'Laptops',       query: 'laptop' },
  { icon: '🎧', label: 'Audio',         query: 'wireless headphones' },
  { icon: '⌚', label: 'Watches',       query: 'smartwatch' },
  { icon: '👗', label: 'Fashion',       query: 'running shoes' },
  { icon: '💄', label: 'Beauty',        query: 'face serum' },
  { icon: '📺', label: 'Appliances',    query: 'smart tv' },
  { icon: '🛒', label: 'Grocery',       query: 'grocery' }
];

const SUGGESTIONS = [
  'Maggi noodles',
  'iPhone 16',
  'Sony headphones',
  'Nike sneakers',
  'Redmi Note 14',
  'Face serum'
];

export async function renderHomePage(container) {
  if (!container) return;

  // Clear existing timers from previous renders
  if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
  }

  container.innerHTML = `
    <div class="home-page">

      <!-- ============ HERO ============ -->
      <section class="home-hero v3-hero">
        <div class="hero-center-content">
          <div class="hero-badge">
            <span class="live-dot" aria-hidden="true"></span>
            LIVE PRICES · 12 PLATFORMS · UPDATED CONTINUOUSLY
          </div>

          <h1 class="hero-title">
            Search anything.<br>
            <span class="gradient-text">Compare everywhere.</span>
          </h1>

          <p class="hero-subtitle">
            One search. Real prices from Amazon, Flipkart, Myntra, Meesho and India's top
            12 shopping platforms — so you never overpay again.
          </p>

          <!-- Large Search Box -->
          <form id="homeSearchForm" class="home-search-bar" role="search">
            <div class="search-input-container">
              <span class="search-glass-icon" aria-hidden="true">⌕</span>
              <input
                id="homeSearchInput"
                type="search"
                class="home-search-input"
                placeholder="Search iPhone 16, Maggi noodles, sneakers, smart TV..."
                autocomplete="off"
                required
                aria-label="Search products"
              />
              <button type="button" id="homeSearchClear" class="search-clear-btn" aria-label="Clear search" style="display: none;">✕</button>
            </div>
            <button type="submit" class="home-search-submit">
              <span>Compare</span>
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <!-- Suggestion chips -->
          <div class="home-suggest-strip">
            <span class="trending-title">Try:</span>
            <div class="trending-pills">
              ${SUGGESTIONS.map(s => `<button type="button" class="trend-pill" data-query="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
            </div>
          </div>

          <!-- Category chips -->
          <nav class="home-category-strip" aria-label="Browse categories">
            ${CATEGORIES.map(c => `
              <a href="#/search/${encodeURIComponent(c.query)}" class="category-chip">
                <span class="cat-icon" aria-hidden="true">${c.icon}</span>
                <span>${escapeHtml(c.label)}</span>
              </a>
            `).join('')}
          </nav>
        </div>
      </section>

      <!-- ============ LIVE STATS BAND ============ -->
      <section class="home-stats-band" aria-label="Live platform statistics">
        <div class="stats-band-inner">
          <div class="stat-cell">
            <span class="stat-number" id="statPlatforms">12</span>
            <span class="stat-label">Connected platforms</span>
          </div>
          <div class="stat-divider" aria-hidden="true"></div>
          <div class="stat-cell">
            <span class="stat-number stat-live" id="statResponding"><span class="mini-spinner" aria-hidden="true"></span></span>
            <span class="stat-label">Stores responding now</span>
          </div>
          <div class="stat-divider" aria-hidden="true"></div>
          <div class="stat-cell">
            <span class="stat-number">24/7</span>
            <span class="stat-label">Price drop tracking</span>
          </div>
        </div>
      </section>

      <!-- ============ LIVE DEALS + CATEGORIES HUB ============ -->
      <div class="home-hub-grid">
        <!-- Left: Live Trending Product Deals -->
        <section class="home-shuffle-panel" aria-label="Live Featured Products">
          <div class="shuffle-header-row">
            <div class="shuffle-label">
              <span class="pulse-indicator" aria-hidden="true"></span>
              <h3>Live Trending Deals</h3>
              <span class="shuffle-note">(Autoplays · hover to pause)</span>
            </div>
            <div class="shuffle-controls">
              <button type="button" id="shufflePrevBtn" class="shuffle-nav-btn" aria-label="Previous product">←</button>
              <button type="button" id="shuffleNextBtn" class="shuffle-nav-btn" aria-label="Next product">→</button>
            </div>
          </div>

          <div id="homeShuffleViewport" class="shuffle-viewport" tabindex="0">
            <div class="shuffle-loading-skeleton">
              <div class="skeleton-card"></div>
              <div class="skeleton-card"></div>
            </div>
          </div>
        </section>

        <!-- Right: Top 12 Stores Launcher -->
        <section class="home-launcher-panel" aria-label="Top Stores">
          <div class="launcher-block">
            <div class="launcher-header">
              <h3>Top Stores We Compare</h3>
              <span class="launcher-note">12 Authorized Platforms</span>
            </div>
            <div class="stores-grid-compact">
              ${PLATFORMS.map(p => `
                <a href="#/search/${encodeURIComponent(p.name)}" class="store-chip-compact">
                  <span class="store-dot" style="background-color: ${p.color};"></span>${escapeHtml(p.name)}
                </a>
              `).join('')}
            </div>
          </div>
        </section>
      </div>

      <!-- ============ TRUST BAR ============ -->
      <section class="home-trust-bar">
        <div class="trust-bar-item">
          <span class="trust-bar-icon">🎯</span>
          <span>Direct official retailer links only</span>
        </div>
        <div class="trust-bar-item">
          <span class="trust-bar-icon">🛡️</span>
          <span>Zero fake listings or spam</span>
        </div>
        <div class="trust-bar-item">
          <span class="trust-bar-icon">🔔</span>
          <span>Free price drop email alerts</span>
        </div>
      </section>
    </div>
  `;

  // ---- Search form ----
  const form = container.querySelector('#homeSearchForm');
  const input = container.querySelector('#homeSearchInput');
  const clearBtn = container.querySelector('#homeSearchClear');

  if (input && clearBtn) {
    input.addEventListener('input', () => {
      clearBtn.style.display = input.value.trim() ? 'flex' : 'none';
    });
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      input.focus();
    });
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input?.value.trim();
    if (query) {
      window.location.hash = `#/search/${encodeURIComponent(query)}`;
    }
  });

  // ---- Suggestion chips ----
  container.querySelectorAll('.trend-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-query');
      if (q) window.location.hash = `#/search/${encodeURIComponent(q)}`;
    });
  });

  // ---- Live stats from /api/health (real numbers, no fake claims) ----
  loadLiveStats(container);

  // ---- Featured products ----
  try {
    const data = await fetchFeaturedProducts();
    currentProducts = Array.isArray(data.products) && data.products.length > 0 ? data.products : [];

    const viewport = container.querySelector('#homeShuffleViewport');
    if (!viewport) return;

    if (currentProducts.length === 0) {
      viewport.innerHTML = `
        <div class="shuffle-empty-state">
          <p>Live featured prices will appear here once initial searches are cached.</p>
        </div>
      `;
      return;
    }

    renderShuffleCards(viewport);
    startRotationTimer(viewport);

    container.querySelector('#shufflePrevBtn')?.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + currentProducts.length) % currentProducts.length;
      renderShuffleCards(viewport);
    });

    container.querySelector('#shuffleNextBtn')?.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % currentProducts.length;
      renderShuffleCards(viewport);
    });

    viewport.addEventListener('mouseenter', () => { isPaused = true; });
    viewport.addEventListener('mouseleave', () => { isPaused = false; });
    viewport.addEventListener('touchstart', () => { isPaused = true; }, { passive: true });
    viewport.addEventListener('touchend', () => { isPaused = false; }, { passive: true });

  } catch (err) {
    const viewport = container.querySelector('#homeShuffleViewport');
    if (viewport) {
      viewport.innerHTML = `
        <div class="shuffle-empty-state">
          <p>Search for any product above to compare real-time prices across 12 verified platforms.</p>
        </div>
      `;
    }
  }
}

/**
 * Loads live store health from /api/health and fills the stats band.
 * Never invents numbers — shows real responding store count.
 */
async function loadLiveStats(container) {
  const el = container.querySelector('#statResponding');
  if (!el) return;

  try {
    const res = await fetch('/api/health', { headers: { 'Accept': 'application/json' } });
    const data = await res.json();
    const scrapers = data && data.scrapers ? Object.values(data.scrapers) : [];
    const responding = scrapers.filter(s => s && s.status === 'ok').length;
    el.textContent = String(responding);
  } catch {
    el.textContent = '—';
  }
}

function renderShuffleCards(viewport) {
  if (!viewport || currentProducts.length === 0) return;

  const visibleCount = window.innerWidth < 768 ? 1 : 2;
  const cardsToDisplay = [];

  for (let i = 0; i < visibleCount; i++) {
    const item = currentProducts[(currentIndex + i) % currentProducts.length];
    cardsToDisplay.push(item);
  }

  const cardsHtml = cardsToDisplay.map((p, idx) => {
    const prodId = p.productId || p.id || encodeURIComponent(p.name);
    const detailUrl = `#/product/${encodeURIComponent(prodId)}?title=${encodeURIComponent(p.name || '')}&image=${encodeURIComponent(p.image || '')}&price=${encodeURIComponent(p.price || '')}&store=${encodeURIComponent(p.store || '')}&brand=${encodeURIComponent(p.brand || '')}&rating=${encodeURIComponent(p.rating || '')}`;

    return `
      <div class="shuffle-product-card ${idx === 0 ? 'slide-active' : ''}">
        <a href="${detailUrl}" class="shuffle-card-link">
          <div class="shuffle-img-wrap">
            <img src="${escapeHtml(proxyImg(p.image))}" alt="${escapeHtml(p.name)}" class="shuffle-img" loading="eager" ${IMG_PERF_ATTRS} width="200" height="200" onerror="this.onerror=null; this.src='${IMG_FALLBACK}';" />
            <span class="shuffle-store-tag">${escapeHtml(p.store || 'Verified Store')}</span>
          </div>
          <div class="shuffle-card-body">
            <h4 class="shuffle-card-title" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h4>
            <div class="shuffle-price-row">
              <span class="shuffle-price">${formatPrice(p.lowestPrice ?? p.price)}</span>
              ${p.savings > 0 ? `<span class="shuffle-savings">Save ${formatPrice(p.savings)}</span>` : ''}
            </div>
            <span class="shuffle-action-btn">Compare Stores ↗</span>
          </div>
        </a>
      </div>
    `;
  }).join('');

  viewport.innerHTML = `<div class="shuffle-cards-track">${cardsHtml}</div>`;
}

function startRotationTimer(viewport) {
  if (rotationTimer) clearInterval(rotationTimer);
  rotationTimer = setInterval(() => {
    if (!isPaused && currentProducts.length > 1) {
      currentIndex = (currentIndex + 1) % currentProducts.length;
      renderShuffleCards(viewport);
    }
  }, 4000);
}
