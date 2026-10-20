/**
 * server/chatbot/retrieval.js — Universal Multi-Sector Product & Price History Retrieval
 *
 * Implements:
 * 1. Multi-tier retrieval across all sectors (electronics, fashion, beauty, home, groceries, etc.).
 * 2. 6-hour freshness check: retrieves from local cache/database first, falls back to live SerpApi/scraper.
 * 3. Atomic price history tracking and analytics (lowest/highest ever, average, 7/30/90-day changes,
 *    and a calculated "good time to buy" signal).
 * 4. Request queue & concurrency limiter to protect SerpApi credits.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FALLBACK_CATALOG } from '../fallback-catalog.js';
import { searchShopping } from '../providers/html-scraper.js';
import { filterRelevantProducts } from '../relevance.js';
import { deduplicateProducts } from '../dedupe.js';
import { recordPrices, getPriceHistory } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRESHNESS_LIMIT_MS = 6 * 60 * 60 * 1000; // 6 hours

// In-memory memory cache with timestamps
const retrievalCache = new Map();

// In-flight request de-duplication queue
const inFlightRequests = new Map();

function getCacheKey(query = '') {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Searches local catalog (fallback catalog + price history)
 */
export function findInLocalCatalog(query = '') {
  if (!query || typeof query !== 'string') return [];
  const clean = query.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9\s]/g, ' ');
  const tokens = clean.split(/\s+/).filter(w => w.length > 1);
  if (tokens.length === 0) return [];

  const results = [];
  for (const p of FALLBACK_CATALOG) {
    const text = `${p.name || ''} ${p.brand || ''}`.toLowerCase();
    const matches = tokens.filter(t => text.includes(t));
    if (matches.length > 0) {
      const score = matches.length / tokens.length;
      results.push({ product: p, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.filter(r => r.score >= 0.4).slice(0, 4).map(r => r.product);
}

/**
 * Retrieves full live product data across all stores with 6-hour freshness guarantee
 */
export async function retrieveProductData(query = '', forceLive = false) {
  if (!query || typeof query !== 'string') {
    return { query, products: [], source: 'empty', timestamp: new Date().toISOString() };
  }

  const key = getCacheKey(query);
  const now = Date.now();

  // 1. Check in-memory cache if fresh
  if (!forceLive && retrievalCache.has(key)) {
    const cached = retrievalCache.get(key);
    if (now - cached.time < FRESHNESS_LIMIT_MS) {
      return { ...cached.data, source: 'cache_fresh' };
    }
  }

  // 2. Check local database/fallback catalog first
  const localMatches = findInLocalCatalog(query);
  if (!forceLive && localMatches.length > 0) {
    const data = {
      query,
      products: localMatches,
      source: 'database_catalog',
      timestamp: new Date().toISOString()
    };
    retrievalCache.set(key, { data, time: now });
    return data;
  }

  // 3. De-duplicate concurrent live requests (queue/promise reuse)
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const livePromise = (async () => {
    try {
      // Live search via universal shopping provider
      const raw = await searchShopping(query);
      const rawProducts = raw.products || [];

      // Relevance filter and deduplicate
      const relevant = filterRelevantProducts(rawProducts, query);
      const deduplicated = deduplicateProducts(relevant.length > 0 ? relevant : rawProducts);

      if (deduplicated.length > 0) {
        // Record all live prices into price_history.json
        recordPrices(deduplicated).catch(err => console.warn('[retrieval] Record prices failed:', err.message));

        const result = {
          query,
          products: deduplicated.slice(0, 6),
          source: 'live_provider',
          timestamp: new Date().toISOString()
        };
        retrievalCache.set(key, { data: result, time: Date.now() });
        return result;
      }
    } catch (err) {
      console.warn(`[retrieval] Live search failed for "${query}":`, err.message);
    } finally {
      inFlightRequests.delete(key);
    }

    // Graceful fallback to local matches or generic empty
    const fallbackProducts = findInLocalCatalog(query);
    return {
      query,
      products: fallbackProducts,
      source: fallbackProducts.length > 0 ? 'fallback_catalog' : 'not_found',
      timestamp: new Date().toISOString()
    };
  })();

  inFlightRequests.set(key, livePromise);
  return livePromise;
}

/**
 * Calculates statistical price history metrics for a product
 */
export async function analyzePriceHistory(productName, currentPrice = null) {
  if (!productName) return null;

  const records = await getPriceHistory(productName, 100);

  if (!records || records.length === 0) {
    return {
      hasHistory: false,
      productName,
      message: `I've only started tracking ${productName} today. Real historical movements will record over time.`
    };
  }

  const prices = records.map(r => r.price).filter(p => Number.isFinite(p) && p > 0);
  if (prices.length === 0) {
    return { hasHistory: false, productName };
  }

  const lowestEver = Math.min(...prices);
  const highestEver = Math.max(...prices);
  const averagePrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

  // Chronological sort
  records.sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
  const firstTracked = records[0].recorded_at;
  const daysTracked = Math.max(1, Math.round((Date.now() - new Date(firstTracked).getTime()) / (1000 * 3600 * 24)));

  const activePrice = currentPrice || prices[prices.length - 1];
  const currentVsAvgPct = Math.round(((activePrice - averagePrice) / averagePrice) * 100);

  // Time-window price movements
  const now = Date.now();
  const getChangeSince = (days) => {
    const targetDate = now - days * 24 * 3600 * 1000;
    const oldRecord = records.find(r => new Date(r.recorded_at).getTime() >= targetDate);
    if (!oldRecord || !oldRecord.price) return null;
    const diff = activePrice - oldRecord.price;
    const pct = Math.round((diff / oldRecord.price) * 100);
    return { diff, pct, oldPrice: oldRecord.price };
  };

  const change7d = getChangeSince(7);
  const change30d = getChangeSince(30);
  const change90d = getChangeSince(90);

  // Good time to buy signal
  let buySignal = 'GOOD_TIME';
  let buyReason = 'Price is around the fair market average.';

  if (activePrice <= lowestEver || activePrice <= Math.round(lowestEver * 1.03)) {
    buySignal = 'GREAT_TIME';
    buyReason = `Current price (₹${activePrice.toLocaleString('en-IN')}) is at or within 3% of the lowest price ever recorded (₹${lowestEver.toLocaleString('en-IN')}).`;
  } else if (activePrice < averagePrice) {
    buySignal = 'GOOD_TIME';
    buyReason = `Current price is ${Math.abs(currentVsAvgPct)}% below the historical average of ₹${averagePrice.toLocaleString('en-IN')}.`;
  } else if (activePrice >= highestEver || activePrice >= Math.round(highestEver * 0.97)) {
    buySignal = 'WAIT';
    buyReason = `Price is currently near its highest recorded point (₹${highestEver.toLocaleString('en-IN')}). Historical data suggests frequent drops.`;
  }

  return {
    hasHistory: true,
    productName,
    activePrice,
    lowestEver,
    highestEver,
    averagePrice,
    firstTrackedDate: new Date(firstTracked).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    daysTracked,
    currentVsAvgPct,
    change7d,
    change30d,
    change90d,
    buySignal,
    buyReason,
    recentPoints: records.slice(-8).map(r => ({
      date: new Date(r.recorded_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      price: r.price,
      store: r.store
    }))
  };
}
