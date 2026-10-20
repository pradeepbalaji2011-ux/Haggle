/**
 * server/chatbot/scheduler.js — Scheduled Price Tracker & Trending Job
 *
 * Runs periodically to:
 * 1. Track price changes on wishlisted products across all registered users.
 * 2. Re-check top popular/trending products to build rich historical price datasets.
 * 3. Group flat price_history.json records by product name, compute biggest drops,
 *    and update data/trending.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAllUsers } from '../users.js';
import { retrieveProductData } from './retrieval.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const trendingPath = path.join(__dirname, '../../data/trending.json');
const priceHistoryPath = path.join(__dirname, '../../data/price_history.json');

const POPULAR_TRACK_LIST = [
  'iPhone 16',
  'Samsung Galaxy S24',
  'boAt Airdopes 141',
  'MacBook Air M2',
  'Sony WH-1000XM5',
  'OnePlus 12R',
  'Redmi Note 13',
  'Smart TV 55 inch'
];

function readPriceHistory() {
  try {
    const raw = fs.readFileSync(priceHistoryPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Computes top price drops by grouping records by product name
 */
export function computeBiggestDrops(records) {
  if (!Array.isArray(records) || records.length === 0) return [];

  // Group by canonical product name
  const grouped = new Map();
  for (const r of records) {
    if (!r.name || !r.price) continue;
    const key = r.name.toLowerCase().trim();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(r);
  }

  const drops = [];
  const now = Date.now();

  for (const [key, items] of grouped.entries()) {
    if (items.length < 2) continue;
    // Sort chronological: oldest to newest
    items.sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

    const latest = items[items.length - 1];
    // Find an older record (at least 1 day ago, or earliest)
    const earlier = items.find(i => (now - new Date(i.recorded_at).getTime()) >= 24 * 3600 * 1000) || items[0];

    if (earlier && earlier.price > latest.price) {
      const dropAmount = earlier.price - latest.price;
      const dropPercent = Math.round((dropAmount / earlier.price) * 100);
      if (dropPercent >= 2) {
        drops.push({
          name: latest.name,
          price: latest.price,
          oldPrice: earlier.price,
          drop: dropAmount,
          dropPercent,
          store: latest.store || 'Online'
        });
      }
    }
  }

  drops.sort((a, b) => b.dropPercent - a.dropPercent);
  return drops.slice(0, 10);
}

/**
 * Updates data/trending.json with real stats
 */
export function refreshTrendingData() {
  try {
    const history = readPriceHistory();
    const biggestDrops = computeBiggestDrops(history);

    // Get wishlisted products from registered users
    const users = getAllUsers() || [];
    const wishlistItems = [];
    users.forEach(u => {
      if (Array.isArray(u.wishlist)) {
        u.wishlist.forEach(w => {
          if (w && w.name) wishlistItems.push(w.name);
        });
      }
    });

    const uniqueWishlist = Array.from(new Set(wishlistItems)).slice(0, 10);

    const trendingPayload = {
      updatedAt: new Date().toISOString(),
      trending: POPULAR_TRACK_LIST.map(name => ({ name })),
      biggestDrops,
      mostWishlisted: uniqueWishlist.map(name => ({ name })),
      recentSearches: POPULAR_TRACK_LIST
    };

    fs.writeFileSync(trendingPath, JSON.stringify(trendingPayload, null, 2), 'utf8');
    console.log(`[scheduler] Trending data refreshed — ${biggestDrops.length} drops, ${uniqueWishlist.length} wishlisted items`);
  } catch (err) {
    console.warn('[scheduler] Trending refresh error:', err.message);
  }
}

/**
 * Background polling cycle that re-checks products and appends to price history
 */
export async function runPriceTrackerCycle() {
  try {
    const users = getAllUsers() || [];
    const targets = new Set(POPULAR_TRACK_LIST.slice(0, 4));

    users.forEach(u => {
      if (Array.isArray(u.wishlist)) {
        u.wishlist.slice(0, 2).forEach(w => {
          if (w && w.name) targets.add(w.name);
        });
      }
    });

    // Re-check up to 4 targets per cycle to respect API rate limits
    const cycleList = Array.from(targets).slice(0, 4);
    for (const item of cycleList) {
      try {
        await retrieveProductData(item, false);
      } catch (err) {
        // Continue silently
      }
    }

    refreshTrendingData();
  } catch (err) {
    console.warn('[scheduler] Price tracker cycle error:', err.message);
  }
}

/**
 * Starts the scheduled price history background job
 * @param {number} intervalMs Defaults to 30 minutes
 */
export function startPriceScheduler(intervalMs = 30 * 60 * 1000) {
  // Run once shortly after startup (after 5 seconds)
  setTimeout(() => {
    runPriceTrackerCycle();
  }, 5000);

  // Set recurring timer
  const timer = setInterval(() => {
    runPriceTrackerCycle();
  }, intervalMs);

  console.log('[scheduler] Price history background scheduler started (30m interval)');
  return timer;
}
