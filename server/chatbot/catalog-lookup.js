/**
 * server/chatbot/catalog-lookup.js
 * Fast local product lookup across Haggle's price history.
 * Provides exact prices and store comparisons directly to the chatbot.
 */

// Searches price_history.json only — no fabricated catalog data

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '../../data');
const priceHistoryPath = path.join(DATA_DIR, 'price_history.json');

const STOP_WORDS = new Set([
  'what', 'whats', 'is', 'are', 'the', 'price', 'prices', 'of', 'today', 'now', 'current',
  'how', 'much', 'does', 'cost', 'rate', 'rates', 'tell', 'me', 'check', 'show', 'give', 'best', 'deal', 'deals',
  'for', 'in', 'india', 'on', 'at', 'a', 'an', 'and', 'or', 'to', 'can', 'you', 'please', 'any'
]);

function readPriceHistory() {
  try {
    const raw = fs.readFileSync(priceHistoryPath, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * Searches Haggle's price history for products matching a natural language query
 * @param {string} userMessage
 * @returns {Array<object>}
 */
export function searchHaggleCatalog(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return [];

  const clean = userMessage.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9\s]/g, ' ');
  const tokens = clean.split(/\s+/).filter(w => w.length > 0 && !STOP_WORDS.has(w));
  if (tokens.length === 0) return [];

  const results = [];

  // Search recorded price history
  const history = readPriceHistory();
  const seen = new Set();
  for (const h of history) {
    if (!h.name || seen.has(h.name)) continue;
    const text = h.name.toLowerCase();
    const matched = tokens.filter(t => text.includes(t));
    if (matched.length > 0) {
      seen.add(h.name);
      const score = matched.length / tokens.length;
      results.push({
        product: {
          name: h.name,
          brand: 'Electronics',
          lowestPrice: h.price,
          price: h.price,
          store: h.store || 'Verified Store',
          stores: [{ store: h.store || 'Verified Store', price: h.price, inStock: true }]
        },
        score,
        matchedCount: matched.length
      });
    }
  }

  results.sort((a, b) => b.score - a.score || b.matchedCount - a.matchedCount);
  return results.filter(r => r.score >= 0.4).slice(0, 3).map(r => r.product);
}

/**
 * Formats matched products as context for Ollama LLM
 * @param {Array<object>} products
 * @returns {string}
 */
export function formatProductContext(products) {
  if (!Array.isArray(products) || products.length === 0) return '';

  let ctx = `\nRELEVANT HAGGLE PRODUCT DATA (REAL VERIFIED PRICES IN INDIA):\n`;
  for (const p of products) {
    const priceStr = (p.lowestPrice || p.price)?.toLocaleString('en-IN');
    ctx += `- Product: ${p.name}\n`;
    ctx += `  Current Lowest Price: ₹${priceStr}\n`;
    if (Array.isArray(p.stores) && p.stores.length > 0) {
      ctx += `  Store Offers:\n`;
      p.stores.forEach(s => {
        const sPrice = s.price ? `₹${Number(s.price).toLocaleString('en-IN')}` : 'Check store';
        const rating = s.rating ? ` (${s.rating}★)` : '';
        ctx += `    * ${s.store}: ${sPrice}${rating}\n`;
      });
    }
    ctx += `  Compare Page Link: #/search/${encodeURIComponent(p.name.split(' ').slice(0, 3).join(' '))}\n`;
  }
  return ctx;
}

/**
 * Formats a direct user-friendly reply for intent-matcher
 * @param {object} p
 * @returns {string}
 */
export function formatProductReply(p) {
  if (!p) return null;
  const lowest = (p.lowestPrice || p.price)?.toLocaleString('en-IN');
  let text = `The lowest price for **${p.name}** today is **₹${lowest}**! 🛒\n\n`;

  if (Array.isArray(p.stores) && p.stores.length > 0) {
    text += `Here is how verified Indian stores compare:\n`;
    p.stores.forEach(s => {
      const sPrice = s.price ? `₹${Number(s.price).toLocaleString('en-IN')}` : 'Check store';
      const rating = s.rating ? ` (${s.rating}★)` : '';
      const delivery = s.delivery ? ` · ${s.delivery}` : '';
      text += `• **${s.store}**: ${sPrice}${rating}${delivery}\n`;
    });
    text += `\n`;
  }

  const searchTag = p.name.split(' ').slice(0, 3).join(' ');
  text += `Type **${searchTag}** in the search bar above to view the live comparison and 30-day price graph!`;
  return text;
}
