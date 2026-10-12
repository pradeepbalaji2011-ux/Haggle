// Provider adapter: keep provider-specific response handling in this file only.
// This uses SerpApi's Google Shopping engine; API usage may incur charges/limits.
export async function searchShopping(query) {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_shopping');
  url.searchParams.set('q', query);
  url.searchParams.set('gl', 'in');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('api_key', process.env.SERPAPI_KEY);

  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    const err = new Error(`Provider returned ${response.status}`);
    err.publicMessage = response.status === 401 || response.status === 403
      ? 'The product API key was rejected. Check SERPAPI_KEY in your .env file.'
      : 'The product provider is temporarily unavailable.';
    throw err;
  }
  const raw = await response.json();
  if (raw.error) {
    const err = new Error(raw.error);
    err.publicMessage = 'The product provider returned an error. Check your API plan and search quota.';
    throw err;
  }

  const items = (raw.shopping_results || []).map((item, index) => {
    const price = Number(item.extracted_price ?? parsePrice(item.price));
    const buyUrl = safeHttpUrl(item.product_link || item.link);
    console.log('BUY LINK CHECK:', {
  store: item.source,
  product_link: item.product_link,
  link: item.link
});
    return {
      id: String(item.product_id || `${slug(item.title)}-${index}`),
      name: item.title || 'Unnamed product',
      image: safeHttpUrl(item.thumbnail),
      price: Number.isFinite(price) ? price : null,
      currency: 'INR',
      store: item.source || 'Retailer not specified',
      buyUrl,
      rating: item.rating ?? null,
      reviews: item.reviews ?? null,
      delivery: item.delivery || null,
      condition: item.second_hand_condition || 'New/unspecified',
      sourceNote: 'Shopping search result; confirm final price and availability at retailer'
    };
  }).filter(item => item.name && item.buyUrl);

  return { query, currency: 'INR', products: items, count: items.length, provider: 'Google Shopping via SerpApi' };
}

function parsePrice(value) {
  if (typeof value !== 'string') return NaN;
  return Number(value.replace(/[^\d.]/g, ''));
}
function safeHttpUrl(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; }
  catch { return null; }
}
function slug(value = '') { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70); }
