/**
 * public/js/wishlist.js — Manages wishlist state, UI badges, backend sync, and Wishlist Modal
 */

import { AuthState } from './auth.js';

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));

export const WishlistManager = {
  async getItems() {
    if (AuthState.isLoggedIn()) {
      try {
        const res = await fetch('/api/wishlist', {
          headers: { 'Authorization': `Bearer ${AuthState.getToken()}` }
        });
        if (res.ok) {
          const data = await res.json();
          return data.wishlist || [];
        }
      } catch (e) {
        console.error('Failed to fetch backend wishlist', e);
      }
    }
    const local = localStorage.getItem('haggle_guest_wishlist');
    return local ? JSON.parse(local) : [];
  },

  async add(product) {
    if (AuthState.isLoggedIn()) {
      try {
        const res = await fetch('/api/wishlist/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AuthState.getToken()}`
          },
          body: JSON.stringify({ product })
        });
        if (res.ok) {
          window.dispatchEvent(new Event('wishlist-updated'));
          return true;
        }
      } catch (e) {
        console.error('Failed to add to backend wishlist', e);
      }
    } else {
      const list = await this.getItems();
      if (!list.find(p => p.id === product.id)) {
        list.push({ ...product, savedAt: new Date().toISOString() });
        localStorage.setItem('haggle_guest_wishlist', JSON.stringify(list));
        window.dispatchEvent(new Event('wishlist-updated'));
        return true;
      }
    }
    return false;
  },

  async remove(productId) {
    if (AuthState.isLoggedIn()) {
      try {
        const res = await fetch(`/api/wishlist/remove/${productId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${AuthState.getToken()}` }
        });
        if (res.ok) {
          window.dispatchEvent(new Event('wishlist-updated'));
          return true;
        }
      } catch (e) {
        console.error('Failed to remove from backend wishlist', e);
      }
    } else {
      let list = await this.getItems();
      list = list.filter(p => p.id !== productId);
      localStorage.setItem('haggle_guest_wishlist', JSON.stringify(list));
      window.dispatchEvent(new Event('wishlist-updated'));
      return true;
    }
    return false;
  },

  async has(productId) {
    const list = await this.getItems();
    return !!list.find(p => p.id === productId);
  }
};

export async function updateWishlistBadge() {
  const badge = document.getElementById('wishlistCountBadge');
  const bnavBadge = document.getElementById('bnavWishlistBadge');
  const items = await WishlistManager.getItems();
  const count = items ? items.length : 0;
  if (badge) badge.textContent = count;
  if (bnavBadge) {
    bnavBadge.textContent = count;
    bnavBadge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

export async function openWishlistModal() {
  let modal = document.getElementById('wishlistModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'wishlistModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop" id="closeWishlistBackdrop"></div>
      <div class="modal-dialog" style="max-width: 650px;">
        <div class="modal-header">
          <h3 class="modal-title">❤️ Your Saved Wishlist</h3>
          <button class="modal-close" id="closeWishlistModalBtn">&times;</button>
        </div>
        <div class="modal-body" id="wishlistModalBody" style="max-height: 70vh; overflow-y: auto;">
          <div class="modal-loading"><p>Loading your saved items...</p></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('closeWishlistModalBtn').addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('closeWishlistBackdrop').addEventListener('click', () => modal.classList.remove('active'));
  }

  modal.classList.add('active');
  await renderWishlistModalContent();
}

export function getDirectBuyUrl(item) {
  if (item.buyUrl && typeof item.buyUrl === 'string' && item.buyUrl.startsWith('http')) {
    return item.buyUrl;
  }
  const store = (item.store || '').toLowerCase();
  const query = encodeURIComponent(item.name || 'product');
  if (store.includes('amazon')) {
    return `https://www.amazon.in/s?k=${query}`;
  } else if (store.includes('flipkart')) {
    return `https://www.flipkart.com/search?q=${query}`;
  } else if (store.includes('croma')) {
    return `https://www.croma.com/searchB?q=${query}`;
  } else if (store.includes('reliance')) {
    return `https://www.reliancedigital.in/search?q=${query}`;
  } else if (store.includes('myntra')) {
    return `https://www.myntra.com/${query}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent((item.name || '') + ' ' + (item.store || ''))}&tbm=shop`;
}

export function getProductDetailHash(item) {
  const p = new URLSearchParams({
    id: item.productId || item.id || '',
    title: item.name || '',
    price: item.price || '',
    store: item.store || '',
    image: item.image || '',
    buyUrl: item.buyUrl || ''
  });
  return `#/product?${p.toString()}`;
}

async function renderWishlistModalContent() {
  const bodyContainer = document.getElementById('wishlistModalBody');
  if (!bodyContainer) return;

  const items = await WishlistManager.getItems();

  if (!items.length) {
    bodyContainer.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
        <p style="font-size: 3rem; margin-bottom: 10px;">🛍️</p>
        <h4 style="font-size: 1.1rem; color: var(--text-main); margin-bottom: 6px;">Your wishlist is empty</h4>
        <p style="font-size: 0.9rem;">Click the heart icon on any product card while searching to save items here!</p>
      </div>
    `;
    return;
  }

  const rows = items.map(item => {
    const buyUrl = getDirectBuyUrl(item);
    const detailHash = getProductDetailHash(item);
    const storeName = item.store || 'Retailer';

    return `
      <div class="wishlist-item-row" style="display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px; background: #fff; border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
          <a href="${detailHash}" class="wishlist-item-link" title="View product details & price comparison" style="display: block; flex-shrink: 0;">
            <img src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.name || '')}" style="width: 58px; height: 58px; object-fit: contain; border-radius: 8px; background: #f8fafc; border: 1px solid #f1f5f9; padding: 2px;" />
          </a>
          <div style="min-width: 0;">
            <div style="font-size: 0.72rem; color: var(--primary); text-transform: uppercase; font-weight: 800; letter-spacing: 0.03em;">${escapeHtml(storeName)}</div>
            <a href="${detailHash}" class="wishlist-item-link" title="View product details" style="text-decoration: none; color: inherit; display: block;">
              <h4 style="font-size: 0.88rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 2px 0;">${escapeHtml(item.name)}</h4>
            </a>
            <div style="font-size: 1rem; font-weight: 800; color: #111827;">${escapeHtml(item.price || 'Price unavailable')}</div>
          </div>
        </div>
        <div class="wishlist-row-actions" style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <a href="${escapeHtml(buyUrl)}" target="_blank" rel="sponsored nofollow noopener noreferrer" class="buy wishlist-buy-btn" style="padding: 8px 14px; font-size: 0.82rem; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; gap: 4px; text-decoration: none;" title="Buy at official ${escapeHtml(storeName)} product page">
            Buy at ${escapeHtml(storeName)} <span aria-hidden="true">↗</span>
          </a>
          <button class="remove-wishlist-item" data-id="${escapeHtml(item.id)}" title="Remove item" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 7px 10px; font-size: 0.8rem; cursor: pointer; font-weight: 600;">Remove</button>
        </div>
      </div>
    `;
  }).join('');

  bodyContainer.innerHTML = `<div style="display: flex; flex-direction: column; gap: 12px;">${rows}</div>`;

  bodyContainer.querySelectorAll('.remove-wishlist-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const productId = btn.getAttribute('data-id');
      await WishlistManager.remove(productId);
      await renderWishlistModalContent();
    });
  });

  // Close modal when user clicks on product link to view in-app product page
  bodyContainer.querySelectorAll('.wishlist-item-link').forEach(link => {
    link.addEventListener('click', () => {
      const modal = document.getElementById('wishlistModal');
      if (modal) modal.classList.remove('active');
    });
  });
}

window.addEventListener('wishlist-updated', updateWishlistBadge);
window.addEventListener('auth-changed', updateWishlistBadge);

export async function syncWishlistOnLogin() {
  const token = AuthState.getToken();
  if (!token) return;

  try {
    const res = await fetch('/api/wishlist', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('haggle_wishlist', JSON.stringify(data.wishlist || []));
      updateWishlistBadge();
    }
  } catch (err) {
    console.error('Failed to sync wishlist on login:', err);
  }
}

