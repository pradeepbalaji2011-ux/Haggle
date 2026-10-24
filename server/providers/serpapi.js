/**
 * server/providers/serpapi.js — SerpApi Google Shopping & Google Product Adapter
 *
 * Fetches real shopping data from SerpApi.
 * Strictly avoids generating fake homepage/search links.
 * All outbound links must unwrap to real, direct product pages on the Top 20 Indian platforms.
 */

import { validateAndCleanBuyUrl, unwrapTrackingUrl } from '../links.js';
import { TOP_PLATFORMS, TOTAL_PLATFORMS, matchPlatform } from '../platforms.js';
import { getPriceHistory, recordPrices, getFormattedPriceHistory } from '../db.js';

const API_URL = 'https://serpapi.com/search.json';
const MAX_RESULTS = 40;

const KNOWN_BRANDS = [
  'Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Redmi', 'POCO', 'Realme', 'Oppo', 'Vivo',
  'Motorola', 'Google', 'Nothing', 'Sony', 'LG', 'HP', 'Dell', 'Lenovo', 'Acer', 'Asus',
  'MSI', 'Intel', 'AMD', 'Canon', 'Nikon', 'Bose', 'JBL', 'boAt', 'Boat', 'Noise',
  'Fire-Boltt', 'Zebronics', 'Portronics', 'Boult', 'Philips', 'Logitech', 'SanDisk',
  'Seagate', 'Western Digital', 'TP-Link', 'Karbonn', 'Micromax', 'Lava', 'Infinix', 'Tecno',
  'Colgate', 'Oral-B', 'Sensodyne', 'Perfora', 'Agaro', 'Dabur', 'Patanjali', 'Pepsodent',
  'Closeup', 'Nivea', 'Dove', 'Pears', 'Lux', 'Lifebuoy', 'Dettol', 'Himalaya', 'Mamaearth',
  'WOW', 'Garnier', "L'Oreal", "L'Oréal", "Pond's", 'Gillette', 'Beardo', 'Head & Shoulders',
  'Pantene', 'Sunsilk', 'Tresemme', 'Parachute', 'Vaseline', 'Amul', 'Nestle', 'Nestlé',
  'Britannia', 'Parle', 'ITC', 'Aashirvaad', 'Tata', 'Fortune', 'Saffola', 'Cadbury',
  'Whirlpool', 'Bosch', 'Haier', 'Godrej', 'IFB', 'Voltas', 'Blue Star', 'Daikin',
  'Panasonic', 'Bajaj', 'Havells', 'Crompton', 'Orient', 'Usha', 'Prestige', 'Butterfly',
  'Pigeon', 'Hawkins', 'Milton', 'Cello', 'Borosil', 'Wonderchef', 'Kent', 'Aquaguard',
  'Dyson', 'Morphy Richards', 'Lifelong',
  'Nike', 'Adidas', 'Puma', 'Reebok', 'Skechers', 'Under Armour', 'Asics', 'Woodland',
  'Bata', 'Sparx', 'Campus', 'Crocs', "Levi's", 'Pepe Jeans', 'Zara', 'H&M', 'Allen Solly',
  'Van Heusen', 'Peter England', 'Louis Philippe', 'Raymond', 'Fastrack', 'Titan', 'Casio'
];

async function requestSerpApi(params) {
  if (!process.env.SERPAPI_KEY || process.env.SERPAPI_KEY === 'put_your_api_key_here') {
    const error = new Error('SERPAPI_KEY is not configured in .env');
    error.publicMessage = 'Live product search is not configured yet. Add your SerpApi key to .env.';
    throw error;
  }

  const url = new URL(API_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  url.searchParams.set('gl', 'in');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('api_key', process.env.SERPAPI_KEY);

  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000)
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const error = new Error(data.error || 'SerpApi request failed.');
    error.publicMessage = 'Product search failed. Check your SerpApi key, quota, and API access.';
    throw error;
  }

  return data;
}

function parsePrice(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;

  const match = value.replace(/,/g, '').match(/[\d]+(?:\.\d+)?/);
  if (!match) return null;

  const price = Number(match[0]);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function getPrice(item) {
  const value = item.extracted_price;
  if (value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return parsePrice(item.price);
}

function detectBrand(title, explicitBrand) {
  if (typeof explicitBrand === 'string' && explicitBrand.trim()) {
    return explicitBrand.trim();
  }
  const text = String(title || '').trim();
  if (!text) return 'Other / Unknown';

  const lowerText = text.toLowerCase();
  const sorted = [...KNOWN_BRANDS].sort((a, b) => b.length - a.length);

  for (const brand of sorted) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    if (regex.test(lowerText)) {
      return brand;
    }
  }

  return 'Other / Unknown';
}

/**
 * Normalizes an item from Google Shopping response
 */
function normalizeShoppingItem(item) {
  if (!item || !item.title) return null;

  // Only use actual store links (link / offer_link) for URL validation.
  // product_link is a Google internal URL (google.com/search?ibp=oshop&...)
  // and must NOT be fed into validateAndCleanBuyUrl.
  const directUrl = item.link || item.offer_link;

  let buyUrl = null;
  let storeName = item.source || 'Unknown';
  let platform = null;
  let badgeColor = '#059669';

  if (directUrl) {
    // We have an actual store link – validate it
    const linkCheck = validateAndCleanBuyUrl(directUrl, item.source);
    if (linkCheck.valid && linkCheck.cleanUrl) {
      buyUrl = linkCheck.cleanUrl;
      storeName = linkCheck.storeName || storeName;
      platform = linkCheck.platform || null;
      badgeColor = linkCheck.badgeColor || badgeColor;
    } else {
      // Direct URL exists but failed validation (wrong domain, homepage, etc.)
      // Still try matching by source name for display purposes
      platform = matchPlatform(null, item.source);
      if (!platform) return null; // Not a Top 20 platform, drop it
      storeName = platform.name;
      badgeColor = platform.badgeColor || badgeColor;
    }
  } else {
    // No direct store URL – match the source name against Top 20 platforms
    platform = matchPlatform(null, item.source);
    if (!platform) return null; // Not a Top 20 platform, drop it
    storeName = platform.name;
    badgeColor = platform.badgeColor || badgeColor;
  }

  const price = getPrice(item);
  const image = item.thumbnail || item.serpapi_thumbnail || null;
  const brand = detectBrand(item.title, item.brand);

  return {
    id: String(item.product_id || `${item.position || 'item'}-${item.title}-${storeName}`),
    productId: item.product_id ? String(item.product_id) : null,
    pageToken: item.immersive_product_page_token || null,
    name: item.title,
    brand,
    image,
    price,
    currency: 'INR',
    store: storeName,
    platformId: platform?.id || null,
    badgeColor,
    buyUrl,
    rating: item.rating != null ? Number(item.rating) : null,
    reviews: item.reviews != null ? Number(item.reviews) : null,
    delivery: item.delivery || null,
    inStock: true
  };
}

/**
 * Search Google Shopping via SerpApi
 */
export async function searchShopping(query) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) {
    return {
      query: cleanQuery,
      currency: 'INR',
      products: [],
      count: 0,
      provider: 'Google Shopping via SerpApi'
    };
  }

  const searchData = await requestSerpApi({
    engine: 'google_shopping',
    q: cleanQuery
  });

  const results = (searchData.shopping_results || []).slice(0, MAX_RESULTS);
  const products = [];
  const seenIds = new Set();

  for (const item of results) {
    const norm = normalizeShoppingItem(item);
    if (norm) {
      products.push(norm);
      if (norm.productId) seenIds.add(norm.productId);
      seenIds.add(norm.name.toLowerCase());
    }
  }

  // If initial search didn't yield enough verified Top 20 marketplace offers,
  // query with major platform qualifiers (e.g. amazon.in, flipkart) so verified consumer products are found
  if (products.length < 3) {
    const enrichmentQueries = [`${cleanQuery} amazon.in`, `${cleanQuery} flipkart`];
    for (const eq of enrichmentQueries) {
      try {
        const enrichedData = await requestSerpApi({
          engine: 'google_shopping',
          q: eq
        });
        const enrichedResults = enrichedData.shopping_results || [];
        for (const item of enrichedResults) {
          const norm = normalizeShoppingItem(item);
          if (norm) {
            const key = norm.name.toLowerCase();
            if (!seenIds.has(key) && (!norm.productId || !seenIds.has(norm.productId))) {
              products.push(norm);
              if (norm.productId) seenIds.add(norm.productId);
              seenIds.add(key);
            }
          }
        }
        if (products.length >= 6) break;
      } catch {}
    }
  }

  if (products.length > 0) {
    recordPrices(products).catch(() => {});
  }

  return {
    query: cleanQuery,
    currency: 'INR',
    products,
    count: products.length,
    provider: 'Google Shopping via SerpApi'
  };
}

/**
 * Fetch product offers and multi-seller pricing for a specific product ID
 */
export async function getProductOffers(productId) {
  const cleanId = String(productId || '').trim();
  if (!cleanId) {
    return { productId: '', productTitle: null, stores: [] };
  }

  const detailData = await requestSerpApi({
    engine: 'google_product',
    product_id: cleanId,
    offer_view: 'true'
  });

  const rawStores = detailData.product_results?.stores || [];
  const stores = [];

  for (let i = 0; i < rawStores.length; i++) {
    const s = rawStores[i];
    const linkCheck = validateAndCleanBuyUrl(s.link, s.name);
    if (!linkCheck.valid || !linkCheck.cleanUrl) continue;

    const price = s.extracted_price ?? parsePrice(s.price);

    stores.push({
      id: `${cleanId}-store-${i}`,
      store: linkCheck.storeName,
      platformId: linkCheck.platform?.id,
      badgeColor: linkCheck.badgeColor,
      title: s.title || detailData.product_results?.title || 'Product Offer',
      price: Number.isFinite(price) ? price : null,
      currency: 'INR',
      buyUrl: linkCheck.cleanUrl,
      delivery: s.delivery || s.details_and_offers?.[0] || 'Standard delivery',
      rating: s.rating != null ? Number(s.rating) : null,
      reviews: s.reviews != null ? Number(s.reviews) : null,
      inStock: s.out_of_stock ? false : true
    });
  }

  stores.sort((a, b) => {
    if (a.price === null && b.price === null) return 0;
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return a.price - b.price;
  });

  return {
    productId: cleanId,
    productTitle: detailData.product_results?.title || null,
    stores
  };
}

/**
 * Full Product Detail with store comparison, Top 20 platform note, and price history.
 *
 * Resolution strategy (in order):
 * 1. google_immersive_product via pageToken → returns real store links (amazon.in, flipkart, etc.)
 * 2. google_product via product_id → returns seller offers (often small stores)
 * 3. Fallback search using the product title
 * 4. Single-offer fallback from the search result card data passed via options
 */
export async function getProductDetail(productId, options = {}) {
  const cleanId = String(productId || '').trim();
  const searchTitle = options.title || cleanId;
  const stores = [];
  let detailData = null;

  // ─── Strategy 1: Immersive Product API (best source for Top 20 store links) ───
  if (options.pageToken) {
    try {
      const immersiveData = await requestSerpApi({
        engine: 'google_immersive_product',
        page_token: options.pageToken
      });

      if (immersiveData?.product_results) {
        detailData = immersiveData;
      }

      const immersiveStores = immersiveData?.product_results?.stores || [];
      for (let i = 0; i < immersiveStores.length; i++) {
        const s = immersiveStores[i];
        if (!s.link) continue;

        const linkCheck = validateAndCleanBuyUrl(s.link, s.name);
        if (!linkCheck.valid || !linkCheck.cleanUrl) continue;

        const price = s.extracted_price ?? parsePrice(s.price);
        stores.push({
          id: `${cleanId}-imm-${i}`,
          store: linkCheck.storeName,
          platformId: linkCheck.platform?.id,
          badgeColor: linkCheck.badgeColor,
          title: s.title || searchTitle,
          price: Number.isFinite(price) ? price : null,
          currency: 'INR',
          buyUrl: linkCheck.cleanUrl,
          delivery: s.shipping === 'Free' ? 'Free delivery' : (s.details_and_offers?.[0] || 'Standard delivery'),
          rating: s.rating != null ? Number(s.rating) : null,
          reviews: s.reviews != null ? Number(s.reviews) : null,
          inStock: !(s.out_of_stock)
        });
      }
    } catch (e) {
      console.error('Immersive product API error:', e.message);
    }
  }

  // ─── Strategy 2: Google Product API (if we have a numeric product_id) ───
  if (stores.length === 0 && cleanId && /^\d+$/.test(cleanId)) {
    try {
      detailData = await requestSerpApi({
        engine: 'google_product',
        product_id: cleanId,
        offer_view: 'true'
      });

      const rawStores = detailData?.product_results?.stores || [];
      for (let i = 0; i < rawStores.length; i++) {
        const s = rawStores[i];
        if (!s.link) continue;

        const linkCheck = validateAndCleanBuyUrl(s.link, s.name);
        if (!linkCheck.valid || !linkCheck.cleanUrl) continue;

        const price = s.extracted_price ?? parsePrice(s.price);
        stores.push({
          id: `${cleanId}-store-${i}`,
          store: linkCheck.storeName,
          platformId: linkCheck.platform?.id,
          badgeColor: linkCheck.badgeColor,
          title: s.title || detailData?.product_results?.title || searchTitle,
          price: Number.isFinite(price) ? price : null,
          currency: 'INR',
          buyUrl: linkCheck.cleanUrl,
          delivery: s.delivery || s.details_and_offers?.[0] || 'Standard delivery',
          rating: s.rating != null ? Number(s.rating) : null,
          reviews: s.reviews != null ? Number(s.reviews) : null,
          inStock: !(s.out_of_stock)
        });
      }
    } catch {
      detailData = null;
    }
  }

  // ─── Strategy 3: Direct verified card offer (if card had a valid buyUrl) ───
  if (stores.length === 0 && options.buyUrl) {
    const linkCheck = validateAndCleanBuyUrl(options.buyUrl, options.store);
    if (linkCheck.valid && linkCheck.cleanUrl) {
      const numPrice = options.price ? Number(String(options.price).replace(/[^\d.]/g, '')) : null;
      stores.push({
        id: `${cleanId}-direct`,
        store: linkCheck.storeName,
        platformId: linkCheck.platform?.id,
        badgeColor: linkCheck.badgeColor,
        title: searchTitle,
        price: Number.isFinite(numPrice) ? numPrice : null,
        currency: 'INR',
        buyUrl: linkCheck.cleanUrl,
        delivery: options.delivery || 'Official retailer dispatch',
        rating: options.rating != null ? Number(options.rating) : null,
        reviews: options.reviews != null ? Number(options.reviews) : null,
        inStock: true
      });
    }
  }

  // ─── Strategy 4: Fallback search by title ───
  if (stores.length === 0 && searchTitle) {
    try {
      const res = await searchShopping(searchTitle);
      const fallbackProducts = res.products || [];

      // If any fallback product has a pageToken, try resolving real store links from it
      const productWithToken = fallbackProducts.find(p => p.pageToken);
      if (productWithToken && productWithToken.pageToken) {
        try {
          const immData = await requestSerpApi({
            engine: 'google_immersive_product',
            page_token: productWithToken.pageToken
          });
          if (immData?.product_results) {
            detailData = immData;
          }
          const immStores = immData?.product_results?.stores || [];
          for (let i = 0; i < immStores.length; i++) {
            const s = immStores[i];
            if (!s.link) continue;
            const linkCheck = validateAndCleanBuyUrl(s.link, s.name);
            if (!linkCheck.valid || !linkCheck.cleanUrl) continue;
            const price = s.extracted_price ?? parsePrice(s.price);
            stores.push({
              id: `${cleanId}-imm-fb-${i}`,
              store: linkCheck.storeName,
              platformId: linkCheck.platform?.id,
              badgeColor: linkCheck.badgeColor,
              title: s.title || searchTitle,
              price: Number.isFinite(price) ? price : null,
              currency: 'INR',
              buyUrl: linkCheck.cleanUrl,
              delivery: s.shipping === 'Free' ? 'Free delivery' : (s.details_and_offers?.[0] || 'Standard delivery'),
              rating: s.rating != null ? Number(s.rating) : null,
              reviews: s.reviews != null ? Number(s.reviews) : null,
              inStock: !(s.out_of_stock)
            });
          }
        } catch {}
      }

      // If still empty, add products from search Shopping
      if (stores.length === 0) {
        for (let i = 0; i < fallbackProducts.length; i++) {
          const p = fallbackProducts[i];
          const platform = p.platformId ? matchPlatform(null, p.store) : null;
          stores.push({
            id: `${cleanId}-fb-${i}`,
            store: p.store || 'Unknown',
            platformId: p.platformId || platform?.id || null,
            badgeColor: p.badgeColor || platform?.badgeColor || '#059669',
            title: p.name || searchTitle,
            price: p.price,
            currency: 'INR',
            buyUrl: p.buyUrl || null,
            delivery: p.delivery || 'Standard shipping',
            rating: p.rating,
            reviews: p.reviews,
            inStock: Boolean(p.buyUrl)
          });
        }
      }
    } catch {}
  }

  // ─── Strategy 4: Single offer from the card's own data ───
  if (stores.length === 0 && (options.price || options.store || options.buyUrl)) {
    let cleanBuyUrl = null;
    let platform = null;

    if (options.buyUrl) {
      const linkCheck = validateAndCleanBuyUrl(options.buyUrl, options.store);
      if (linkCheck.valid && linkCheck.cleanUrl) {
        cleanBuyUrl = linkCheck.cleanUrl;
        platform = linkCheck.platform;
      }
    }

    if (!platform && options.store) {
      platform = matchPlatform(null, options.store);
    }

    const numPrice = options.price ? Number(String(options.price).replace(/[^\d.]/g, '')) : null;
    stores.push({
      id: `${cleanId}-initial`,
      store: platform?.name || options.store || 'Retailer',
      platformId: platform?.id || null,
      badgeColor: platform?.badgeColor || '#059669',
      title: searchTitle,
      price: Number.isFinite(numPrice) ? numPrice : null,
      currency: 'INR',
      buyUrl: cleanBuyUrl || options.buyUrl || null,
      delivery: options.delivery || 'Official retailer dispatch',
      rating: options.rating != null ? Number(options.rating) : null,
      reviews: options.reviews != null ? Number(options.reviews) : null,
      inStock: true
    });
  }

  // Sort stores: lowest price first
  stores.sort((a, b) => {
    if (a.price === null && b.price === null) return 0;
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return a.price - b.price;
  });

  const pr = detailData?.product_results || {};
  const finalTitle = pr.title || options.title || searchTitle || 'Product Details';
  const brand = detectBrand(finalTitle, pr.brand || options.brand);

  const validPrices = stores.map(s => s.price).filter(p => Number.isFinite(p) && p > 0);
  const lowestPrice = validPrices.length > 0
    ? Math.min(...validPrices)
    : (options.price ? Number(String(options.price).replace(/[^\d.]/g, '')) : null);
  const highestPrice = validPrices.length > 0 ? Math.max(...validPrices) : lowestPrice;
  const avgPrice = validPrices.length > 0
    ? Math.round(validPrices.reduce((sum, p) => sum + p, 0) / validPrices.length)
    : lowestPrice;
  const savings = (lowestPrice && highestPrice && highestPrice > lowestPrice) ? (highestPrice - lowestPrice) : 0;

  // Number of distinct Top 20 platforms compared
  const uniquePlatforms = new Set(stores.map(s => s.store));
  const comparedCount = uniquePlatforms.size;

  let thumbnails = Array.isArray(pr.thumbnails) && pr.thumbnails.length > 0
    ? pr.thumbnails.filter(t => typeof t === 'string' && t.startsWith('http'))
    : [];
  if (thumbnails.length === 0 && options.image) {
    thumbnails = [options.image];
  }

  const priceHistory = await getFormattedPriceHistory(finalTitle, 200);

  if (stores.length > 0) {
    recordPrices(
      stores
        .filter(s => s.price && Number.isFinite(s.price))
        .map(s => ({
          productId: cleanId,
          name: finalTitle,
          store: s.store,
          price: s.price,
          currency: 'INR'
        }))
    ).catch(() => {});
  }

  return {
    productId: cleanId,
    title: finalTitle,
    brand,
    description: pr.about_the_product?.description || `${finalTitle} with live multi-platform price comparison across verified Indian retailers.`,
    features: pr.about_the_product?.features || pr.product_attributes || [
      { title: 'Brand', value: brand },
      { title: 'Product Name', value: finalTitle },
      { title: 'Warranty', value: 'Manufacturer warranty applicable at checkout' }
    ],
    thumbnails,
    lowestPrice,
    highestPrice,
    avgPrice,
    savings,
    currency: 'INR',
    rating: pr.rating != null ? Number(pr.rating) : (options.rating != null ? Number(options.rating) : null),
    reviewsCount: pr.reviews != null ? Number(pr.reviews) : (options.reviews != null ? Number(options.reviews) : null),
    stores,
    comparedCount,
    totalPlatforms: comparedCount,
    comparedPlatformsNote: `Compared across ${comparedCount} platform${comparedCount === 1 ? '' : 's'}`,
    priceHistory,
    availabilityStatus: stores.length > 0 ? 'AVAILABLE' : 'Currently not available on any platform'
  };
}
