/**
 * public/js/auth.js — Authentication State & Header Synchronization
 *
 * Provides a single source of truth for user authentication by querying /api/me.
 * If the session is invalid or expired, logs out cleanly and clears the name from the header.
 */

import { fetchMe, loginUser, registerUser } from './api.js';

const TOKEN_KEY = 'haggle_token';

let cachedUser = null;
let isCheckingAuth = false;

export const AuthState = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  },

  getCurrentUser() {
    return cachedUser;
  },

  isLoggedIn() {
    return !!this.getToken() && !!cachedUser;
  },

  logout() {
    this.setToken(null);
    cachedUser = null;
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user: null } }));
    updateHeaderAuthUI();
  },

  /**
   * Validates session against /api/me.
   * If token is invalid or expired, logs out cleanly and clears header name.
   */
  async syncCurrentUser() {
    const token = this.getToken();
    if (!token) {
      cachedUser = null;
      updateHeaderAuthUI();
      return null;
    }

    if (isCheckingAuth) return cachedUser;
    isCheckingAuth = true;

    try {
      const data = await fetchMe(token);
      if (data && data.user) {
        cachedUser = data.user;
        updateHeaderAuthUI();
        window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user: cachedUser } }));
        return cachedUser;
      } else {
        throw new Error('Invalid session');
      }
    } catch {
      // Clean logout on expired or invalid token
      this.setToken(null);
      cachedUser = null;
      updateHeaderAuthUI();
      window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user: null } }));
      return null;
    } finally {
      isCheckingAuth = false;
    }
  }
};

/**
 * Updates the topbar profile/login button based on synced AuthState
 */
export function updateHeaderAuthUI() {
  const container = document.getElementById('headerAuthContainer');
  if (!container) return;

  const user = AuthState.getCurrentUser();

  if (user) {
    const displayName = (user.name || 'User').split(' ')[0];
    const initial = (displayName[0] || 'U').toUpperCase();

    container.innerHTML = `
      <a href="#/profile" class="header-profile-link" title="Open Your Profile & Wishlist (${user.email || ''})">
        <span class="user-avatar-circle" aria-hidden="true">${initial}</span>
        <span class="user-display-name">${displayName}</span>
      </a>
    `;
  } else {
    container.innerHTML = `
      <a href="#/profile" class="header-login-btn" title="Sign In or Register">
        <span class="login-icon" aria-hidden="true">👤</span>
        <span>Sign In</span>
      </a>
    `;
  }
}