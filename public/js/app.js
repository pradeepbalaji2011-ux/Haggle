/**
 * public/js/app.js — Core Client Application & Hash Router
 *
 * Implements:
 * 1. Hash Routing:
 *    - #/ (or empty): Minimal Home Page with live rotating product cards
 *    - #/search/<query>: Search Results Page
 *    - #/product/<id>: Dedicated Product Comparison & Price History Page
 *    - #/profile: User Profile & Wishlist Page
 * 2. Header State Synchronization (/api/me as single source of truth).
 * 3. Clean Dark Mode theme toggle with local storage persistence.
 */

import { AuthState } from './auth.js';
import { renderHomePage } from './pages/home.js';
import { renderSearchPage } from './pages/search.js';
import { renderProductPage } from './pages/product.js';
import { renderProfilePage } from './pages/profile.js';

const appRoot = document.getElementById('app-root');

/**
 * Hash router matching URL hashes to page renderers
 */
export async function router() {
  if (!appRoot) return;

  const rawHash = window.location.hash || '#/';
  const cleanHash = rawHash.replace(/^#\/?/, ''); // strip leading # and /

  // Scroll to top on navigation
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Route 1: Search Results — #/search/<query>
  if (cleanHash.startsWith('search/')) {
    const query = cleanHash.slice('search/'.length);
    await renderSearchPage(appRoot, query);
    return;
  }

  // Route 2: Product Page — #/product/<id> or #/product?<params>
  if (cleanHash.startsWith('product')) {
    let productId = '';
    const queryParams = Object.create(null);
    const safeAssignParam = (key, val) => {
      if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
        queryParams[key] = val;
      }
    };

    if (cleanHash.startsWith('product/')) {
      const remaining = cleanHash.slice('product/'.length);
      const qIndex = remaining.indexOf('?');
      if (qIndex !== -1) {
        productId = decodeURIComponent(remaining.slice(0, qIndex));
        new URLSearchParams(remaining.slice(qIndex + 1)).forEach((val, key) => {
          safeAssignParam(key, val);
        });
      } else {
        productId = decodeURIComponent(remaining);
      }
    } else if (cleanHash.includes('?')) {
      const qIndex = cleanHash.indexOf('?');
      new URLSearchParams(cleanHash.slice(qIndex + 1)).forEach((val, key) => {
        safeAssignParam(key, val);
      });
      productId = queryParams.id || queryParams.productId || '';
    }

    await renderProductPage(appRoot, productId, queryParams);
    return;
  }

  // Route 3: Profile & Login Page — #/profile or #/login
  if (cleanHash === 'profile' || cleanHash.startsWith('profile') || cleanHash === 'login' || cleanHash.startsWith('login')) {
    await renderProfilePage(appRoot);
    return;
  }

  // Route 4: Contact & Support Page — #/contact
  if (cleanHash === 'contact' || cleanHash.startsWith('contact')) {
    const { renderContactPage } = await import('./pages/contact.js');
    renderContactPage(appRoot);
    return;
  }

  // Default Route: Home Page — #/ or empty
  await renderHomePage(appRoot);
}

/**
 * Reads saved theme preference with safe fallback to dark
 * Key: "haggle-theme"
 */
function getSavedTheme() {
  try {
    const saved = localStorage.getItem('haggle-theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch (e) {
    // Storage blocked in private mode / restricted environments
  }
  return 'dark';
}

/**
 * Saves theme preference safely
 */
function saveTheme(theme) {
  try {
    localStorage.setItem('haggle-theme', theme);
  } catch (e) {
    // Storage blocked in private mode / restricted environments
  }
}

/**
 * Applies theme to DOM and updates toggle icon
 */
function applyTheme(theme) {
  const safeTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = safeTheme;
  document.documentElement.setAttribute('data-theme', safeTheme);
  updateThemeIcon(safeTheme);
}

/**
 * Initializes Dark Mode theme toggle
 */
function initTheme() {
  const toggleBtn = document.getElementById('themeToggleBtn');
  const currentTheme = getSavedTheme();
  applyTheme(currentTheme);

  toggleBtn?.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme || document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    saveTheme(next);
  });
}

function updateThemeIcon(theme) {
  const iconSpan = document.getElementById('themeIcon');
  if (iconSpan) {
    iconSpan.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    toggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
}

// Application Startup
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();

  // Hamburger menu toggle
  const menuToggle = document.getElementById('menuToggle');
  const mobileNav = document.getElementById('mobileNav');
  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
      menuToggle.textContent = mobileNav.classList.contains('open') ? '✕' : '☰';
    });
    // Close nav on link click
    mobileNav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        menuToggle.textContent = '☰';
      });
    });
  }

  // Sync authentication with /api/me (single source of truth)
  await AuthState.syncCurrentUser();

  // Route current page
  router();
});

// Listen to URL hash change
window.addEventListener('hashchange', router);