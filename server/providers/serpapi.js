
const API_URL = 'https://serpapi.com/search.json';

// Maximum listings processed from one Google Shopping response.
const MAX_RESULTS = 40;

// Known brand dictionary to extract and normalize brands across common categories
const KNOWN_BRANDS = [
  // Tech & Electronics
  'Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Redmi', 'POCO', 'Realme', 'Oppo', 'Vivo',
  'Motorola', 'Google', 'Nothing', 'Sony', 'LG', 'HP', 'Dell', 'Lenovo', 'Acer', 'Asus',
  'MSI', 'Intel', 'AMD', 'Canon', 'Nikon', 'Bose', 'JBL', 'boAt', 'Boat', 'Noise',
  'Fire-Boltt', 'Zebronics', 'Portronics', 'Boult', 'Philips', 'Logitech', 'SanDisk',
  'Seagate', 'Western Digital', 'TP-Link',
  // Personal Care & Groceries
  'Colgate', 'Oral-B', 'Sensodyne', 'Perfora', 'Agaro', 'Dabur', 'Patanjali', 'Pepsodent',
  'Closeup', 'Nivea', 'Dove', 'Pears', 'Lux', 'Lifebuoy', 'Dettol', 'Himalaya', 'Mamaearth',
  'WOW', 'Garnier', "L'Oreal", "L'Oréal", "Pond's", 'Gillette', 'Beardo', 'Head & Shoulders',
  'Pantene', 'Sunsilk', 'Tresemme', 'Parachute', 'Vaseline', 'Amul', 'Nestle', 'Nestlé',
  'Britannia', 'Parle', 'ITC', 'Aashirvaad', 'Tata', 'Fortune', 'Saffola', 'Cadbury',
  // Home, Kitchen & Appliances
  'Whirlpool', 'Bosch', 'Haier', 'Godrej', 'IFB', 'Voltas', 'Blue Star', 'Daikin',
  'Panasonic', 'Bajaj', 'Havells', 'Crompton', 'Orient', 'Usha', 'Prestige', 'Butterfly',
  'Pigeon', 'Hawkins', 'Milton', 'Cello', 'Borosil', 'Wonderchef', 'Kent', 'Aquaguard',
  'Dyson', 'Morphy Richards', 'Lifelong', 'Beco',
  // Fashion & Footwear
  'Nike', 'Adidas', 'Puma', 'Reebok', 'Skechers', 'Under Armour', 'Asics', 'Woodland',
  'Bata', 'Sparx', 'Campus', 'Crocs', "Levi's", 'Pepe Jeans', 'Zara', 'H&M', 'Allen Solly',
  'Van Heusen', 'Peter England', 'Louis Philippe', 'Raymond', 'Fastrack', 'Titan', 'Casio',
  // Tools, Toys & Baby
  'Stanley', 'Black+Decker', 'Dewalt', 'Makita', 'Taparia', 'LEGO', 'Fisher-Price',
  'Hot Wheels', 'Barbie', 'Pampers', 'MamyPoko', 'Huggies'
];

async function requestSerpApi(params) {
  if (!process.env.SERPAPI_KEY) {
    throw new Error('SERPAPI_KEY is not configured.');
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
    error.publicMessage =
      'Product search failed. Check your SerpApi key, quota, and API access.';
    throw error;
  }

  return data;
}

function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function parsePrice(value) {
  if (typeof value !== 'string') return null;

  const match = value.replace(/,/g, '').match(/[\d]+(?:\.\d+)?/);
  if (!match) return null;

  const price = Number(match[0]);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function getPrice(item) {
  const value = item.extracted_price;

  if (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isFinite(Number(value))
  ) {
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

function resolveProductUrl(item, query) {
  // 1. Direct retailer link if SerpApi provides it
  if (item.link) {
    const validated = safeUrl(item.link);
    if (validated) return validated;
  }

  if (item.offer_link) {
    const validated = safeUrl(item.offer_link);
    if (validated) return validated;
  }

  // 2. Google Shopping product page link (which provides merchant offers & direct buy buttons)
  if (item.product_link) {
    const validated = safeUrl(item.product_link);
    if (validated) return validated;
  }

  // 3. Fallback construct if product_id is available
  if (item.product_id) {
    return `https://www.google.com/search?ibp=oshop&q=${encodeURIComponent(query)}&prds=catalogid:${encodeURIComponent(item.product_id)}`;
  }

  return null;
}

function normalizeProduct(item, query) {
  if (!item || !item.title) {
    return null;
  }

  const buyUrl = resolveProductUrl(item, query);
  if (!buyUrl) {
    return null;
  }

  // Images can be Google/gstatic thumbnails or SerpApi-hosted thumbnails
  const image = safeUrl(item.thumbnail || item.serpapi_thumbnail);

  const brand = detectBrand(
    item.title,
    item.brand || item.brand_name || item.manufacturer
  );

  return {
    id: String(
      item.product_id ||
      `${item.position || 'item'}-${item.title}-${item.source || ''}`
    ),
    productId: item.product_id ? String(item.product_id) : null,
    hasMultipleOffers: Boolean(item.multiple_sources || item.product_id),
    name: item.title,
    brand,
    image,
    price: getPrice(item),
    currency: 'INR',
    store: item.source || 'Retailer',
    buyUrl,
    rating: item.rating ?? null,
    reviews: item.reviews ?? null,
    delivery: item.delivery || null,
    condition: item.second_hand_condition || 'New/unspecified',
    sourceNote: 'Verify the final price and availability at the retailer'
  };
}

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

  const seen = new Set();
  const products = [];

  for (const item of results) {
    const product = normalizeProduct(item, cleanQuery);

    if (!product) continue;

    // Deduplicate identical product offers
    const key = `${product.name.toLowerCase()}|${product.store.toLowerCase()}|${product.price}`;

    if (seen.has(key)) continue;

    seen.add(key);
    products.push(product);
  }

  return {
    query: cleanQuery,
    currency: 'INR',
    products,
    count: products.length,
    provider: 'Google Shopping via SerpApi'
  };
}

export async function getProductOffers(productId) {
  const cleanId = String(productId || '').trim();

  if (!cleanId) {
    return {
      productId: '',
      productTitle: null,
      stores: []
    };
  }

  const detailData = await requestSerpApi({
    engine: 'google_product',
    product_id: cleanId,
    offer_view: 'true'
  });

  const rawStores = detailData.product_results?.stores || [];

  const stores = rawStores
    .map((store, index) => {
      const price = store.extracted_price ?? parsePrice(store.price);
      const buyUrl = safeUrl(store.link);

      return {
        id: `${cleanId}-store-${index}`,
        store: store.name || 'Retailer',
        price: Number.isFinite(price) ? price : null,
        currency: 'INR',
        buyUrl,
        delivery: store.delivery || null,
        rating: store.rating ?? null,
        reviews: store.reviews ?? null
      };
    })
    .filter(item => item.buyUrl);

  // Sort stores from lowest price to highest price
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
