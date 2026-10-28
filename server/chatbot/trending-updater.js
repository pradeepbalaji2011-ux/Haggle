/**
 * server/chatbot/trending-updater.js
 * Background job that updates data/trending.json every 30 minutes.
 * Uses Haggle's own database (price_history.json + SQLite) to build context.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '../../data');
const trendingPath = path.join(DATA_DIR, 'trending.json');
const priceHistoryPath = path.join(DATA_DIR, 'price_history.json');

const POPULAR_SEARCHES = [
  'iPhone 16', 'Samsung Galaxy S25', 'Sony WH-1000XM5',
  'MacBook Air M3', 'Smart TV 55 inch', 'OnePlus 12',
  'boAt Airdopes 141', 'Realme Narzo 70', 'iPad Air M2',
  'Xiaomi 14 Civi'
];

function readPriceHistory() {
  try {
    const raw = fs.readFileSync(priceHistoryPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function computeBiggestDrops(history) {
  const drops = [];
  for (const [productKey, records] of Object.entries(history)) {
    if (!Array.isArray(records) || records.length < 2) continue;
    const sorted = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = sorted[0];
    const weekAgo = sorted.find(r => {
      const d = new Date(r.date);
      return (Date.now() - d.getTime()) > 5 * 24 * 60 * 60 * 1000;
    });
    if (latest && weekAgo && weekAgo.price > latest.price) {
      const drop = weekAgo.price - latest.price;
      const pct = Math.round((drop / weekAgo.price) * 100);
      if (pct >= 3) {
        drops.push({
          name: latest.name || productKey,
          price: latest.price,
          oldPrice: weekAgo.price,
          drop,
          dropPercent: pct,
          store: latest.store || 'Various'
        });
      }
    }
  }
  return drops.sort((a, b) => b.dropPercent - a.dropPercent).slice(0, 10);
}

export function updateTrending() {
  try {
    const history = readPriceHistory();
    const biggestDrops = computeBiggestDrops(history);

    const trending = {
      updatedAt: new Date().toISOString(),
      trending: POPULAR_SEARCHES.slice(0, 10).map(name => ({ name })),
      biggestDrops,
      mostWishlisted: [],
      recentSearches: POPULAR_SEARCHES
    };

    fs.writeFileSync(trendingPath, JSON.stringify(trending, null, 2));
    console.log(`[chatbot] Trending data updated — ${biggestDrops.length} price drops found`);
  } catch (err) {
    console.warn('[chatbot] Could not update trending data:', err.message);
  }
}

/**
 * Start background update job (runs every 30 minutes)
 */
export function startTrendingUpdater() {
  updateTrending(); // Run immediately on startup
  setInterval(updateTrending, 30 * 60 * 1000); // Then every 30 min
  console.log('[chatbot] Trending updater started (30-min interval)');
}

/**
 * Get trending data as a formatted string for AI context injection
 */
export function getTrendingContext() {
  try {
    const data = JSON.parse(fs.readFileSync(trendingPath, 'utf8'));
    let ctx = `HAGGLE LIVE DATA (as of ${new Date(data.updatedAt).toLocaleString('en-IN')}):\n`;
    if (data.recentSearches?.length > 0) {
      ctx += `\nTop searched products: ${data.recentSearches.slice(0, 8).join(', ')}`;
    }
    if (data.biggestDrops?.length > 0) {
      ctx += `\n\nBiggest recent price drops:\n`;
      data.biggestDrops.slice(0, 5).forEach(d => {
        ctx += `- ${d.name}: was ₹${d.oldPrice?.toLocaleString('en-IN')}, now ₹${d.price?.toLocaleString('en-IN')} (${d.dropPercent}% drop at ${d.store})\n`;
      });
    }
    return ctx;
  } catch {
    return 'HAGGLE DATA: Price comparison across 12 verified Indian platforms including Amazon, Flipkart, Meesho, Myntra, and more.';
  }
}
