/**
 * public/js/auth.js — Manages customer login, signup, session state, and navbar UI
 */

import { syncWishlistOnLogin, updateWishlistBadge } from './wishlist.js';

const TOKEN_KEY = 'haggle_token';
const USER_KEY = 'haggle_user';

export const AuthState = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  getUser() {
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  },
  async setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    
    // 👈 Sync saved wishlist from server right when user logs in!
    await syncWishlistOnLogin();
    
    window.dispatchEvent(new Event('auth-changed'));
  },
  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    
    // 👈 Reset wishlist in localStorage and clear badge counter on logout
    localStorage.setItem('haggle_wishlist', JSON.stringify([]));
    updateWishlistBadge();
    
    window.dispatchEvent(new Event('auth-changed'));
  },
  isLoggedIn() {
    return !!this.getToken();
  }
};

// Update header navigation based on login status
export function updateNavbarAuth() {
  const authMenuContainer = document.getElementById('authMenuContainer');
  if (!authMenuContainer) return;

  const user = AuthState.getUser();

  if (user) {
    authMenuContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <button id="navProfileBtn" style="background: none; border: 1.5px solid var(--border, #e5e7eb); padding: 6px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.88rem; color: var(--text-main); transition: all 0.2s;" title="View Customer Profile">
          <span style="width: 22px; height: 22px; border-radius: 50%; background: var(--primary); color: white; display: grid; place-items: center; font-size: 0.75rem;">${(user.name || 'U')[0].toUpperCase()}</span>
          ${user.name.split(' ')[0]}
        </button>
        <button id="logoutBtn" class="secondary" style="padding: 6px 12px; font-size: 0.8rem;">Logout</button>
      </div>
    `;
    document.getElementById('navProfileBtn').addEventListener('click', () => {
      window.location.hash = '#/profile';
    });
    document.getElementById('logoutBtn').addEventListener('click', () => {
      AuthState.clearSession();
      window.location.hash = '';
      window.location.reload();
    });
  } else {
    authMenuContainer.innerHTML = `
      <button id="openAuthModalBtn" class="nav-cta">Sign In / Register</button>
    `;
    document.getElementById('openAuthModalBtn').addEventListener('click', () => {
      openAuthModal();
    });
  }
}

// Simple dynamic Auth Modal generator if not already in HTML
function openAuthModal() {
  let modal = document.getElementById('authModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'authModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop" id="closeAuthBackdrop"></div>
      <div class="modal-dialog" style="max-width: 420px;">
        <div class="modal-header">
          <h3 class="modal-title" id="authModalTitle">Welcome to Haggle</h3>
          <button class="modal-close" id="closeAuthModalBtn">&times;</button>
        </div>
        <div class="modal-body">
          <div id="authErrorMsg" style="display:none; padding:10px; background:#fef2f2; color:#dc2626; border-radius:8px; font-size:0.85rem; margin-bottom:14px;"></div>
          <form id="authForm" style="display: flex; flex-direction: column; gap: 14px;">
            <div id="nameFieldGroup" class="form-group" style="display: none;">
              <label>Full Name</label>
              <input type="text" id="authName" placeholder="John Doe" />
            </div>
            <div class="form-group">
              <label>Email Address</label>
              <input type="email" id="authEmail" required placeholder="you@example.com" />
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="authPassword" required placeholder="At least 8 characters" />
            </div>
            <button type="submit" class="buy" id="authSubmitBtn" style="margin-top: 6px;">Sign In</button>
          </form>
          <div style="text-align: center; margin-top: 16px;">
            <button id="toggleAuthModeBtn" style="background:none; border:none; color:var(--primary); font-weight:700; cursor:pointer; font-size:0.85rem;">
              Don't have an account? Sign Up
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    let isSignUp = false;
    const title = document.getElementById('authModalTitle');
    const nameGroup = document.getElementById('nameFieldGroup');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleBtn = document.getElementById('toggleAuthModeBtn');
    const errorBox = document.getElementById('authErrorMsg');

    document.getElementById('closeAuthModalBtn').addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('closeAuthBackdrop').addEventListener('click', () => modal.classList.remove('active'));

    toggleBtn.addEventListener('click', () => {
      isSignUp = !isSignUp;
      title.textContent = isSignUp ? 'Create a Haggle Account' : 'Welcome to Haggle';
      nameGroup.style.display = isSignUp ? 'flex' : 'none';
      submitBtn.textContent = isSignUp ? 'Create Account' : 'Sign In';
      toggleBtn.textContent = isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up";
      errorBox.style.display = 'none';
    });

    document.getElementById('authForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.style.display = 'none';

      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
      const payload = isSignUp ? { name: document.getElementById('authName').value.trim(), email, password } : { email, password };

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Authentication failed');

        await AuthState.setSession(data.token, data.user);
        modal.classList.remove('active');
        window.location.reload();
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = 'block';
      }
    });
  }

  modal.classList.add('active');
}