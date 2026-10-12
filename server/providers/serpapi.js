
const API_URL = 'https://serpapi.com/search.json';

async function requestSerpApi(params) {
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

function safeRetailerUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    if (!['http:', 'https:'].includes(url.protocol)) return null;

    // Never use Google Shopping as the Buy destination.
    if (
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host.startsWith('google.')
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function parsePrice(value) {
  if (typeof value !== 'string') return NaN;
  return Number(value.replace(/[^\d.]/g, ''));
}

export async function searchShopping(query) {
  // Request 1: Find the closest matching product.
  const searchData = await requestSerpApi({
    engine: 'google_shopping',
    q: query
  });

  const product = (searchData.shopping_results || [])
    .find(item => item.product_id);

  if (!product) {
    return {
      query,
      currency: 'INR',
      products: [],
      count: 0,
      provider: 'SerpApi'
    };
  }

  // Request 2: Get retailer offers for that specific product.
  const detailData = await requestSerpApi({
    engine: 'google_product',
    product_id: product.product_id,
    offer_view: 'true'
  });

  const stores = detailData.product_results?.stores || [];

  const products = stores.map((store, index) => {
    const price = Number(
      store.extracted_price ?? parsePrice(store.price)
    );

    return {
      id: `${product.product_id}-${index}`,
      name: product.title || query,
      image: safeRetailerUrl(product.thumbnail),
      price: Number.isFinite(price) ? price : null,
      currency: 'INR',
      store: store.name || 'Retailer',
      buyUrl: safeRetailerUrl(store.link),
      rating: store.rating ?? null,
      reviews: store.reviews ?? null,
      delivery: store.delivery || null,
      condition: 'New/unspecified',
      sourceNote: 'Verify the final price and availability at the retailer'
    };
  }).filter(item => item.buyUrl);

  return {
    query,
    currency: 'INR',
    products,
    count: products.length,
    provider: 'Google Product API via SerpApi'
  };
}
