/**
 * public/js/pages/profile.js — Customer Profile & Wishlist Page (#/profile)
 *
 * Implements:
 * 1. Single source of truth: Always queries /api/me.
 * 2. If logged out: Displays a clean Sign In / Register form with specific error messages:
 *    "Email not registered", "Wrong password", "Network problem, try again".
 * 3. If logged in: Shows user details (name, email), editable name, logout button,
 *    and saved wishlist with direct Buy buttons and remove option.
 */

import { AuthState } from '../auth.js';
import { loginUser, registerUser, updateProfile } from '../api.js';
import { Wishlist } from '../wishlist.js';
import { PriceAlerts } from '../alerts.js';
import { escapeHtml, formatPrice } from '../product-card.js';
import { proxyImg, IMG_FALLBACK, IMG_PERF_ATTRS } from '../img.js';

export async function renderProfilePage(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="profile-page-loading">
      <div class="spinner"></div>
      <p>Loading your account details...</p>
    </div>
  `;

  // Always check current session with /api/me
  const user = await AuthState.syncCurrentUser();

  if (!user) {
    renderAuthForm(container);
  } else {
    await renderLoggedInProfile(container, user);
  }
}

/**
 * Renders the Login / Registration prompt when logged out
 */
function renderAuthForm(container) {
  let isSignUp = false;

  container.innerHTML = `
    <div class="auth-card-wrapper">
      <div class="auth-card">
        <div class="auth-tabs">
          <button type="button" id="tabSignIn" class="auth-tab active">Sign In</button>
          <button type="button" id="tabSignUp" class="auth-tab">Create Account</button>
        </div>

        <div class="auth-card-body">
          <div class="auth-header-copy">
            <h2 id="authHeading">Welcome Back to Haggle</h2>
            <p id="authSubtitle">Sign in to access your profile, saved wishlist, and price tracking alerts.</p>
          </div>

          <!-- Alert box for specific error messages -->
          <div id="authAlertBox" class="auth-alert" style="display: none;" role="alert"></div>

          <form id="authMainForm" class="auth-form" novalidate>
            <div id="authNameGroup" class="form-group" style="display: none;">
              <label for="authName">Full Name</label>
              <input
                type="text"
                id="authName"
                placeholder="e.g. Rahul Sharma"
                autocomplete="name"
              />
            </div>

            <div class="form-group">
              <label for="authEmail">Email Address</label>
              <input
                type="email"
                id="authEmail"
                placeholder="name@example.com"
                autocomplete="email"
                required
              />
              <span class="field-hint">We handle mobile autofill and spaces automatically.</span>
            </div>

            <div class="form-group">
              <label for="authPassword">Password</label>
              <div class="password-input-wrap">
                <input
                  type="password"
                  id="authPassword"
                  placeholder="Enter your password"
                  autocomplete="current-password"
                  required
                />
                <button type="button" id="togglePasswordVisibility" class="password-toggle-btn" aria-label="Show or hide password" title="Show / hide password">👁</button>
              </div>
              <span id="signupPasswordHint" class="field-hint" style="display:none;">Use at least 6 characters.</span>
              <div id="forgotPasswordRow" style="text-align:right; margin-top:4px;">
                <a href="/forgot-password.html" style="font-size:0.8rem; color:#059669; text-decoration:none; font-weight:600;">Forgot password?</a>
              </div>
            </div>

            <button type="submit" id="authSubmitBtn" class="auth-submit-btn">
              <span>Sign In</span>
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  const tabSignIn = container.querySelector('#tabSignIn');
  const tabSignUp = container.querySelector('#tabSignUp');
  const nameGroup = container.querySelector('#authNameGroup');
  const heading = container.querySelector('#authHeading');
  const subtitle = container.querySelector('#authSubtitle');
  const submitBtn = container.querySelector('#authSubmitBtn');
  const alertBox = container.querySelector('#authAlertBox');
  const form = container.querySelector('#authMainForm');

  const setMode = (signUp) => {
    isSignUp = signUp;
    if (alertBox) alertBox.style.display = 'none';

    const forgotRow = container.querySelector('#forgotPasswordRow');

    if (isSignUp) {
      tabSignUp?.classList.add('active');
      tabSignIn?.classList.remove('active');
      if (nameGroup) nameGroup.style.display = 'block';
      if (heading) heading.textContent = 'Create a Haggle Account';
      if (subtitle) subtitle.textContent = 'Sign up to sync your wishlist across devices and track lowest prices.';
      if (submitBtn) submitBtn.querySelector('span').textContent = 'Create Account';
      if (forgotRow) forgotRow.style.display = 'none';
      const pwdInput = container.querySelector('#authPassword');
      if (pwdInput) pwdInput.setAttribute('autocomplete', 'new-password');
      const hint = container.querySelector('#signupPasswordHint');
      if (hint) hint.style.display = 'block';
    } else {
      tabSignIn?.classList.add('active');
      tabSignUp?.classList.remove('active');
      if (nameGroup) nameGroup.style.display = 'none';
      if (heading) heading.textContent = 'Welcome Back to Haggle';
      if (subtitle) subtitle.textContent = 'Sign in to access your profile, saved wishlist, and price tracking alerts.';
      if (submitBtn) submitBtn.querySelector('span').textContent = 'Sign In';
      if (forgotRow) forgotRow.style.display = 'block';
      const pwdInput = container.querySelector('#authPassword');
      if (pwdInput) pwdInput.setAttribute('autocomplete', 'current-password');
      const hint = container.querySelector('#signupPasswordHint');
      if (hint) hint.style.display = 'none';
    }
  };

  tabSignIn?.addEventListener('click', () => setMode(false));
  tabSignUp?.addEventListener('click', () => setMode(true));

  // Password visibility toggle
  container.querySelector('#togglePasswordVisibility')?.addEventListener('click', (e) => {
    e.preventDefault();
    const pwdInput = container.querySelector('#authPassword');
    if (!pwdInput) return;
    const show = pwdInput.type === 'password';
    pwdInput.type = show ? 'text' : 'password';
    const btn = container.querySelector('#togglePasswordVisibility');
    if (btn) {
      btn.textContent = show ? '🙈' : '👁';
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (alertBox) alertBox.style.display = 'none';

    const email = container.querySelector('#authEmail')?.value;
    const password = container.querySelector('#authPassword')?.value;
    const name = container.querySelector('#authName')?.value;

    if (!email || !password) {
      showAlert(alertBox, 'Please enter your email and password.');
      return;
    }

    if (submitBtn) submitBtn.disabled = true;

    try {
      let res;
      if (isSignUp) {
        res = await registerUser(name, email, password);
      } else {
        res = await loginUser(email, password);
      }

      if (res && res.token) {
        AuthState.setToken(res.token);
        // Sync user state and render logged in profile
        await AuthState.syncCurrentUser();
        renderProfilePage(container);
      } else {
        throw new Error('Authentication response missing token');
      }
    } catch (err) {
      console.warn('Auth error:', err.message);
      showAlert(alertBox, err.message || 'Network problem, try again');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function showAlert(box, msg) {
  if (!box) return;
  box.textContent = msg;
  box.style.display = 'block';
}

/**
 * Renders the full Profile Page for authenticated users
 */
async function renderLoggedInProfile(container, user) {
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Member';

  const initial = ((user.name || user.email || 'U')[0] || 'U').toUpperCase();

  // Load user wishlist and active alerts
  const wishlist = await Wishlist.getItems();
  const alerts = await PriceAlerts.getAlerts();

  const wishlistHtml = wishlist.length > 0
    ? wishlist.map(item => {
        const prodId = item.id || item.productId;
        const detailUrl = `#/product/${encodeURIComponent(prodId)}?title=${encodeURIComponent(item.name || '')}&price=${encodeURIComponent(item.price || '')}&store=${encodeURIComponent(item.store || '')}&image=${encodeURIComponent(item.image || '')}`;

        const currentP = Number(item.price);
        const addedP = Number(item.addedPrice ?? item.price);
        let priceDiffHtml = '';

        if (Number.isFinite(currentP) && Number.isFinite(addedP) && addedP > 0) {
          if (currentP < addedP) {
            const drop = addedP - currentP;
            priceDiffHtml = `
              <div class="wishlist-diff-row">
                <span class="price-drop-badge">🎉 Dropped ${formatPrice(drop)}</span>
                <span class="price-added-note">Added at ${formatPrice(addedP)}</span>
              </div>
            `;
          } else if (currentP > addedP) {
            priceDiffHtml = `
              <div class="wishlist-diff-row">
                <span class="price-added-note">Added at ${formatPrice(addedP)}</span>
              </div>
            `;
          } else {
            priceDiffHtml = `
              <div class="wishlist-diff-row">
                <span class="price-added-note">Unchanged since added</span>
              </div>
            `;
          }
        }

        const buyBtn = item.buyUrl
          ? `<a href="${escapeHtml(item.buyUrl)}" target="_blank" rel="noopener sponsored" class="wishlist-buy-link">
               <span>Buy at ${escapeHtml(item.store || 'Retailer')}</span>
               <span aria-hidden="true">↗</span>
             </a>`
          : `<span class="buy-na">Offer unavailable</span>`;

        return `
          <div class="wishlist-item-card" data-item-id="${escapeHtml(prodId)}">
            <a href="${detailUrl}" class="wishlist-thumb-link">
              <img src="${escapeHtml(proxyImg(item.image || ''))}" alt="${escapeHtml(item.name)}" class="wishlist-item-img" ${IMG_PERF_ATTRS} width="100" height="100" onerror="this.onerror=null; this.src='${IMG_FALLBACK}';" />
            </a>
            <div class="wishlist-item-info">
              <span class="wishlist-store-badge">${escapeHtml(item.store || 'Verified Store')}</span>
              <a href="${detailUrl}" class="wishlist-item-title-link">
                <h4 class="wishlist-item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h4>
              </a>
              <div class="wishlist-price-block">
                <span class="wishlist-current-price">${formatPrice(item.price)}</span>
                ${priceDiffHtml}
              </div>
            </div>
            <div class="wishlist-item-actions">
              ${buyBtn}
              <button type="button" class="remove-wishlist-btn" data-id="${escapeHtml(prodId)}" aria-label="Remove ${escapeHtml(item.name)} from wishlist">
                Remove
              </button>
            </div>
          </div>
        `;
      }).join('')
    : `
      <div class="wishlist-empty-box">
        <span class="empty-icon">❤️</span>
        <h3>Your wishlist is empty</h3>
        <p>Save items by clicking the heart button on any product page, and track price changes here.</p>
        <a href="#/" class="browse-link">Find Best Prices →</a>
      </div>
    `;

  const alertsHtml = alerts.length > 0
    ? alerts.map(a => {
        const prodId = a.productId || a.id;
        const targetP = Number(a.targetPrice);
        const currentP = Number(a.currentPrice);
        const isReached = currentP && targetP && currentP <= targetP;

        return `
          <div class="alert-item-card" data-alert-id="${escapeHtml(prodId)}">
            <div class="alert-item-info">
              <div class="alert-meta-top">
                <span class="alert-store-pill">${escapeHtml(a.store || 'Retailer')}</span>
                <span class="alert-status-pill ${isReached ? 'reached' : 'tracking'}">
                  ${isReached ? '🎯 Target Reached!' : '⏱️ Tracking'}
                </span>
              </div>
              <h4 class="alert-product-title" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</h4>
              <div class="alert-prices-row">
                <span class="alert-target-label">Target: <strong>${formatPrice(targetP)}</strong></span>
                ${currentP ? `<span class="alert-curr-label">Current: ${formatPrice(currentP)}</span>` : ''}
              </div>
            </div>
            <div class="alert-item-actions">
              ${a.buyUrl ? `<a href="${escapeHtml(a.buyUrl)}" target="_blank" rel="noopener sponsored" class="alert-buy-btn">Buy at Store ↗</a>` : ''}
              <button type="button" class="remove-alert-btn" data-id="${escapeHtml(prodId)}">Remove Alert</button>
            </div>
          </div>
        `;
      }).join('')
    : `
      <div class="alerts-empty-box">
        <span class="empty-icon">🔔</span>
        <h4>No active price alerts</h4>
        <p>Set a target price on any product page, and we will monitor it 24/7 across Indian stores.</p>
      </div>
    `;

  container.innerHTML = `
    <div class="profile-page-container">
      <!-- Profile Header Banner -->
      <div class="profile-header-card">
        <div class="profile-avatar-area">
          <div class="profile-avatar-large">${escapeHtml(initial)}</div>
          <div class="profile-user-copy">
            <div class="profile-name-row">
              <h1 id="userHeadingName">${escapeHtml(user.name || 'Shopper')}</h1>
              <span class="verified-pill">✓ Verified Account</span>
            </div>
            <p class="profile-email-text">${escapeHtml(user.email)}</p>
            <span class="profile-meta-text">Member since ${escapeHtml(memberSince)}</span>
          </div>
        </div>
        <div class="profile-header-actions">
          <button type="button" id="profileLogoutBtn" class="logout-btn">Sign Out</button>
        </div>
      </div>

      <!-- Main Profile Grid: Wishlist + Alerts + Settings -->
      <div class="profile-sections-grid">
        <!-- Left: Wishlist and Alerts Panels -->
        <div class="profile-main-column">
          <!-- Wishlist Panel -->
          <div class="profile-wishlist-panel">
            <div class="panel-header-row">
              <h2>❤️ Saved Wishlist</h2>
              <span class="wishlist-count-tag">${wishlist.length} item${wishlist.length === 1 ? '' : 's'}</span>
            </div>
            <div id="wishlistCardsContainer" class="wishlist-cards-list">
              ${wishlistHtml}
            </div>
          </div>

          <!-- Active Price Alerts Panel -->
          <div class="profile-alerts-panel">
            <div class="panel-header-row">
              <h2>🔔 Active Price Alerts</h2>
              <span class="wishlist-count-tag">${alerts.length} alert${alerts.length === 1 ? '' : 's'}</span>
            </div>
            <div id="alertsContainer" class="alerts-cards-list">
              ${alertsHtml}
            </div>
          </div>
        </div>

        <!-- Right: Edit Profile Settings -->
        <div class="profile-settings-panel">
          <h3>Account Settings</h3>
          <p class="settings-desc">Update your display name or account credentials.</p>

          <div id="profileUpdateAlert" class="settings-alert" style="display: none;"></div>

          <form id="editProfileForm" class="settings-form">
            <div class="form-group">
              <label for="editNameInput">Display Name</label>
              <input type="text" id="editNameInput" value="${escapeHtml(user.name || '')}" required />
            </div>

            <div class="form-group">
              <label for="displayEmailInput">Email Address</label>
              <input type="email" id="displayEmailInput" value="${escapeHtml(user.email)}" disabled class="disabled-input" />
              <span class="field-hint">Email is linked to your primary account identifier.</span>
            </div>

            <button type="submit" id="saveNameBtn" class="save-settings-btn">
              Save Changes
            </button>
          </form>

          <!-- Change Password Form -->
          <div class="password-change-block" style="margin-top:22px; padding-top:18px; border-top:1px solid var(--border);">
            <h4 style="margin:0 0 6px; font-weight:700; color:var(--text-main);">🔑 Change Password</h4>
            <p style="margin:0 0 12px; font-size:0.8rem; color:var(--text-muted);">Use at least 8 characters with a letter and a number.</p>
            <form id="changePasswordForm" class="settings-form">
              <div class="form-group">
                <label for="currentPasswordInput">Current Password</label>
                <input type="password" id="currentPasswordInput" autocomplete="current-password" required />
              </div>
              <div class="form-group">
                <label for="newPasswordInput">New Password</label>
                <input type="password" id="newPasswordInput" autocomplete="new-password" minlength="8" required />
              </div>
              <div class="form-group">
                <label for="confirmPasswordInput">Confirm New Password</label>
                <input type="password" id="confirmPasswordInput" autocomplete="new-password" minlength="8" required />
              </div>
              <button type="submit" id="changePasswordBtn" class="save-settings-btn">Update Password</button>
            </form>
          </div>

          <div class="security-card">
            <h4>🔒 Security &amp; Privacy</h4>
            <p>Your password is cryptographically hashed with bcrypt. We never share your data with advertisers.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Logout Handler
  container.querySelector('#profileLogoutBtn')?.addEventListener('click', () => {
    AuthState.logout();
    window.location.hash = '#/';
  });

  // Remove Wishlist Item Handlers
  container.querySelectorAll('.remove-wishlist-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid = btn.getAttribute('data-id');
      if (pid) {
        await Wishlist.remove(pid);
        renderLoggedInProfile(container, user);
      }
    });
  });

  // Remove Price Alert Handlers
  container.querySelectorAll('.remove-alert-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid = btn.getAttribute('data-id');
      if (pid) {
        await PriceAlerts.removeAlert(pid);
        renderLoggedInProfile(container, user);
      }
    });
  });

  // Change Password Form Handler
  const changePwdForm = container.querySelector('#changePasswordForm');
  changePwdForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!alertBox) return;

    const currentPassword = container.querySelector('#currentPasswordInput')?.value || '';
    const newPassword = container.querySelector('#newPasswordInput')?.value || '';
    const confirmPassword = container.querySelector('#confirmPasswordInput')?.value || '';

    if (newPassword.length < 8) {
      alertBox.textContent = 'New password must be at least 8 characters long.';
      alertBox.className = 'settings-alert error';
      alertBox.style.display = 'block';
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      alertBox.textContent = 'New password must contain at least one letter and one number.';
      alertBox.className = 'settings-alert error';
      alertBox.style.display = 'block';
      return;
    }
    if (newPassword !== confirmPassword) {
      alertBox.textContent = 'New passwords do not match.';
      alertBox.className = 'settings-alert error';
      alertBox.style.display = 'block';
      return;
    }

    const token = AuthState.getToken();
    if (!token) return;

    const changeBtn = container.querySelector('#changePasswordBtn');
    if (changeBtn) changeBtn.disabled = true;

    try {
      await updateProfile(token, { currentPassword, newPassword, confirmPassword });
      alertBox.textContent = '✓ Password updated successfully! A confirmation email is on its way.';
      alertBox.className = 'settings-alert success';
      alertBox.style.display = 'block';
      changePwdForm.reset();
      setTimeout(() => { alertBox.style.display = 'none'; }, 4000);
    } catch (err) {
      alertBox.textContent = err.message || 'Failed to change password.';
      alertBox.className = 'settings-alert error';
      alertBox.style.display = 'block';
    } finally {
      if (changeBtn) changeBtn.disabled = false;
    }
  });

  // Edit Name Form Handler
  const editForm = container.querySelector('#editProfileForm');
  const alertBox = container.querySelector('#profileUpdateAlert');
  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = container.querySelector('#editNameInput')?.value.trim();
    if (!newName) return;

    const token = AuthState.getToken();
    if (!token) return;

    try {
      const res = await updateProfile(token, { name: newName });
      if (res && res.user) {
        if (alertBox) {
          alertBox.textContent = '✓ Name updated successfully!';
          alertBox.className = 'settings-alert success';
          alertBox.style.display = 'block';
        }
        await AuthState.syncCurrentUser();
        const heading = container.querySelector('#userHeadingName');
        if (heading) heading.textContent = res.user.name;
        setTimeout(() => {
          if (alertBox) alertBox.style.display = 'none';
        }, 3000);
      }
    } catch (err) {
      if (alertBox) {
        alertBox.textContent = err.message || 'Failed to update name.';
        alertBox.className = 'settings-alert error';
        alertBox.style.display = 'block';
      }
    }
  });
}
