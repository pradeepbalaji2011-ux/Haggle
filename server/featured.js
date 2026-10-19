/**
 * server/featured.js — Real Cached Featured Products for Home Page Shuffling
 *
 * Fetches real search results from a few popular searches, filters & deduplicates them,
 * and caches them for several hours (e.g. 6 hours) so it never exhausts API quota.
 * If nothing is available yet or API is offline, returns a clean placeholder state.
 */

import { searchShopping } from './providers/serpapi.js';
import { filterRelevantProducts } from './relevance.js';
import { deduplicateProducts } from './dedupe.js';
import { validateAndCleanBuyUrl } from './links.js';

const POPULAR_SEARCHES = [
  'iPhone 16',
  'MacBook Air M3',
  'Sony WH 1000XM5',
  'Samsung Galaxy S25',
  'Apple AirPods Pro'
];

// Cache for 6 hours (21,600,000 ms)
const FEATURED_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let featuredCache = {
  products: [],
  timestamp: 0
};

// Clean placeholder fallback in case of cold start with no API key or no internet
const CLEAN_PLACEHOLDER_PRODUCTS = [
  {
    id: 'feat_iphone16_128',
    name: 'Apple iPhone 16 (128 GB) - Black',
    brand: 'Apple',
    price: 79900,
    lowestPrice: 79900,
    highestPrice: 79900,
    store: 'Amazon India',
    image: 'https://m.media-amazon.com/images/I/71w3oJ7aWyL._SL1500_.jpg',
    buyUrl: 'https://www.amazon.in/dp/B0DGJ9B5DX',
    rating: 4.6,
    reviews: 1240,
    storeCount: 3,
    isPlaceholder: true
  },
  {
    id: 'feat_sony_xm5',
    name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    brand: 'Sony',
    price: 26990,
    lowestPrice: 26990,
    highestPrice: 34990,
    store: 'Flipkart',
    image: 'https://m.media-amazon.com/images/I/61+btxzpfDL._SL1500_.jpg',
    buyUrl: 'https://www.flipkart.com/sony-wh-1000xm5-bluetooth-headset/p/itm4d1b747b0a8f8',
    rating: 4.7,
    reviews: 3180,
    storeCount: 4,
    isPlaceholder: true
  },
  {
    id: 'feat_galaxy_s25',
    name: 'Samsung Galaxy S25 5G (128 GB) - Phantom Black',
    brand: 'Samsung',
    price: 74999,
    lowestPrice: 74999,
    highestPrice: 79999,
    store: 'Amazon India',
    image: 'https://m.media-amazon.com/images/I/61bK6PMOC3L._SL1500_.jpg',
    buyUrl: 'https://www.amazon.in/dp/B0D5N4X86Z',
    rating: 4.7,
    reviews: 950,
    storeCount: 3,
    isPlaceholder: true
  },
  {
    id: 'feat_airpods_pro',
    name: 'Apple AirPods Pro (2nd Generation) with MagSafe USB-C',
    brand: 'Apple',
    price: 19999,
    lowestPrice: 19999,
    highestPrice: 24900,
    store: 'Tata CLiQ',
    image: 'https://m.media-amazon.com/images/I/61SUj2aKoEL._SL1500_.jpg',
    buyUrl: 'https://www.tatacliq.com/p-mp000000019284719',
    rating: 4.8,
    reviews: 4210,
    storeCount: 2,
    isPlaceholder: true
  }
];

/**
 * Loads featured products across popular searches from SerpApi with multi-hour caching
 */
export async function getFeaturedProducts() {
  const now = Date.now();

  // Return cached products if still valid
  if (featuredCache.products.length > 0 && (now - featuredCache.timestamp < FEATURED_CACHE_TTL_MS)) {
    return {
      products: featuredCache.products,
      cached: true,
      updatedAt: new Date(featuredCache.timestamp).toISOString()
    };
  }

  // Attempt to fetch fresh search results for popular queries
  if (process.env.SERPAPI_KEY && process.env.SERPAPI_KEY !== 'put_your_api_key_here') {
    try {
      const allFound = [];

      for (const query of POPULAR_SEARCHES) {
        try {
          const res = await searchShopping(query);
          const rawItems = res.products || [];

          // 1. Relevance filter
          const relevant = filterRelevantProducts(rawItems, query);

          // 2. Validate links & Top 20 platform check
          const validated = [];
          for (const item of relevant) {
            const check = validateAndCleanBuyUrl(item.buyUrl, item.store);
            if (check.valid) {
              validated.push({
                ...item,
                buyUrl: check.cleanUrl,
                store: check.storeName,
                badgeColor: check.badgeColor
              });
            }
          }

          // 3. Deduplicate
          const deduped = deduplicateProducts(validated);
          if (deduped.length > 0) {
            // Take the top 2 best results for this query
            allFound.push(...deduped.slice(0, 2));
          }
        } catch (queryErr) {
          console.warn(`[featured] Search error for query "${query}":`, queryErr.message);
        }
      }

      if (allFound.length > 0) {
        featuredCache = {
          products: allFound,
          timestamp: now
        };
        return {
          products: allFound,
          cached: false,
          updatedAt: new Date(now).toISOString()
        };
      }
    } catch (err) {
      console.warn('[featured] Failed to refresh live featured products:', err.message);
    }
  }

  // Fallback to cached or clean placeholder products
  if (featuredCache.products.length > 0) {
    return {
      products: featuredCache.products,
      cached: true,
      updatedAt: new Date(featuredCache.timestamp).toISOString()
    };
  }

  return {
    products: CLEAN_PLACEHOLDER_PRODUCTS,
    cached: true,
    isPlaceholder: true,
    updatedAt: new Date().toISOString()
  };
}
