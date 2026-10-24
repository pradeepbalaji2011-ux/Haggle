/**
 * public/js/profile-view.js — Customer User Profile Page Component
 *
 * Displays user account details, member since, verified badge,
 * wishlist summary with direct buy options, and profile settings.
 */

import { AuthState } from './auth.js';
import { fetchUserProfile, updateUserProfileApi } from './api.js';
import { WishlistManager, getDirectBuyUrl, getProductDetailHash } from './wishlist.js';
import { CONFIG } from './config.js';

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));

const money = value =>
  value == null || !Number.isFinite(Number(value))
    ? 'Price unavailable'
    : new Intl.NumberFormat(CONFIG.locale, {
        style: 'currency',
        currency: CONFIG.currency,
        maximumFractionDigits: 0
      }).format(Number(value));

export async function renderProfileView(container) {
  if (!container) return;

  if (!AuthState.isLoggedIn()) {
    container.innerHTML = `
      <div class="profile-page-card" style="text-align: center; padding: 60px 20px; max-width: 500px; margin: 40px auto; background: var(--surface); border: 1px solid var(--border); border-radius: 16px;">
        <span style="font-size: 3rem;">🔒</span>
        <h2 style="margin: 16px 0 8px;">Please Sign In</h2>
        <p style="color: var(--text-muted); margin-bottom: 24px;">You need to be signed in to view your customer profile and saved items.</p>
        <button id="profileSignInBtn" class="buy" style="padding: 10px 24px; font-size: 1rem;">Sign In / Register</button>
      </div>
    `;
    const btn = container.querySelector('#profileSignInBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        const authBtn = document.getElementById('openAuthModalBtn');
        if (authBtn) authBtn.click();
      });
    }
    return;
  }

  container.innerHTML = `
    <div style="text-align: center; padding: 60px 20px;">
      <div class="spinner" style="margin: 0 auto 16px;"></div>
      <p style="color: var(--text-muted);">Loading your customer profile...</p>
    </div>
  `;

  try {
    const data = await fetchUserProfile(AuthState.getToken());
    const user = data.user || {};
    const wishlist = data.wishlist || [];

    const memberDate = user.createdAt
      ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'Active Member';

    const initials = (user.name || user.email || 'U')
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    // Calculate total wishlist value
    let totalWishlistValue = 0;
    wishlist.forEach(item => {
      const p = typeof item.price === 'number' ? item.price : Number(String(item.price || '').replace(/[^\d.]/g, ''));
      if (Number.isFinite(p) && p > 0) totalWishlistValue += p;
    });

    const wishlistHtml = wishlist.length > 0
      ? wishlist.map(item => {
        const buyUrl = getDirectBuyUrl(item);
        const detailHash = getProductDetailHash(item);
        const storeName = item.store || 'Retailer';
        return `
        <div class="profile-wishlist-card" style="display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 18px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 16px; flex: 1; min-width: 0;">
            <a href="${detailHash}" title="View Product Page">
              <img src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.name || '')}" style="width: 64px; height: 64px; object-fit: contain; border-radius: 8px; background: #fff; border: 1px solid var(--border); flex-shrink: 0;" />
            </a>
            <div style="min-width: 0;">
              <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary); text-transform: uppercase;">${escapeHtml(storeName)}</span>
              <a href="${detailHash}" style="text-decoration: none; color: inherit; display: block;" title="View Product Page">
                <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--text-main); margin: 2px 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.name)}</h4>
              </a>
              <div style="font-size: 1rem; font-weight: 700; color: var(--text-main);">${escapeHtml(item.price || 'Price unavailable')}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
            <a href="${escapeHtml(buyUrl)}" target="_blank" rel="sponsored nofollow noopener noreferrer" class="buy" style="padding: 8px 16px; font-size: 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
              Buy at ${escapeHtml(storeName)} <span aria-hidden="true">↗</span>
            </a>
            <button class="profile-remove-wishlist" data-id="${escapeHtml(item.id)}" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 14px; font-size: 0.85rem; font-weight: 600; cursor: pointer;">Remove</button>
          </div>
        </div>
      `;
    }).join('')
      : `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); background: var(--surface); border: 1px dashed var(--border); border-radius: 12px;">
          <p style="font-size: 2.5rem; margin-bottom: 10px;">🛍️</p>
          <h4 style="color: var(--text-main); margin-bottom: 4px;">Your Wishlist is Empty</h4>
          <p style="font-size: 0.9rem;">Search for products and click the heart icon to track price drops here.</p>
        </div>
      `;

    container.innerHTML = `
      <div class="profile-container" style="max-width: 1000px; margin: 30px auto; padding: 0 16px;">
        <!-- Top Back Nav -->
        <div style="margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
          <button id="profileBackToShoppingBtn" class="secondary" style="display: flex; align-items: center; gap: 6px; font-weight: 600; cursor: pointer;">
            ← Back to Shopping
          </button>
          <span style="font-size: 0.85rem; color: var(--text-muted);">Customer Account # ${escapeHtml(user.id)}</span>
        </div>

        <!-- Customer Identity Header Card -->
        <div class="profile-hero-card" style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 28px; border-radius: 16px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; box-shadow: var(--shadow-md);">
          <div style="display: flex; align-items: center; gap: 20px;">
            <div style="width: 72px; height: 72px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 2px solid white; display: grid; place-items: center; font-size: 1.8rem; font-weight: 800; color: white;">
              ${escapeHtml(initials)}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h1 style="font-size: 1.6rem; font-weight: 800; margin: 0; color: white;">${escapeHtml(user.name)}</h1>
                <span style="background: rgba(255,255,255,0.25); font-size: 0.75rem; padding: 3px 8px; border-radius: 20px; font-weight: 700;">✓ Verified Shopper</span>
              </div>
              <p style="margin: 4px 0 0; opacity: 0.9; font-size: 0.95rem;">${escapeHtml(user.email)}</p>
              <span style="font-size: 0.8rem; opacity: 0.8;">Member since ${escapeHtml(memberDate)}</span>
            </div>
          </div>

          <div style="display: flex; gap: 12px; align-items: center;">
            <button id="profileLogoutBtn" style="background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.4); padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer;">
              Logout
            </button>
          </div>
        </div>

        <!-- Profile Metrics Summary -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin: 24px 0;">
          <div style="background: var(--surface); border: 1px solid var(--border); padding: 20px; border-radius: 12px;">
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Saved Products</span>
            <div style="font-size: 1.8rem; font-weight: 800; color: var(--primary); margin-top: 4px;">${wishlist.length}</div>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Active wishlist items</span>
          </div>
          <div style="background: var(--surface); border: 1px solid var(--border); padding: 20px; border-radius: 12px;">
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Estimated Wishlist Value</span>
            <div style="font-size: 1.8rem; font-weight: 800; color: var(--text-main); margin-top: 4px;">${money(totalWishlistValue)}</div>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Across verified stores</span>
          </div>
          <div style="background: var(--surface); border: 1px solid var(--border); padding: 20px; border-radius: 12px;">
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Price Tracking</span>
            <div style="font-size: 1.8rem; font-weight: 800; color: #10b981; margin-top: 4px;">Active</div>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Real-time price drop scans</span>
          </div>
        </div>

        <!-- 2 Column Layout: Saved Wishlist & Account Settings -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: start;">
          <!-- Left: Saved Wishlist -->
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
              <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--text-main); margin: 0;">❤️ Your Saved Items</h3>
              <span style="font-size: 0.85rem; color: var(--text-muted);">${wishlist.length} products saved</span>
            </div>
            <div id="profileWishlistContainer">
              ${wishlistHtml}
            </div>
          </div>

          <!-- Right: Account Settings Form -->
          <div style="background: var(--surface); border: 1px solid var(--border); padding: 24px; border-radius: 14px;">
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 0 0 16px;">⚙️ Account Settings</h3>
            
            <div id="profileStatusMsg" style="display: none; padding: 10px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 14px;"></div>

            <form id="profileUpdateForm" style="display: flex; flex-direction: column; gap: 14px;">
              <div class="form-group">
                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">Display Name</label>
                <input type="text" id="profileNameInput" value="${escapeHtml(user.name)}" required style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;" />
              </div>

              <div class="form-group">
                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">Email Address</label>
                <input type="email" value="${escapeHtml(user.email)}" disabled style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: #f3f4f6; color: var(--text-muted);" />
                <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Email cannot be modified directly.</span>
              </div>

              <hr style="border: none; border-top: 1px solid var(--border); margin: 8px 0;" />

              <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0; color: var(--text-main);">Change Password</h4>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0 0 6px;">Leave blank if you do not wish to change your password.</p>

              <div class="form-group">
                <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">Current Password</label>
                <input type="password" id="profileCurrentPassword" placeholder="Required to set new password" style="width: 100%; padding: 9px; border: 1px solid var(--border); border-radius: 8px;" />
              </div>

              <div class="form-group">
                <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">New Password</label>
                <input type="password" id="profileNewPassword" placeholder="Min. 6 characters" style="width: 100%; padding: 9px; border: 1px solid var(--border); border-radius: 8px;" />
              </div>

              <button type="submit" class="buy" style="margin-top: 8px; width: 100%; padding: 11px;">
                Save Changes
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    // Event Listeners
    container.querySelector('#profileBackToShoppingBtn')?.addEventListener('click', () => {
      window.location.hash = '';
    });

    container.querySelector('#profileLogoutBtn')?.addEventListener('click', () => {
      AuthState.logout();
      window.location.hash = '';
      window.location.reload();
    });

    // Remove item from wishlist handler
    container.querySelectorAll('.profile-remove-wishlist').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.getAttribute('data-id');
        await WishlistManager.remove(pid);
        renderProfileView(container);
      });
    });

    // Profile form submission handler
    const form = container.querySelector('#profileUpdateForm');
    const statusMsg = container.querySelector('#profileStatusMsg');

    form?.addEventListener('submit', async e => {
      e.preventDefault();
      const newName = container.querySelector('#profileNameInput')?.value.trim();
      const currentPassword = container.querySelector('#profileCurrentPassword')?.value;
      const newPassword = container.querySelector('#profileNewPassword')?.value;

      statusMsg.style.display = 'none';

      try {
        const payload = { name: newName };
        if (newPassword) {
          payload.currentPassword = currentPassword;
          payload.newPassword = newPassword;
        }

        const res = await updateUserProfileApi(AuthState.getToken(), payload);
        if (res.user) {
          // Update stored user
          localStorage.setItem('haggle_user', JSON.stringify(res.user));
          window.dispatchEvent(new Event('auth-changed'));
        }

        statusMsg.style.display = 'block';
        statusMsg.style.background = '#ecfdf5';
        statusMsg.style.color = '#16A34A';
        statusMsg.textContent = '✓ Profile updated successfully!';

        setTimeout(() => {
          renderProfileView(container);
        }, 1200);
      } catch (err) {
        statusMsg.style.display = 'block';
        statusMsg.style.background = '#fef2f2';
        statusMsg.style.color = '#dc2626';
        statusMsg.textContent = err.message || 'Failed to update profile.';
      }
    });

  } catch (err) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #dc2626;">
        <p style="font-size: 2rem;">⚠️</p>
        <h3>Could not load profile</h3>
        <p>${escapeHtml(err.message)}</p>
        <button id="profileRetryBtn" class="secondary" style="margin-top: 14px;">Try Again</button>
      </div>
    `;
    container.querySelector('#profileRetryBtn')?.addEventListener('click', () => {
      renderProfileView(container);
    });
  }
}
