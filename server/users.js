/**
 * server/users.js — User Account Data Store & Wishlist Persistence
 *
 * Stores user records and wishlists in data/users.json with atomic writes.
 * Normalizes emails (lowercase, trimmed whitespace/autofill).
 * Never modifies or logs passwords.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, renameSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

export function ensureDataDirectory() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(USERS_FILE)) {
    writeFileSync(USERS_FILE, '[]', 'utf8');
  }
}

/**
 * Normalizes email address:
 * - Trims accidental leading/trailing whitespace and mobile autofill characters
 * - Converts to lowercase
 */
export function normalizeEmail(email = '') {
  if (!email || typeof email !== 'string') return '';
  return email
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces from autofill
    .toLowerCase();
}

/**
 * Reads all users from disk with automatic backup recovery
 */
export function getAllUsers() {
  ensureDataDirectory();
  try {
    const raw = readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[users.js] Could not parse users.json, attempting backup recovery:', err.message);
    try {
      const bakFile = `${USERS_FILE}.bak`;
      if (existsSync(bakFile)) {
        const bakRaw = readFileSync(bakFile, 'utf8');
        const recovered = JSON.parse(bakRaw);
        console.info('[users.js] Successfully recovered users from backup.');
        return recovered;
      }
    } catch (bakErr) {
      console.error('[users.js] Backup recovery failed:', bakErr.message);
    }
    return [];
  }
}

/**
 * Writes users atomically to disk using temp file + rename and maintains a .bak file
 */
export function saveAllUsers(users) {
  ensureDataDirectory();
  const tempFile = `${USERS_FILE}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    const payload = JSON.stringify(users, null, 2);
    writeFileSync(tempFile, payload, 'utf8');

    // Create backup before replacing
    if (existsSync(USERS_FILE)) {
      try {
        copyFileSync(USERS_FILE, `${USERS_FILE}.bak`);
      } catch {}
    }

    // Atomic replace
    try {
      renameSync(tempFile, USERS_FILE);
    } catch {
      // Windows lock fallback
      copyFileSync(tempFile, USERS_FILE);
      try { unlinkSync(tempFile); } catch {}
    }
  } catch (err) {
    console.error('[users.js] Failed to atomically write users.json:', err.message);
    try {
      if (existsSync(tempFile)) unlinkSync(tempFile);
    } catch {}
  }
}

/**
 * Finds user by normalized email
 */
export async function getUserByEmail(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!email) return null;

  const users = getAllUsers();
  return users.find(u => normalizeEmail(u.email) === email) || null;
}

/**
 * Finds user by ID
 */
export async function getUserById(id) {
  if (!id) return null;
  const users = getAllUsers();
  return users.find(u => String(u.id) === String(id)) || null;
}

/**
 * Creates a new user record
 */
export async function createNewUser({ name, email, passwordHash }) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) throw new Error('Invalid email address');

  const users = getAllUsers();
  if (users.some(u => normalizeEmail(u.email) === cleanEmail)) {
    const error = new Error('Email already registered');
    error.code = 'EMAIL_EXISTS';
    throw error;
  }

  const cleanName = (name && typeof name === 'string' && name.trim()) || cleanEmail.split('@')[0];

  const newUser = {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: cleanName,
    email: cleanEmail,
    passwordHash,
    wishlist: [],
    welcomeEmailSent: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  users.push(newUser);
  saveAllUsers(users);

  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    createdAt: newUser.createdAt
  };
}

/**
 * Updates user profile details (e.g. editable display name)
 */
export async function updateProfile(id, updates = {}) {
  const users = getAllUsers();
  const idx = users.findIndex(u => String(u.id) === String(id));
  if (idx === -1) throw new Error('User not found');

  if (updates.name && typeof updates.name === 'string' && updates.name.trim()) {
    users[idx].name = updates.name.trim();
  }

  if (updates.passwordHash) {
    users[idx].passwordHash = updates.passwordHash;
  }

  users[idx].updatedAt = new Date().toISOString();
  saveAllUsers(users);

  return {
    id: users[idx].id,
    name: users[idx].name,
    email: users[idx].email,
    createdAt: users[idx].createdAt
  };
}

/**
 * Retrieves user's saved wishlist from server
 */
export async function getWishlist(userId) {
  const user = await getUserById(userId);
  if (!user || !Array.isArray(user.wishlist)) return [];

  return user.wishlist.map(item => ({
    id: String(item.id || item.product_id),
    productId: String(item.productId || item.product_id || item.id),
    name: item.name || item.title || 'Product',
    price: item.price != null ? item.price : '',
    store: item.store || 'Retailer',
    image: item.image || '',
    buyUrl: item.buyUrl || item.buy_url || '',
    savedAt: item.savedAt || item.saved_at || new Date().toISOString()
  }));
}

/**
 * Adds a product to user's server wishlist
 */
export async function addWishlistItem(userId, product) {
  const users = getAllUsers();
  const idx = users.findIndex(u => String(u.id) === String(userId));
  if (idx === -1) throw new Error('User not found');

  const list = Array.isArray(users[idx].wishlist) ? users[idx].wishlist : [];
  const prodId = String(product.id || product.productId || product.product_id);

  const formatted = {
    id: prodId,
    productId: prodId,
    name: product.name || product.title || 'Product',
    price: product.price != null ? product.price : '',
    addedPrice: product.addedPrice != null ? product.addedPrice : (product.price != null ? product.price : ''),
    store: product.store || 'Retailer',
    image: product.image || '',
    buyUrl: product.buyUrl || product.buy_url || '',
    savedAt: new Date().toISOString()
  };

  const existingIdx = list.findIndex(p => String(p.id || p.productId || p.product_id) === prodId);
  if (existingIdx !== -1) {
    list[existingIdx] = {
      ...formatted,
      addedPrice: list[existingIdx].addedPrice ?? formatted.addedPrice
    };
  } else {
    list.unshift(formatted);
  }

  users[idx].wishlist = list;
  saveAllUsers(users);

  return getWishlist(userId);
}

/**
 * Removes a product from user's server wishlist
 */
export async function removeWishlistItem(userId, productId) {
  const users = getAllUsers();
  const idx = users.findIndex(u => String(u.id) === String(userId));
  if (idx === -1) throw new Error('User not found');

  const prodId = String(productId);
  const list = Array.isArray(users[idx].wishlist) ? users[idx].wishlist : [];
  users[idx].wishlist = list.filter(p => String(p.id || p.productId || p.product_id) !== prodId);
  saveAllUsers(users);

  return getWishlist(userId);
}

/**
 * Retrieves user's active price alerts
 */
export async function getPriceAlerts(userId) {
  const user = await getUserById(userId);
  if (!user || !Array.isArray(user.priceAlerts)) return [];

  return user.priceAlerts.map(item => ({
    id: String(item.id || item.productId),
    productId: String(item.productId || item.id),
    name: item.name || item.title || 'Product',
    currentPrice: item.currentPrice != null ? item.currentPrice : null,
    targetPrice: item.targetPrice != null ? item.targetPrice : null,
    store: item.store || 'Retailer',
    image: item.image || '',
    buyUrl: item.buyUrl || '',
    createdAt: item.createdAt || new Date().toISOString()
  }));
}

/**
 * Sets or updates a price alert for a product
 */
export async function setPriceAlert(userId, alertData) {
  const users = getAllUsers();
  const idx = users.findIndex(u => String(u.id) === String(userId));
  if (idx === -1) throw new Error('User not found');

  const prodId = String(alertData.productId || alertData.id);
  const targetPrice = Number(alertData.targetPrice);
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
    throw new Error('Please enter a valid target price.');
  }

  const alerts = Array.isArray(users[idx].priceAlerts) ? users[idx].priceAlerts : [];
  const entry = {
    id: prodId,
    productId: prodId,
    name: alertData.name || alertData.title || 'Product',
    currentPrice: alertData.currentPrice != null ? Number(alertData.currentPrice) : null,
    targetPrice,
    store: alertData.store || 'Retailer',
    image: alertData.image || '',
    buyUrl: alertData.buyUrl || '',
    createdAt: new Date().toISOString()
  };

  const existingIdx = alerts.findIndex(a => String(a.id || a.productId) === prodId);
  if (existingIdx !== -1) {
    alerts[existingIdx] = entry;
  } else {
    alerts.unshift(entry);
  }

  users[idx].priceAlerts = alerts;
  saveAllUsers(users);

  return getPriceAlerts(userId);
}

/**
 * Removes a price alert
 */
export async function removePriceAlert(userId, productId) {
  const users = getAllUsers();
  const idx = users.findIndex(u => String(u.id) === String(userId));
  if (idx === -1) throw new Error('User not found');

  const prodId = String(productId);
  const alerts = Array.isArray(users[idx].priceAlerts) ? users[idx].priceAlerts : [];
  users[idx].priceAlerts = alerts.filter(a => String(a.id || a.productId) !== prodId);
  saveAllUsers(users);

  return getPriceAlerts(userId);
}

// ─── OTP & Reset Token Helpers ────────────────────────────────────────────────

/**
 * Marks the user's welcomeEmailSent flag as true
 */
export function markWelcomeEmailSent(email) {
  const cleanEmail = normalizeEmail(email);
  const users = getAllUsers();
  const idx = users.findIndex(u => normalizeEmail(u.email) === cleanEmail);
  if (idx === -1) return;
  users[idx].welcomeEmailSent = true;
  users[idx].updatedAt = new Date().toISOString();
  saveAllUsers(users);
}

/**
 * Stores an OTP hash + expiry on the user record
 */
export function storeOtpForUser(email, otpHash, expiresAt) {
  const cleanEmail = normalizeEmail(email);
  const users = getAllUsers();
  const idx = users.findIndex(u => normalizeEmail(u.email) === cleanEmail);
  if (idx === -1) return false;
  users[idx].otpHash = otpHash;
  users[idx].otpExpiry = expiresAt;
  users[idx].otpAttempts = 0;
  users[idx].resetToken = null;
  users[idx].resetTokenExpiry = null;
  users[idx].updatedAt = new Date().toISOString();
  saveAllUsers(users);
  return true;
}

/**
 * Increments OTP failed attempt count and returns current count
 */
export function incrementOtpAttempts(email) {
  const cleanEmail = normalizeEmail(email);
  const users = getAllUsers();
  const idx = users.findIndex(u => normalizeEmail(u.email) === cleanEmail);
  if (idx === -1) return 0;
  users[idx].otpAttempts = (users[idx].otpAttempts || 0) + 1;
  users[idx].updatedAt = new Date().toISOString();
  saveAllUsers(users);
  return users[idx].otpAttempts;
}

/**
 * Clears OTP fields and stores a single-use reset token
 */
export function storeResetToken(email, resetToken, expiresAt) {
  const cleanEmail = normalizeEmail(email);
  const users = getAllUsers();
  const idx = users.findIndex(u => normalizeEmail(u.email) === cleanEmail);
  if (idx === -1) return false;
  users[idx].otpHash = null;
  users[idx].otpExpiry = null;
  users[idx].otpAttempts = 0;
  users[idx].resetToken = resetToken;
  users[idx].resetTokenExpiry = expiresAt;
  users[idx].updatedAt = new Date().toISOString();
  saveAllUsers(users);
  return true;
}

/**
 * Resets password using a valid reset token; clears token on success
 */
export function applyPasswordReset(resetToken, newPasswordHash) {
  const users = getAllUsers();
  const now = Date.now();
  const idx = users.findIndex(u =>
    u.resetToken === resetToken &&
    u.resetTokenExpiry &&
    now < new Date(u.resetTokenExpiry).getTime()
  );
  if (idx === -1) return null;
  const email = users[idx].email;
  users[idx].passwordHash = newPasswordHash;
  users[idx].resetToken = null;
  users[idx].resetTokenExpiry = null;
  users[idx].otpHash = null;
  users[idx].otpExpiry = null;
  users[idx].otpAttempts = 0;
  users[idx].updatedAt = new Date().toISOString();
  saveAllUsers(users);
  return email;
}
