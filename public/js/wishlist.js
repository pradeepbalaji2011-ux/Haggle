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
  if (!badge) return;
  const items = await WishlistManager.getItems();
  badge.textContent = items.length;
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
    // Avoided nested template literals by assigning buy button HTML cleanly
    const buyBtnHtml = item.buyUrl
      ? `<a href="${escapeHtml(item.buyUrl)}" target="_blank" rel="sponsored nofollow noopener noreferrer" class="buy" style="padding: 6px 12px; font-size: 0.8rem;">Buy ↗</a>`
      : '';

    return `
      <div class="wishlist-item-row" style="display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px; background: var(--bg-card, #fff); border: 1px solid var(--border); border-radius: 10px;">
        <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
          <img src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.name || '')}" style="width: 56px; height: 56px; object-fit: contain; border-radius: 6px; background: #f9fafb; flex-shrink: 0;" />
          <div style="min-width: 0;">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">${escapeHtml(item.store || 'Retailer')}</div>
            <h4 style="font-size: 0.9rem; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 2px 0;">${escapeHtml(item.name)}</h4>
            <div style="font-size: 0.95rem; font-weight: 700; color: var(--primary);">${escapeHtml(item.price || 'Price unavailable')}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          ${buyBtnHtml}
          <button class="remove-wishlist-item" data-id="${escapeHtml(item.id)}" style="background: #fef2f2; color: #dc2626; border: none; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; cursor: pointer; font-weight: 600;">Remove</button>
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

