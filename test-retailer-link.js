
import 'dotenv/config';

const apiKey = process.env.SERPAPI_KEY;

if (!apiKey || apiKey === 'put_your_api_key_here') {
  console.log('API key missing. Check your .env file.');
  process.exit(1);
}

async function testRetailerLink() {
  // Request 1: Find one product.
  const searchUrl = new URL('https://serpapi.com/search.json');
  searchUrl.searchParams.set('engine', 'google_shopping');
  searchUrl.searchParams.set('q', 'Samsung Galaxy S25');
  searchUrl.searchParams.set('gl', 'in');
  searchUrl.searchParams.set('hl', 'en');
  searchUrl.searchParams.set('api_key', apiKey);

  const searchResponse = await fetch(searchUrl);
  const searchData = await searchResponse.json();

  if (!searchResponse.ok || searchData.error) {
    throw new Error(searchData.error || 'Shopping search failed.');
  }

  const product = (searchData.shopping_results || [])
    .find(item => item.product_id);

  if (!product) {
    console.log('No product ID was returned.');
    return;
  }

  console.log('\nPRODUCT:', product.title);
  console.log('PRODUCT ID:', product.product_id);

  // Request 2: Get offers for that product.
  const productUrl = new URL('https://serpapi.com/search.json');
  productUrl.searchParams.set('engine', 'google_product');
  productUrl.searchParams.set('product_id', product.product_id);
  productUrl.searchParams.set('offer_view', 'true');
  productUrl.searchParams.set('gl', 'in');
  productUrl.searchParams.set('hl', 'en');
  productUrl.searchParams.set('api_key', apiKey);

  const productResponse = await fetch(productUrl);
  const productData = await productResponse.json();

  if (!productResponse.ok || productData.error) {
    throw new Error(productData.error || 'Product lookup failed.');
  }

  const stores = productData.product_results?.stores || [];

  console.log('\nRETAILER OFFERS:');

  for (const store of stores) {
    console.log('\nStore:', store.name);
    console.log('Price:', store.price ?? 'Not provided');
    console.log('Direct link:', store.link ?? 'No link returned');
  }

  if (stores.length === 0) {
    console.log('No retailer offers were returned for this product.');
  }
}

testRetailerLink().catch(error => {
  console.error('Test failed:', error.message);
});
