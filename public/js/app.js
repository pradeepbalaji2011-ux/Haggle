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
 * Initializes Dark Mode theme toggle
 */
function initTheme() {
  const toggleBtn = document.getElementById('themeToggleBtn');
  const savedTheme = localStorage.getItem('haggle_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeIcon(currentTheme);

  toggleBtn?.addEventListener('click', () => {
    const active = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', active);
    localStorage.setItem('haggle_theme', active);
    updateThemeIcon(active);
  });
}

function updateThemeIcon(theme) {
  const iconSpan = document.getElementById('themeIcon');
  if (iconSpan) {
    iconSpan.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

// Application Startup
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();

  // Sync authentication with /api/me (single source of truth)
  await AuthState.syncCurrentUser();

  // Route current page
  router();
});

// Listen to URL hash change
window.addEventListener('hashchange', router);