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
  'Seagate', 'Western Digital', 'TP-Link', 'Karbonn', 'Micromax', 'Lava', 'Infinix', 'Tecno',
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

function isDirectRetailerUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return !(
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host.startsWith('google.') ||
      host === 'googleadservices.com' ||
      host.endsWith('.googleadservices.com')
    );
  } catch {
    return false;
  }
}

function cleanSearchQuery(title) {
  if (!title) return '';
  return String(title)
    .replace(/:\s*5G.*$/i, '')
    .replace(/\+.*$/i, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[–—].*$/g, '')
    .replace(/\b(refurbished|renewed|pre-owned|pre-loved|used|brand new sealed|tested & verified|by cashify|by ovantica)\b/gi, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(' ');
}

function getOfficialRetailerUrl(source, title) {
  const store = String(source || '').trim();
  const query = cleanSearchQuery(title) || String(title || '').trim();
  const encodedQuery = encodeURIComponent(query);
  const lowerStore = store.toLowerCase();

  // Major Indian & Global E-Commerce Marketplaces & Stores
  if (lowerStore.includes('amazon')) {
    return `https://www.amazon.in/s?k=${encodedQuery}`;
  }
  if (lowerStore.includes('flipkart') || lowerStore.includes('shopsy')) {
    return `https://www.flipkart.com/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('croma')) {
    return `https://www.croma.com/searchB?q=${encodedQuery}`;
  }
  if (lowerStore.includes('reliance') || lowerStore.includes('digital')) {
    return `https://www.reliancedigital.in/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('myntra')) {
    return `https://www.myntra.com/${encodedQuery}`;
  }
  if (lowerStore.includes('tatacliq') || lowerStore.includes('tata cliq')) {
    return `https://www.tatacliq.com/search/?searchCategory=all&text=${encodedQuery}`;
  }
  if (lowerStore.includes('nykaa')) {
    return `https://www.nykaa.com/search/result/?q=${encodedQuery}`;
  }
  if (lowerStore.includes('blinkit')) {
    return `https://blinkit.com/s/?q=${encodedQuery}`;
  }
  if (lowerStore.includes('zepto')) {
    return `https://www.zepto.com/search?query=${encodedQuery}`;
  }
  if (lowerStore.includes('jiomart')) {
    return `https://www.jiomart.com/search/${encodedQuery}`;
  }
  if (lowerStore.includes('ajio')) {
    return `https://www.ajio.com/search/?text=${encodedQuery}`;
  }
  if (lowerStore.includes('cashify')) {
    return `https://www.cashify.in/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('vijay sales')) {
    return `https://www.vijaysales.com/search/${encodedQuery}`;
  }
  if (lowerStore.includes('firstcry')) {
    return `https://www.firstcry.com/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('tira')) {
    return `https://www.tirabeauty.com/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('ubuy')) {
    return `https://www.ubuy.co.in/search/?q=${encodedQuery}`;
  }
  if (lowerStore.includes('desertcart')) {
    return `https://www.desertcart.in/search/${encodedQuery}`;
  }
  if (lowerStore.includes('gameloot')) {
    return `https://gameloot.in/?s=${encodedQuery}&post_type=product`;
  }
  if (lowerStore.includes('vlebazaar')) {
    return `https://vlebazaar.in/index.php?route=product/search&search=${encodedQuery}`;
  }
  if (lowerStore.includes('hilaptop')) {
    return `https://hilaptop.com/?s=${encodedQuery}&post_type=product`;
  }
  if (lowerStore.includes('perfora')) {
    return `https://perfora.co/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('boat') || lowerStore.includes('boat-lifestyle')) {
    return `https://www.boat-lifestyle.com/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('noise') || lowerStore.includes('gonoise')) {
    return `https://www.gonoise.com/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('lenskart')) {
    return `https://www.lenskart.com/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('purplle')) {
    return `https://www.purplle.com/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('mamaearth')) {
    return `https://mamaearth.in/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('tradeindia')) {
    return `https://www.tradeindia.com/search.html?keyword=${encodedQuery}`;
  }
  if (lowerStore.includes('indiamart')) {
    return `https://dir.indiamart.com/search.mp?ss=${encodedQuery}`;
  }
  if (lowerStore.includes('easyphone')) {
    return `https://easyphones.in/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('grest')) {
    return `https://grest.in/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('control z')) {
    return `https://www.controlz.world/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('budli')) {
    return `https://budli.in/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('ovantica')) {
    return `https://ovantica.com/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('fonezone')) {
    return `https://fonezone.com/search?q=${encodedQuery}`;
  }
  if (lowerStore.includes('tetro')) {
    return `https://tetro.in/search?q=${encodedQuery}`;
  }

  // If the store name is a domain (e.g., "FoneZone.com", "Tetro.in", "Ovantica.com")
  if (store.includes('.')) {
    const cleanDomain = store.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
    return `https://${cleanDomain}/search?q=${encodedQuery}`;
  }

  return null;
}

function resolveProductUrl(item, query) {
  // 1. Direct retailer link from SerpApi if it's already an external store
  if (isDirectRetailerUrl(item.link)) {
    return { url: safeUrl(item.link), isDirect: true };
  }
  if (isDirectRetailerUrl(item.offer_link)) {
    return { url: safeUrl(item.offer_link), isDirect: true };
  }

  // 2. Official retailer destination website
  const officialRetailerUrl = getOfficialRetailerUrl(item.source, item.title);
  if (officialRetailerUrl) {
    return { url: officialRetailerUrl, isDirect: true };
  }

  // 3. Fallback to Google Shopping product page if no direct retailer mapping exists
  if (item.product_link) {
    const validated = safeUrl(item.product_link);
    if (validated) return { url: validated, isDirect: false };
  }

  if (item.product_id) {
    return {
      url: `https://www.google.com/search?ibp=oshop&q=${encodeURIComponent(query)}&prds=catalogid:${encodeURIComponent(item.product_id)}`,
      isDirect: false
    };
  }

  return null;
}

function normalizeProduct(item, query) {
  if (!item || !item.title) {
    return null;
  }

  const resolved = resolveProductUrl(item, query);
  if (!resolved || !resolved.url) {
    return null;
  }

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
    buyUrl: resolved.url,
    isDirectRetailer: resolved.isDirect,
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
