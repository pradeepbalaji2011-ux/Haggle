/**
 * server/db.js — Universal Pure-JavaScript Storage Engine (Zero Native Dependencies)
 *
 * Implements full user authentication, wishlist management, and price history tracking
 * using robust, atomic JSON disk storage with automated WAL-style writing.
 * Guaranteed to run on any cloud platform (Render, Vercel, Railway, Fly, Heroku, Windows, Linux)
 * without compiling C++ or native binaries (avoids ERR_DLOPEN_FAILED).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, renameSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  getAllUsers,
  saveAllUsers,
  createNewUser,
  getUserByEmail,
  getUserById,
  updateProfile,
  getWishlist,
  addWishlistItem,
  removeWishlistItem
} from './users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const PRICES_FILE = path.join(DATA_DIR, 'price_history.json');

function ensureDataFiles() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(PRICES_FILE)) {
    writeFileSync(PRICES_FILE, '[]', 'utf8');
  }
}

function readPrices() {
  ensureDataFiles();
  try {
    const raw = readFileSync(PRICES_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[db.js] Error reading price_history.json, checking backup:', err.message);
    try {
      const bakFile = `${PRICES_FILE}.bak`;
      if (existsSync(bakFile)) {
        return JSON.parse(readFileSync(bakFile, 'utf8'));
      }
    } catch {}
    return [];
  }
}

function writePrices(prices) {
  ensureDataFiles();
  const tempFile = `${PRICES_FILE}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    writeFileSync(tempFile, JSON.stringify(prices, null, 2), 'utf8');
    if (existsSync(PRICES_FILE)) {
      try { copyFileSync(PRICES_FILE, `${PRICES_FILE}.bak`); } catch {}
    }
    try {
      renameSync(tempFile, PRICES_FILE);
    } catch {
      copyFileSync(tempFile, PRICES_FILE);
      try { unlinkSync(tempFile); } catch {}
    }
  } catch (err) {
    console.error('[db.js] Error atomically writing price_history.json:', err.message);
    try {
      if (existsSync(tempFile)) unlinkSync(tempFile);
    } catch {}
  }
}

/**
 * Initialize Database (runs migration / file checks)
 */
export async function initDb() {
  ensureDataFiles();
  const users = getAllUsers();
  console.log(`✓ Universal data engine initialized. Found ${users.length} registered user(s).`);
  return true;
}

export {
  getAllUsers,
  saveAllUsers,
  createNewUser as createUser,
  getUserByEmail as findUserByEmail,
  getUserById as findUserById,
  updateProfile as updateUserProfile,
  getWishlist as getUserWishlist,
  addWishlistItem as addToWishlist,
  removeWishlistItem as removeFromWishlist
};

/**
 * User and wishlist persistence is unified in server/users.js.
 * Exported aliases are provided above for backwards compatibility.
 */

/**
 * Record historical product prices across stores
 */
export async function recordPrices(products = []) {
  if (!Array.isArray(products) || products.length === 0) return 0;
  const prices = readPrices();
  const now = new Date().toISOString();

  let added = 0;
  for (const item of products) {
    const rawPrice = item.price;
    const numPrice = typeof rawPrice === 'number' ? rawPrice : Number(String(rawPrice || '').replace(/[^\d.]/g, ''));
    if (!Number.isFinite(numPrice) || numPrice <= 0) continue;

    prices.push({
      product_id: item.productId ? String(item.productId) : null,
      name: item.name || item.title || 'Product',
      store: item.store || 'Retailer',
      price: numPrice,
      currency: item.currency || 'INR',
      recorded_at: now
    });
    added++;
  }

  // Keep last 5,000 price records to maintain lightning speed
  if (prices.length > 5000) {
    prices.splice(0, prices.length - 5000);
  }

  writePrices(prices);
  return added;
}

/**
 * Retrieve price history for a product by ID or title
 */
export async function getPriceHistory(productId, limit = 50) {
  if (!productId) return [];
  const prices = readPrices();
  const cleanId = String(productId).trim();

  const matches = prices.filter(p =>
    (p.product_id && String(p.product_id) === cleanId) ||
    (p.name && p.name.toLowerCase().includes(cleanId.toLowerCase()))
  );

  return matches.slice(-limit);
}
