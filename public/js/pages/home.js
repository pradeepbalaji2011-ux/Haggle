/**
 * public/js/pages/home.js — Home Page (v4 exact demo design)
 *
 * Sections (matching the demo):
 * 1. Hero: badge, "Search anything. Compare everywhere.", search bar, chips
 * 2. Stats band: 4 REAL numbers from /api/stats
 * 3. "Shop every sector — live": 12 category cards
 * 4. "Recently compared on Haggle": real product cards from /api/featured
 * 5. "Connected platforms": platform cards from /api/platforms
 * 6. "How Haggle works": 3 steps
 */

import { fetchFeaturedProducts } from '../api.js';
import { escapeHtml, formatPrice, storeColor } from '../product-card.js';
import { proxyImg, IMG_FALLBACK, IMG_PERF_ATTRS } from '../img.js';

const SUGGESTIONS = [
  'Maggi noodles', 'iPhone 16', 'running shoes', 'air fryer',
  'PS5', 'Lego', 'saree', 'washing machine'
];

const SECTORS = [
  { icon: '🛒', title: 'Grocery & Essentials',  example: 'Maggi noodles 12 pack', query: 'Maggi noodles 12 pack' },
  { icon: '📱', title: 'Mobiles',               example: 'iPhone 16',             query: 'iPhone 16' },
  { icon: '💻', title: 'Laptops',               example: 'hp laptop i5',          query: 'hp laptop i5' },
  { icon: '📺', title: 'TV & Display',          example: '55 inch smart tv',      query: '55 inch smart tv' },
  { icon: '👗', title: 'Fashion',               example: 'nike running shoes',    query: 'nike running shoes' },
  { icon: '🍳', title: 'Home & Kitchen',        example: 'prestige air fryer',    query: 'prestige air fryer' },
  { icon: '🔊', title: 'Electronics',           example: 'bluetooth speaker',     query: 'bluetooth speaker' },
  { icon: '✨', title: 'Beauty',                example: 'minimalist sunscreen',  query: 'minimalist sunscreen' },
  { icon: '🧸', title: 'Kids & Toys',           example: 'lego classic set',      query: 'lego classic set' },
  { icon: '🎮', title: 'Gaming',                example: 'ps5 controller',        query: 'ps5 controller' },
  { icon: '🧺', title: 'Large Appliances',      example: 'washing machine',       query: 'washing machine front load' },
  { icon: '🧽', title: 'Household & Cleaning',  example: 'prestige clean',        query: 'floor cleaner' }
];

const PLATFORM_FALLBACK = [
  { id: 'amazon',   name: 'Amazon India', category: 'General Marketplace',    badgeColor: '#FF9900' },
  { id: 'flipkart', name: 'Flipkart',     category: 'General Marketplace',    badgeColor: '#2874F0' },
  { id: 'myntra',   name: 'Myntra',       category: 'Fashion & Apparel',      badgeColor: '#FF3F6C' },
  { id: 'meesho',   name: 'Meesho',       category: 'Social Commerce & Fashion', badgeColor: '#E91E63' },
  { id: 'ajio',     name: 'AJIO',         category: 'Fashion & Lifestyle',    badgeColor: '#2C4152' },
  { id: 'jiomart',  name: 'JioMart',      category: 'Groceries & Electronics', badgeColor: '#0078AD' },
  { id: 'shopsy',   name: 'Shopsy',       category: 'Budget Marketplace',     badgeColor: '#7C3AED' },
  { id: 'snapdeal', name: 'Snapdeal',     category: 'Value Marketplace',      badgeColor: '#E40046' },
  { id: 'tatacliq', name: 'Tata CLiQ',    category: 'Multi-category & Electronics', badgeColor: '#0F172A' },
  { id: 'nykaa',    name: 'Nykaa',        category: 'Beauty & Cosmetics',     badgeColor: '#FC2779' },
  { id: 'firstcry', name: 'FirstCry',     category: 'Baby, Kids & Toys',      badgeColor: '#FF6F61' },
  { id: 'indiamart', name: 'IndiaMART',   category: 'B2B Marketplace',        badgeColor: '#00A699' }
];

function platformInitial(name = '') {
  const clean = name.replace(/ india/i, '').trim();
  return (clean.slice(0, 2)).toUpperCase();
}

export async function renderHomePage(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="home-page v4-home">

      <!-- ============ HERO ============ -->
      <section class="v4-hero">
        <div class="v4-hero-badge">
          <span aria-hidden="true">🏬</span> 12 platforms · one search · zero fake data
        </div>
        <h1 class="v4-hero-title">
          Search anything.<br>
          <span class="v4-gradient-text">Compare everywhere.</span>
        </h1>
        <p class="v4-hero-sub">
          From Maggi and detergent to iPhones and PS5 — Haggle fetches live listings
          from Amazon, Flipkart, Myntra, Meesho, JioMart and 7 more Indian platforms.
          Real products, real prices, direct links. No dummy results, no made-up reviews.
        </p>

        <form id="homeSearchForm" class="v4-hero-search" role="search">
          <span class="v4-search-glass" aria-hidden="true">⌕</span>
          <input
            id="homeSearchInput"
            type="search"
            placeholder='Search anything — "maggi", "headphones", "pressure cooker"...'
            autocomplete="off"
            required
            aria-label="Search anything"
          />
          <button type="submit" class="v4-compare-btn">Compare</button>
        </form>

        <div class="v4-hero-chips">
          ${SUGGESTIONS.map(s => `<button type="button" class="v4-chip" data-query="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
        </div>
      </section>

      <!-- ============ STATS BAND (real numbers) ============ -->
      <section class="v4-stats-band" aria-label="Live platform statistics">
        <div class="v4-stat-card">
          <span class="v4-stat-icon" aria-hidden="true">🏬</span>
          <div class="v4-stat-body">
            <span class="v4-stat-number" id="statPlatforms">12</span>
            <span class="v4-stat-label">Connected platforms</span>
          </div>
        </div>
        <div class="v4-stat-card">
          <span class="v4-stat-icon" aria-hidden="true">⚡</span>
          <div class="v4-stat-body">
            <span class="v4-stat-number" id="statListings"><span class="mini-spinner"></span></span>
            <span class="v4-stat-label">Real listings tracked</span>
          </div>
        </div>
        <div class="v4-stat-card">
          <span class="v4-stat-icon" aria-hidden="true">📈</span>
          <div class="v4-stat-body">
            <span class="v4-stat-number" id="statOffers"><span class="mini-spinner"></span></span>
            <span class="v4-stat-label">Live store offers</span>
          </div>
        </div>
        <div class="v4-stat-card">
          <span class="v4-stat-icon" aria-hidden="true">🕓</span>
          <div class="v4-stat-body">
            <span class="v4-stat-number" id="statPoints"><span class="mini-spinner"></span></span>
            <span class="v4-stat-label">Recorded price points</span>
          </div>
        </div>
      </section>

      <!-- ============ SHOP EVERY SECTOR ============ -->
      <section class="v4-section">
        <h2 class="v4-section-title">Shop every sector — live</h2>
        <p class="v4-section-sub">Tap a category to run a real search across all 12 platforms right now</p>
        <div class="v4-sector-grid">
          ${SECTORS.map(s => `
            <a href="#/search/${encodeURIComponent(s.query)}" class="v4-sector-card">
              <span class="v4-sector-icon" aria-hidden="true">${s.icon}</span>
              <span class="v4-sector-name">${escapeHtml(s.title)}</span>
              <span class="v4-sector-example">e.g. "${escapeHtml(s.example)}"</span>
            </a>
          `).join('')}
        </div>
      </section>

      <!-- ============ RECENTLY COMPARED ============ -->
      <section class="v4-section" id="recently-compared">
        <h2 class="v4-section-title"><span class="v4-bolt" aria-hidden="true">⚡</span> Recently compared on Haggle</h2>
        <p class="v4-section-sub">Products verified by the latest live searches — every card links to real store offers</p>
        <div class="v4-recent-row" id="v4RecentRow">
          <div class="skeleton-card"></div>
          <div class="skeleton-card"></div>
          <div class="skeleton-card"></div>
          <div class="skeleton-card"></div>
        </div>
      </section>

      <!-- ============ CONNECTED PLATFORMS ============ -->
      <section class="v4-section">
        <h2 class="v4-section-title">Connected platforms</h2>
        <p class="v4-section-sub">Every search scans public listings on all 12 platforms — pick one to browse its catalogue</p>
        <div class="v4-platform-grid" id="v4PlatformGrid">
          ${PLATFORM_FALLBACK.map(p => `
            <a href="#/search/${encodeURIComponent(p.name)}" class="v4-platform-card">
              <span class="v4-platform-badge" style="background:${p.badgeColor}">${escapeHtml(platformInitial(p.name))}</span>
              <span class="v4-platform-info">
                <span class="v4-platform-name">${escapeHtml(p.name)}</span>
                <span class="v4-platform-cat">${escapeHtml(p.category)}</span>
              </span>
            </a>
          `).join('')}
        </div>
      </section>

      <!-- ============ HOW HAGGLE WORKS ============ -->
      <section class="v4-section v4-how">
        <h2 class="v4-section-title centered">How Haggle works</h2>
        <div class="v4-how-grid">
          <div class="v4-how-card">
            <span class="v4-step-pill">STEP 1</span>
            <span class="v4-how-icon" aria-hidden="true">🔍</span>
            <h3>Search anything</h3>
            <p>Type any product — groceries, electronics, clothes, kitchenware, toys, gaming. Haggle searches live public listings across all 12 platforms.</p>
          </div>
          <div class="v4-how-card">
            <span class="v4-step-pill">STEP 2</span>
            <span class="v4-how-icon" aria-hidden="true">📈</span>
            <h3>See only real values</h3>
            <p>Every price comes from a real listing at search time, every offer links straight to the store. No invented products, no fake reviews — ever.</p>
          </div>
          <div class="v4-how-card">
            <span class="v4-step-pill">STEP 3</span>
            <span class="v4-how-icon" aria-hidden="true">🔔</span>
            <h3>Track &amp; alert</h3>
            <p>Each search records a real price point, building genuine history over time. Set a target and get alerted when any platform drops below it.</p>
          </div>
        </div>
      </section>
    </div>
  `;

  // ---- Search wiring ----
  const form = container.querySelector('#homeSearchForm');
  const input = container.querySelector('#homeSearchInput');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input?.value.trim();
    if (q) window.location.hash = `#/search/${encodeURIComponent(q)}`;
  });
  container.querySelectorAll('.v4-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-query');
      if (q) window.location.hash = `#/search/${encodeURIComponent(q)}`;
    });
  });

  // ---- Real stats ----
  loadStats();

  // ---- Real recently-compared products ----
  loadRecentProducts();

  // ---- Real platform list (keeps in sync with backend truth) ----
  loadPlatforms();
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats', { headers: { 'Accept': 'application/json' } });
    const s = await res.json();
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && Number.isFinite(Number(val))) el.textContent = String(val);
    };
    set('statPlatforms', s.platforms);
    set('statListings', s.realListings);
    set('statOffers', s.storeOffers);
    set('statPoints', s.recordedPoints);
  } catch {
    ['statListings', 'statOffers', 'statPoints'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
  }
}

async function loadRecentProducts() {
  const row = document.getElementById('v4RecentRow');
  if (!row) return;
  try {
    const data = await fetchFeaturedProducts();
    const products = Array.isArray(data.products) ? data.products.slice(0, 8) : [];
    if (products.length === 0) {
      row.innerHTML = `<div class="v4-recent-empty">Live products will appear here after the next scheduled search run.</div>`;
      return;
    }
    row.innerHTML = products.map(p => {
      const prodId = p.productId || p.id || encodeURIComponent(p.name);
      const detailUrl = `#/product/${encodeURIComponent(prodId)}?title=${encodeURIComponent(p.name || '')}&image=${encodeURIComponent(p.image || '')}&price=${encodeURIComponent(p.price || '')}&store=${encodeURIComponent(p.store || '')}&brand=${encodeURIComponent(p.brand || '')}&rating=${encodeURIComponent(p.rating || '')}`;
      const hasPrice = p.lowestPrice != null || p.price != null;
      const priceHtml = hasPrice
        ? `<span class="v4-price">${formatPrice(p.lowestPrice ?? p.price)}</span>${p.highestPrice > (p.lowestPrice ?? p.price) ? `<span class="v4-price-was">${formatPrice(p.highestPrice)}</span>` : ''}`
        : `<span class="v4-price v4-price-see">See price</span>`;
      const storeDot = p.storeColor || storeColor(p.store || '');
      return `
        <a href="${detailUrl}" class="v4-deal-card">
          <span class="v4-deal-imgwrap">
            <img src="${escapeHtml(proxyImg(p.image))}" alt="${escapeHtml(p.name)}" loading="lazy" ${IMG_PERF_ATTRS} width="300" height="300" onerror="this.onerror=null; this.src='${IMG_FALLBACK}';" />
          </span>
          <span class="v4-deal-brand">${escapeHtml((p.brand || 'HAGGLE').toUpperCase())}</span>
          <span class="v4-deal-title" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
          <span class="v4-deal-price-row">${priceHtml}</span>
          <span class="v4-deal-store"><i class="v4-store-dot" style="background:${storeDot}"></i>on ${escapeHtml(p.store || 'Verified store')}</span>
        </a>
      `;
    }).join('');
  } catch {
    row.innerHTML = `<div class="v4-recent-empty">Search for any product above to see live comparisons.</div>`;
  }
}

async function loadPlatforms() {
  const grid = document.getElementById('v4PlatformGrid');
  if (!grid) return;
  try {
    const res = await fetch('/api/platforms', { headers: { 'Accept': 'application/json' } });
    const data = await res.json();
    if (!Array.isArray(data.platforms) || data.platforms.length === 0) return;
    grid.innerHTML = data.platforms.map(p => `
      <a href="#/search/${encodeURIComponent(p.name)}" class="v4-platform-card">
        <span class="v4-platform-badge" style="background:${p.badgeColor || '#22D3EE'}">${escapeHtml(platformInitial(p.name))}</span>
        <span class="v4-platform-info">
          <span class="v4-platform-name">${escapeHtml(p.name)}</span>
          <span class="v4-platform-cat">${escapeHtml(p.category || 'Marketplace')}</span>
        </span>
      </a>
    `).join('');
  } catch {
    /* fallback markup already rendered */
  }
}
