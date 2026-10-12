

import { searchProducts } from './api.js';
import { productCard } from './product-card.js';

const form = document.querySelector('#search-form');
const input = document.querySelector('#query');
const results = document.querySelector('#results');
const status = document.querySelector('#status');
const title = document.querySelector('#results-title');
const refresh = document.querySelector('#refresh');
const priceSort = document.querySelector('#price-sort');
const retailerFilter = document.querySelector('#retailer-filter');
const minPriceInput = document.querySelector('#min-price');
const maxPriceInput = document.querySelector('#max-price');
const applyFilters = document.querySelector('#apply-filters');
const clearFilters = document.querySelector('#clear-filters');

let lastQuery = '';
let requestNumber = 0;
let currentProducts = [];

function showMessage(message) {
  results.innerHTML = `<div class="notice">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function validPrice(product) {
  if (product.price === null || product.price === undefined ||
      product.price === '') {
    return null;
  }

  const price = Number(product.price);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function updateRetailers() {
  const selected = retailerFilter.value;
  const retailers = [...new Set(
    currentProducts.map(product => product.store || 'Retailer')
  )].sort((a, b) => a.localeCompare(b));

  retailerFilter.replaceChildren();

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All retailers';
  retailerFilter.appendChild(allOption);

  retailers.forEach(store => {
    const option = document.createElement('option');
    option.value = store;
    option.textContent = store;
    retailerFilter.appendChild(option);
  });

  retailerFilter.value = retailers.includes(selected) ? selected : 'all';
}

function renderProducts() {
  const minText = minPriceInput.value.trim();
  const maxText = maxPriceInput.value.trim();
  const minPrice = minText === '' ? null : Number(minText);
  const maxPrice = maxText === '' ? null : Number(maxText);

  if (minPrice !== null && (!Number.isFinite(minPrice) || minPrice < 0)) {
    showMessage('Enter a valid minimum price of ₹0 or more.');
    return;
  }

  if (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
    showMessage('Enter a valid maximum price of ₹0 or more.');
    return;
  }

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    showMessage('Minimum price cannot be greater than maximum price.');
    return;
  }

  let products = currentProducts.filter(product => {
    const price = validPrice(product);
    const store = product.store || 'Retailer';

    if (retailerFilter.value !== 'all' &&
        store !== retailerFilter.value) {
      return false;
    }

    // Keep offers with unavailable prices when no price
    // range is specified. Exclude them when filtering by price.
    if ((minPrice !== null || maxPrice !== null) && price === null) {
      return false;
    }

    if (minPrice !== null && price < minPrice) return false;
    if (maxPrice !== null && price > maxPrice) return false;

    return true;
  });

  const sortMode = priceSort.value;

  if (sortMode === 'ascending') {
    products.sort((a, b) => {
      const priceA = validPrice(a);
      const priceB = validPrice(b);

      if (priceA === null && priceB === null) return 0;
      if (priceA === null) return 1;
      if (priceB === null) return -1;
      return priceA - priceB;
    });
  } else if (sortMode === 'descending') {
    products.sort((a, b) => {
      const priceA = validPrice(a);
      const priceB = validPrice(b);

      if (priceA === null && priceB === null) return 0;
      if (priceA === null) return 1;
      if (priceB === null) return -1;
      return priceB - priceA;
    });
  }

  if (!products.length) {
    showMessage('No offers match these filters. Try another price range or retailer.');
    return;
  }

  // Calculate badges and savings among the currently visible offers.
  const prices = products
    .map(validPrice)
    .filter(price => price !== null);

  const lowestPrice = prices.length ? Math.min(...prices) : null;
  const highestPrice = prices.length ? Math.max(...prices) : null;

  results.innerHTML = products.map(product => {
    const price = validPrice(product);
    const savings = price !== null && highestPrice !== null
      ? Math.max(0, highestPrice - price)
      : 0;

    return productCard(product, {
      isLowestPrice: price !== null && price === lowestPrice,
      savings
    });
  }).join('');
}

async function runSearch(query) {
  const trimmed = query.trim();
  if (!trimmed) return;

  lastQuery = trimmed;
  const currentRequest = ++requestNumber;

  title.textContent = `Offers for “${trimmed}”`;
  status.textContent = 'Checking current offers…';
  refresh.disabled = true;
  showMessage('Loading product images and prices…');

  try {
    const data = await searchProducts(trimmed);

    if (currentRequest !== requestNumber) return;

    currentProducts = data.products || [];
    updateRetailers();

    if (currentProducts.length) {
      renderProducts();
    } else {
      showMessage(
        'No offers were returned for this search. Try a more specific product name.'
      );
    }

    const time = data.updatedAt
      ? new Date(data.updatedAt).toLocaleTimeString()
      : '';

    status.textContent =
      `${data.count || 0} offers returned · ${data.provider || 'Product provider'}` +
      `${time ? ` · checked ${time}` : ''}` +
      `${data.cached ? ' · cached result' : ''}`;
  } catch (error) {
    if (currentRequest !== requestNumber) return;

    currentProducts = [];
    updateRetailers();
    showMessage(error.message);
    status.textContent = 'Search could not be completed.';
  } finally {
    if (currentRequest === requestNumber) {
      refresh.disabled = !lastQuery;
    }
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  runSearch(input.value);
});

refresh.addEventListener('click', () => {
  if (lastQuery) runSearch(lastQuery);
});

priceSort.addEventListener('change', renderProducts);
retailerFilter.addEventListener('change', renderProducts);
applyFilters.addEventListener('click', renderProducts);

clearFilters.addEventListener('click', () => {
  minPriceInput.value = '';
  maxPriceInput.value = '';
  retailerFilter.value = 'all';
  priceSort.value = 'default';
  renderProducts();
});
