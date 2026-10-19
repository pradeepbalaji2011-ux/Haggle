/**
 * public/js/wishlist.js — Client Wishlist Manager
 *
 * Saves items to server database when logged in, or localStorage for guest shoppers.
 * Synchronizes seamlessly when user signs in.
 */

import { AuthState } from './auth.js';
import { fetchWishlist, addToWishlist, removeFromWishlist } from './api.js';

const GUEST_WISHLIST_KEY = 'haggle_guest_wishlist';

export const Wishlist = {
  async getItems() {
    const token = AuthState.getToken();
    if (token) {
      try {
        const data = await fetchWishlist(token);
        return data.wishlist || [];
      } catch {
        // Fallback to guest items if offline
      }
    }

    try {
      const local = localStorage.getItem(GUEST_WISHLIST_KEY);
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  },

  async add(product) {
    if (!product) return false;
    const token = AuthState.getToken();

    if (token) {
      try {
        await addToWishlist(token, product);
        window.dispatchEvent(new CustomEvent('wishlist-changed'));
        return true;
      } catch (err) {
        console.error('Failed to add to server wishlist:', err);
      }
    }

    // Guest mode
    const items = await this.getItems();
    const prodId = String(product.id || product.productId);
    if (!items.some(i => String(i.id || i.productId) === prodId)) {
      items.unshift({
        id: prodId,
        productId: prodId,
        name: product.name || product.title || 'Product',
        price: product.price != null ? product.price : '',
        store: product.store || 'Retailer',
        image: product.image || '',
        buyUrl: product.buyUrl || '',
        savedAt: new Date().toISOString()
      });
      localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('wishlist-changed'));
      return true;
    }
    return false;
  },

  async remove(productId) {
    if (!productId) return false;
    const token = AuthState.getToken();

    if (token) {
      try {
        await removeFromWishlist(token, productId);
        window.dispatchEvent(new CustomEvent('wishlist-changed'));
        return true;
      } catch (err) {
        console.error('Failed to remove from server wishlist:', err);
      }
    }

    // Guest mode
    let items = await this.getItems();
    items = items.filter(i => String(i.id || i.productId) !== String(productId));
    localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('wishlist-changed'));
    return true;
  },

  async has(productId) {
    if (!productId) return false;
    const items = await this.getItems();
    return items.some(i => String(i.id || i.productId) === String(productId));
  }
};
