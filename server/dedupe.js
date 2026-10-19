/**
 * server/dedupe.js — Product Deduplication & Multi-Seller Offer Merger
 *
 * Merges multiple listings of the same product (same brand, model, storage, color)
 * into a single unified product card with several store offers.
 *
 * Rules:
 * 1. Never show two cards for the same product.
 * 2. Never show the same store twice for one product (keep the lowest price from that store).
 * 3. Consolidate store offers, calculate lowest price, highest price, and savings.
 */

const KNOWN_COLORS = [
  'desert titanium',
  'natural titanium',
  'white titanium',
  'black titanium',
  'phantom black',
  'cosmic black',
  'space black',
  'space grey',
  'space gray',
  'midnight blue',
  'midnight',
  'starlight',
  'deep purple',
  'sierra blue',
  'alpine green',
  'rose gold',
  'titanium',
  'black',
  'white',
  'blue',
  'pink',
  'teal',
  'ultramarine',
  'green',
  'yellow',
  'purple',
  'red',
  'gold',
  'silver',
  'grey',
  'gray',
  'lavender',
  'cream',
  'mint',
  'coral',
  'orange',
  'bronze'
];

/**
 * Extracts storage capacity from product title (e.g. "128GB", "256 GB", "1TB")
 */
export function extractStorage(title = '') {
  const text = String(title).toLowerCase();
  
  // Check TB first
  const tbMatch = text.match(/\b([1-4])\s*tb\b/);
  if (tbMatch) return `${tbMatch[1]}tb`;

  // Check GB
  const gbMatch = text.match(/\b(16|32|64|128|256|512)\s*gb\b/);
  if (gbMatch) return `${gbMatch[1]}gb`;

  return null;
}

/**
 * Extracts color from product title
 */
export function extractColor(title = '') {
  const text = ` ${String(title).toLowerCase().replace(/[^\w\s]/g, ' ')} `;
  for (const col of KNOWN_COLORS) {
    if (text.includes(` ${col} `)) {
      return col;
    }
  }
  return null;
}

/**
 * Normalizes title into a core model identifier
 */
export function normalizeCoreModel(title = '', brand = '') {
  let clean = String(title || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove storage
  clean = clean.replace(/\b(16|32|64|128|256|512)\s*gb\b/g, '');
  clean = clean.replace(/\b([1-4])\s*tb\b/g, '');
  clean = clean.replace(/\b\d+\s*gb\s*ram\b/g, '');

  // Remove color words
  for (const col of KNOWN_COLORS) {
    clean = clean.replace(new RegExp(`\\b${col}\\b`, 'g'), '');
  }

  // Remove generic filler words
  clean = clean.replace(/\b(5g|4g|lte|sim|dual sim|smartphone|phone|unlocked|apple|samsung|official)\b/g, '');
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

/**
 * Builds a deterministic canonical deduplication key for a product
 */
export function getProductCanonicalKey(product) {
  const title = product.name || product.title || '';
  const brand = (product.brand || '').toLowerCase().trim();
  const storage = extractStorage(title) || 'std';
  const color = extractColor(title) || 'std';
  const coreModel = normalizeCoreModel(title, brand);

  return `${brand}|${coreModel}|${storage}|${color}`;
}

/**
 * Normalizes price value to a positive finite number or null
 */
function cleanPrice(price) {
  if (price === null || price === undefined || price === '') return null;
  const num = typeof price === 'number' ? price : Number(String(price).replace(/[^\d.]/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * Deduplicates and merges products:
 * - Products with matching brand, model, storage, and color merge into one.
 * - For a single product, if the same store appears twice, keep the lowest price offer.
 * - Stores are sorted ascending by price.
 * - The merged product displays the lowest price, store count, and all verified offers.
 *
 * @param {Array} products - Raw products from shopping feed
 * @returns {Array} Merged, deduplicated products
 */
export function deduplicateProducts(products = []) {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  const groups = new Map();

  for (const item of products) {
    if (!item) continue;
    const key = getProductCanonicalKey(item);

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }

  const mergedProducts = [];

  for (const [key, items] of groups.entries()) {
    // Pick the primary representative item (prefer one with an image and clean title)
    const primary = items.find(i => i.image) || items[0];

    // Collect all store offers across merged items
    const storeMap = new Map();

    for (const item of items) {
      // Gather existing offers if item already had stores array, or create one from item itself
      const offers = Array.isArray(item.stores) && item.stores.length > 0
        ? item.stores
        : [{
            id: item.id || `offer-${Math.random().toString(36).slice(2, 7)}`,
            store: item.store || 'Retailer',
            name: item.name || item.title,
            price: cleanPrice(item.price),
            currency: item.currency || 'INR',
            buyUrl: item.buyUrl || null,
            rating: item.rating ?? null,
            reviews: item.reviews ?? null,
            delivery: item.delivery || null,
            badgeColor: item.badgeColor || '#059669',
            platformId: item.platformId || null
          }];

      for (const off of offers) {
        const storeName = (off.store || 'Retailer').trim();
        const storeKey = storeName.toLowerCase();
        const price = cleanPrice(off.price);

        if (!storeMap.has(storeKey)) {
          storeMap.set(storeKey, { ...off, price });
        } else {
          // Never show the same store twice for one product (keep the lowest price)
          const existing = storeMap.get(storeKey);
          if (price !== null && (existing.price === null || price < existing.price)) {
            storeMap.set(storeKey, {
              ...off,
              price,
              buyUrl: off.buyUrl || existing.buyUrl
            });
          }
        }
      }
    }

    // Convert map to array and sort stores so lowest price is first
    const mergedStores = Array.from(storeMap.values()).sort((a, b) => {
      if (a.price === null && b.price === null) return 0;
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      return a.price - b.price;
    });

    // Compute lowest and highest price across valid store offers
    const validPrices = mergedStores.map(s => s.price).filter(p => p !== null);
    const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : cleanPrice(primary.price);
    const highestPrice = validPrices.length > 0 ? Math.max(...validPrices) : lowestPrice;
    const savings = (lowestPrice && highestPrice && highestPrice > lowestPrice) ? (highestPrice - lowestPrice) : 0;

    // The primary buy link should be the lowest price store offer
    const bestOffer = mergedStores.find(s => s.price === lowestPrice && s.buyUrl) || mergedStores[0] || {};

    mergedProducts.push({
      ...primary,
      price: lowestPrice,
      lowestPrice,
      highestPrice,
      savings,
      store: bestOffer.store || primary.store || 'Retailer',
      buyUrl: bestOffer.buyUrl || primary.buyUrl,
      storeCount: mergedStores.length,
      stores: mergedStores,
      hasMultipleOffers: mergedStores.length > 1
    });
  }

  return mergedProducts;
}
