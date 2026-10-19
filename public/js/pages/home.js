/**
 * public/js/pages/home.js — Minimal Home Page
 *
 * Shows:
 * 1. Header (in topbar)
 * 2. Large search box
 * 3. Row of live product cards (photo, name, price) from /api/featured that shuffles
 *    or rotates automatically every few seconds and can be paused on hover or touch.
 * Categories grid, deals sections, "how it works", and stores strip are completely removed.
 */

import { fetchFeaturedProducts } from '../api.js';
import { escapeHtml, formatPrice } from '../product-card.js';

let rotationTimer = null;
let isPaused = false;
let currentProducts = [];
let currentIndex = 0;

export async function renderHomePage(container) {
  if (!container) return;

  // Clear existing timers
  if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
  }

  container.innerHTML = `
    <div class="home-page">
      <!-- Minimal Hero Search Section -->
      <section class="home-hero">
        <div class="hero-center-content">
          <div class="hero-badge">
            <span class="live-dot" aria-hidden="true"></span>
            COMPARE LIVE PRICES ACROSS TOP 20 INDIAN PLATFORMS
          </div>

          <h1 class="hero-title">
            Search once.<br>
            <span class="gradient-text">Never overpay again.</span>
          </h1>

          <p class="hero-subtitle">
            Compare prices across Amazon, Flipkart, Meesho, Myntra, Tata CLiQ, and India's top authorized retailers.
          </p>

          <!-- Large Minimal Search Box -->
          <form id="homeSearchForm" class="home-search-bar" role="search">
            <div class="search-input-container">
              <span class="search-glass-icon" aria-hidden="true">⌕</span>
              <input
                id="homeSearchInput"
                type="search"
                class="home-search-input"
                placeholder="Search iPhone 16, headphones, smart TV, sneakers..."
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

          <!-- Popular Searches Bar -->
          <div class="home-trending-strip">
            <span class="trending-title">Popular:</span>
            <div class="trending-pills">
              <button type="button" class="trend-pill" data-query="iPhone 16">iPhone 16</button>
              <button type="button" class="trend-pill" data-query="iPhone 16 case">iPhone 16 Case</button>
              <button type="button" class="trend-pill" data-query="Sony WH-1000XM5">Sony Headphones</button>
              <button type="button" class="trend-pill" data-query="Samsung Galaxy S25">Samsung S25</button>
              <button type="button" class="trend-pill" data-query="MacBook Air M3">MacBook Air M3</button>
              <button type="button" class="trend-pill" data-query="Smart TV 55 Inch">55" Smart TV</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Unified Dual-Panel Dashboard (Covers all details in one screen!) -->
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

        <!-- Right: Popular Categories & Top 20 Stores Launcher -->
        <section class="home-launcher-panel" aria-label="Categories and Stores">
          <!-- Categories Block -->
          <div class="launcher-block">
            <div class="launcher-header">
              <h3>Popular Categories</h3>
              <span class="launcher-note">Browse lowest prices</span>
            </div>
            <div class="categories-grid-compact">
              <a href="#/search/smartphone%205G" class="category-card-compact"><span class="cat-icon">📱</span><span>Mobiles</span></a>
              <a href="#/search/laptop" class="category-card-compact"><span class="cat-icon">💻</span><span>Laptops</span></a>
              <a href="#/search/wireless%20headphones" class="category-card-compact"><span class="cat-icon">🎧</span><span>Audio</span></a>
              <a href="#/search/smartwatch" class="category-card-compact"><span class="cat-icon">⌚</span><span>Watches</span></a>
              <a href="#/search/smart%20tv" class="category-card-compact"><span class="cat-icon">📺</span><span>Appliances</span></a>
              <a href="#/search/running%20shoes" class="category-card-compact"><span class="cat-icon">👟</span><span>Fashion</span></a>
              <a href="#/search/camera" class="category-card-compact"><span class="cat-icon">📷</span><span>Cameras</span></a>
              <a href="#/search/groceries" class="category-card-compact"><span class="cat-icon">🛒</span><span>Groceries</span></a>
            </div>
          </div>

          <!-- Top Stores Block -->
          <div class="launcher-block">
            <div class="launcher-header">
              <h3>Top Stores We Compare</h3>
              <span class="launcher-note">20 Authorized Retailers</span>
            </div>
            <div class="stores-grid-compact">
              <a href="#/search/Amazon" class="store-chip-compact"><span class="store-dot" style="background-color: #FF9900;"></span>Amazon India</a>
              <a href="#/search/Flipkart" class="store-chip-compact"><span class="store-dot" style="background-color: #2874F0;"></span>Flipkart</a>
              <a href="#/search/Meesho" class="store-chip-compact"><span class="store-dot" style="background-color: #E91E63;"></span>Meesho</a>
              <a href="#/search/Shopsy" class="store-chip-compact"><span class="store-dot" style="background-color: #7C3AED;"></span>Shopsy</a>
              <a href="#/search/Myntra" class="store-chip-compact"><span class="store-dot" style="background-color: #FF3F6C;"></span>Myntra</a>
              <a href="#/search/AJIO" class="store-chip-compact"><span class="store-dot" style="background-color: #2C4152;"></span>AJIO</a>
              <a href="#/search/Nykaa" class="store-chip-compact"><span class="store-dot" style="background-color: #FC2779;"></span>Nykaa</a>
              <a href="#/search/Tata%20CLiQ" class="store-chip-compact"><span class="store-dot" style="background-color: #0F172A;"></span>Tata CLiQ</a>
              <a href="#/search/JioMart" class="store-chip-compact"><span class="store-dot" style="background-color: #0078AD;"></span>JioMart</a>
              <a href="#/search/BigBasket" class="store-chip-compact"><span class="store-dot" style="background-color: #84C225;"></span>BigBasket</a>
              <a href="#/search/FirstCry" class="store-chip-compact"><span class="store-dot" style="background-color: #FF6F61;"></span>FirstCry</a>
              <a href="#/search/Blinkit" class="store-chip-compact"><span class="store-dot" style="background-color: #F8CB46;"></span>Blinkit</a>
              <a href="#/search/Zepto" class="store-chip-compact"><span class="store-dot" style="background-color: #8B5CF6;"></span>Zepto</a>
              <a href="#/search/Instamart" class="store-chip-compact"><span class="store-dot" style="background-color: #FC8019;"></span>Swiggy Instamart</a>
              <a href="#/search/Tata%20Neu" class="store-chip-compact"><span class="store-dot" style="background-color: #5C2D91;"></span>Tata Neu</a>
              <a href="#/search/Lenskart" class="store-chip-compact"><span class="store-dot" style="background-color: #000042;"></span>Lenskart</a>
              <a href="#/search/Pepperfry" class="store-chip-compact"><span class="store-dot" style="background-color: #F16521;"></span>Pepperfry</a>
              <a href="#/search/Snapdeal" class="store-chip-compact"><span class="store-dot" style="background-color: #E40046;"></span>Snapdeal</a>
              <a href="#/search/IndiaMART" class="store-chip-compact"><span class="store-dot" style="background-color: #00A699;"></span>IndiaMART</a>
              <a href="#/search/ShopClues" class="store-chip-compact"><span class="store-dot" style="background-color: #24A3B5;"></span>ShopClues</a>
            </div>
          </div>
        </section>
      </div>

      <!-- Trust Badges Bar (Snug bottom pill bar) -->
      <section class="home-trust-bar">
        <div class="trust-bar-item">
          <span class="trust-bar-icon">🎯</span>
          <span>Direct official retailer links only</span>
        </div>
        <div class="trust-bar-item">
          <span class="trust-bar-icon">🛡️</span>
          <span>Zero accessories or fake spam</span>
        </div>
        <div class="trust-bar-item">
          <span class="trust-bar-icon">🔔</span>
          <span>24/7 price drop tracking &amp; alerts</span>
        </div>
      </section>
    </div>
  `;

  // Search form submission handler
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

  // Trending pills click handlers
  container.querySelectorAll('.trend-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-query');
      if (q) {
        window.location.hash = `#/search/${encodeURIComponent(q)}`;
      }
    });
  });

  // Fetch real cached featured products from /api/featured
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

    // Prev / Next buttons
    container.querySelector('#shufflePrevBtn')?.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + currentProducts.length) % currentProducts.length;
      renderShuffleCards(viewport);
    });

    container.querySelector('#shuffleNextBtn')?.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % currentProducts.length;
      renderShuffleCards(viewport);
    });

    // Pause on hover or touch
    viewport.addEventListener('mouseenter', () => { isPaused = true; });
    viewport.addEventListener('mouseleave', () => { isPaused = false; });
    viewport.addEventListener('touchstart', () => { isPaused = true; }, { passive: true });
    viewport.addEventListener('touchend', () => { isPaused = false; }, { passive: true });

  } catch (err) {
    const viewport = container.querySelector('#homeShuffleViewport');
    if (viewport) {
      viewport.innerHTML = `
        <div class="shuffle-empty-state">
          <p>Search for any product above to compare real-time prices across 20 platforms.</p>
        </div>
      `;
    }
  }
}

function renderShuffleCards(viewport) {
  if (!viewport || currentProducts.length === 0) return;

  // Window of visible cards (1 on mobile, 2 in the dual-hub desktop panel)
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
            <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" class="shuffle-img" loading="eager" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22 viewBox=%220 0 200 200%22><rect fill=%22%23f3f4f6%22 width=%22200%22 height=%22200%22/><text fill=%22%239ca3af%22 font-family=%22sans-serif%22 font-size=%2214%22 dy=%2210.5%22 font-weight=%22bold%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22>Product</text></svg>';" />
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
  }, 4000); // Rotates every 4 seconds
}
