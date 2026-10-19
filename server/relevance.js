/**
 * server/relevance.js — Search Query Relevance & Accessory / Model Filter
 *
 * Ensures accurate product search results:
 * 1. Accessory Exclusion: When searching for a main device (e.g. "iphone 16"),
 *    exclude cases, covers, screen guards, chargers, cables, straps, stands, etc.
 *    Accessories are only included when the search query itself explicitly contains
 *    an accessory keyword (e.g. "iphone 16 case").
 * 2. Strict Model Matching: When searching for a specific model (e.g. "iphone 16"),
 *    exclude variant modifiers (e.g. "Pro", "Plus", "Pro Max", "Ultra") unless the
 *    search query specifically asked for them.
 */

// Editable list of accessory keywords (lowercase)
export const ACCESSORY_KEYWORDS = [
  'case',
  'cover',
  'back cover',
  'flip cover',
  'silicone case',
  'leather case',
  'charger',
  'charging cable',
  'cable',
  'adapter',
  'power adapter',
  'screen guard',
  'screen protector',
  'tempered glass',
  'protective film',
  'strap',
  'band',
  'watch strap',
  'watch band',
  'stand',
  'dock',
  'mount',
  'holder',
  'pouch',
  'sleeve',
  'skin',
  'wrap',
  'lens protector',
  'camera protector',
  'bumper',
  'keychain',
  'stylus',
  'pen tip',
  'ear tip',
  'ear tips',
  'cushion',
  'cushions'
];

// Common model variant modifiers (ordered longest/most specific first)
export const MODEL_MODIFIERS = [
  'pro max',
  'pro',
  'plus',
  'ultra',
  'mini',
  'max',
  'fe',
  'lite',
  'se',
  'neo',
  'play'
];

/**
 * Normalizes text for matching: lowercase, collapses spaces, removes punctuation
 */
function normalize(str = '') {
  return String(str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether a text contains a keyword with word boundaries
 */
function containsKeyword(text, keyword) {
  const normText = ` ${normalize(text)} `;
  const normKw = normalize(keyword);
  return normText.includes(` ${normKw} `);
}

/**
 * Checks if the user query contains any accessory keyword
 */
export function queryHasAccessory(query = '') {
  for (const kw of ACCESSORY_KEYWORDS) {
    if (containsKeyword(query, kw)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if the product title contains any accessory keyword
 */
export function isProductAccessory(title = '') {
  for (const kw of ACCESSORY_KEYWORDS) {
    if (containsKeyword(title, kw)) {
      return true;
    }
  }
  return false;
}

/**
 * Extracts which model modifiers are present in a given string
 */
export function extractModifiers(text = '') {
  const found = [];
  let remaining = ` ${normalize(text)} `;

  for (const mod of MODEL_MODIFIERS) {
    const paddedMod = ` ${mod} `;
    if (remaining.includes(paddedMod)) {
      found.push(mod);
      // Remove to prevent partial substring double matches (e.g. 'pro max' before 'pro')
      remaining = remaining.replace(new RegExp(paddedMod, 'g'), ' ');
    }
  }
  return found;
}

// Generic category keywords across major product categories
export const CATEGORY_GENERIC_TERMS = new Set([
  'smartphone', 'smartphones', 'phone', 'phones', 'mobile', 'mobiles', 'cellphone', 'cellphones',
  'laptop', 'laptops', 'notebook', 'notebooks', 'computer', 'computers', 'pc',
  'headphone', 'headphones', 'earphone', 'earphones', 'earbuds', 'airpods',
  'smartwatch', 'smartwatches', 'watch', 'watches',
  'tablet', 'tablets', 'ipad',
  'tv', 'tvs', 'television', 'televisions',
  'appliance', 'appliances', 'conditioner', 'refrigerator', 'fridge',
  'shoe', 'shoes', 'sneaker', 'sneakers', 'footwear',
  'oil', 'groceries', 'grocery'
]);

// Technical spec descriptors that modify categories rather than defining a specific model
export const SPEC_DESCRIPTORS = new Set([
  '5g', '4g', '3g', 'lte', 'wifi', 'bluetooth', 'wireless', 'gb', 'tb', 'ram', 'rom', 'storage'
]);

/**
 * Checks if a query is a general category search or contains broad category keywords
 */
export function isGenericCategoryQuery(query = '') {
  const clean = normalize(query);
  if (!clean) return false;
  const tokens = clean.split(' ').filter(t => t.length > 0);
  if (tokens.length === 0) return false;
  for (const token of tokens) {
    if (CATEGORY_GENERIC_TERMS.has(token)) return true;
  }
  const nonSpecTokens = tokens.filter(t => !SPEC_DESCRIPTORS.has(t));
  return nonSpecTokens.length === 0;
}

/**
 * Determines whether a product title is relevant to the search query.
 *
 * Rules:
 * 1. If query DOES NOT contain an accessory keyword, but the product title DOES,
 *    drop the product (e.g. "iphone 16" query drops "iPhone 16 silicone case").
 * 2. If query DOES contain an accessory keyword, allow accessories.
 * 3. Model modifier matching:
 *    - Extract modifiers present in the query (e.g. query "iphone 16" has none; query "iphone 16 pro" has "pro").
 *    - For specific model queries (e.g. "iphone 16"), if product title has a modifier that was NOT requested,
 *      drop it (e.g. "iphone 16" drops "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16 Pro Max").
 *    - Generic category queries (e.g. "smartphone 5g", "laptop") allow model variants.
 *    - If query asked for a modifier (e.g. "pro"), but product does NOT have it or has a conflicting one (e.g. "pro max"),
 *      drop it.
 * 4. All primary non-category search terms in query must appear in product title.
 *
 * @param {object|string} product - Product object or title string
 * @param {string} query - User search query
 * @returns {boolean} True if product is relevant
 */
export function isRelevant(product, query = '') {
  const title = typeof product === 'string' ? product : (product?.name || product?.title || '');
  if (!title || !query) return false;

  const cleanQuery = normalize(query);
  const cleanTitle = normalize(title);
  if (!cleanQuery || !cleanTitle) return false;

  // 1. Accessory rule
  const queryWantsAccessory = queryHasAccessory(cleanQuery);
  const titleIsAccessory = isProductAccessory(cleanTitle);

  if (!queryWantsAccessory && titleIsAccessory) {
    return false;
  }

  // 2. Model modifier rule
  const queryMods = extractModifiers(cleanQuery);
  const titleMods = extractModifiers(cleanTitle);
  const isGeneric = isGenericCategoryQuery(cleanQuery);

  // For specific model queries (e.g. "iphone 16"), reject unrequested modifiers (e.g. "pro", "plus")
  if (!isGeneric) {
    const unrequestedMods = titleMods.filter(m => !queryMods.includes(m));
    if (unrequestedMods.length > 0) {
      return false;
    }
  }

  // Modifiers requested in query that are missing in title
  const missingMods = queryMods.filter(m => !titleMods.includes(m));
  if (missingMods.length > 0) {
    return false;
  }

  // 3. Primary token matching: Every non-category term should appear in title
  const queryTokens = cleanQuery.split(' ').filter(t => t.length > 1);
  const specificTokens = queryTokens.filter(t => !CATEGORY_GENERIC_TERMS.has(t));

  for (const token of specificTokens) {
    if (!cleanTitle.includes(token)) {
      return false;
    }
  }

  return true;
}

/**
 * Parses numeric price from string or number
 */
export function parseNumericPrice(val) {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (!val) return null;
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Calculates median price from a list of products
 */
export function calculateMedianPrice(products = []) {
  const prices = products
    .map(p => parseNumericPrice(p?.price ?? p?.lowestPrice))
    .filter(p => p !== null && p > 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) return null;
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 !== 0 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
}

/**
 * Filters out items whose price is drastically below median when searching for devices/appliances,
 * catching mislabeled accessories (e.g. ₹299 tempered glass when median phone price is ₹70,000).
 */
export function filterByPriceSanity(products = [], query = '') {
  if (!Array.isArray(products) || products.length < 3) return products;
  if (queryHasAccessory(query)) return products;

  const median = calculateMedianPrice(products);
  if (!median || median < 1500) return products;

  // Threshold: below 18% of median price when median > 1500 is filtered out
  const minThreshold = Math.max(median * 0.18, 500);

  return products.filter(p => {
    const numPrice = parseNumericPrice(p?.price ?? p?.lowestPrice);
    if (numPrice === null) return true; // Keep items with unlisted/pending price
    return numPrice >= minThreshold;
  });
}

/**
 * Filter an array of products for search relevance
 */
export function filterRelevantProducts(products = [], query = '') {
  if (!Array.isArray(products) || !query) return products;
  const textFiltered = products.filter(p => isRelevant(p, query));
  return filterByPriceSanity(textFiltered, query);
}
