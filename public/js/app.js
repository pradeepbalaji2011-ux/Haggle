import { searchProducts, compareOffers } from './api.js';
import { productCard } from './product-card.js';
import { CONFIG } from './config.js';

const form = document.querySelector('#search-form');
const input = document.querySelector('#query');
const results = document.querySelector('#results');
const status = document.querySelector('#status');
const title = document.querySelector('#results-title');
const refresh = document.querySelector('#refresh');
const priceSort = document.querySelector('#price-sort');
const retailerFilter = document.querySelector('#retailer-filter');
const brandFilter = document.querySelector('#brand-filter');
const minPriceInput = document.querySelector('#min-price');
const maxPriceInput = document.querySelector('#max-price');
const applyFilters = document.querySelector('#apply-filters');
const clearFilters = document.querySelector('#clear-filters');

// Modal elements
const compareModal = document.querySelector('#compare-modal');
const modalClose = document.querySelector('#modal-close');
const modalBackdrop = document.querySelector('#modal-backdrop');
const modalTitle = document.querySelector('#modal-title');
const modalBody = document.querySelector('#modal-body');

let lastQuery = '';
let requestNumber = 0;
let currentProducts = [];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function money(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return 'Price unavailable';
  }
  return new Intl.NumberFormat(CONFIG.locale, {
    style: 'currency',
    currency: CONFIG.currency,
    maximumFractionDigits: 0
  }).format(Number(value));
}

function showMessage(message) {
  results.innerHTML = `<div class="notice">${escapeHtml(message)}</div>`;
}

function validPrice(product) {
  if (product.price === null || product.price === undefined || product.price === '') {
    return null;
  }
  const price = Number(product.price);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function getBrand(product) {
  if (product.brand && typeof product.brand === 'string' && product.brand.trim()) {
    return product.brand.trim();
  }
  return 'Other / Unknown';
}

function updateRetailers() {
  if (!retailerFilter) return;

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

function updateBrands() {
  if (!brandFilter) return;

  const selected = brandFilter.value;
  const brands = [...new Set(
    currentProducts.map(getBrand)
  )].sort((a, b) => a.localeCompare(b));

  brandFilter.replaceChildren();

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All brands';
  brandFilter.appendChild(allOption);

  brands.forEach(brand => {
    const option = document.createElement('option');
    option.value = brand;
    option.textContent = brand;
    brandFilter.appendChild(option);
  });

  brandFilter.value = brands.includes(selected) ? selected : 'all';
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
    const brand = getBrand(product);

    if (brandFilter && brandFilter.value !== 'all' && brand !== brandFilter.value) {
      return false;
    }

    if (retailerFilter && retailerFilter.value !== 'all' && store !== retailerFilter.value) {
      return false;
    }

    if ((minPrice !== null || maxPrice !== null) && price === null) {
      return false;
    }

    if (minPrice !== null && price < minPrice) return false;
    if (maxPrice !== null && price > maxPrice) return false;

    return true;
  });

  const sortMode = priceSort ? priceSort.value : 'default';

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
    showMessage('No offers match these filters. Try another price range, brand, or retailer.');
    return;
  }

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
      isLowestPrice: price !== null && price === lowestPrice && prices.length > 1,
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
  status.textContent = 'Searching products across retailers…';
  refresh.disabled = true;
  showMessage('Loading product images and prices…');

  try {
    const data = await searchProducts(trimmed);

    if (currentRequest !== requestNumber) return;

    currentProducts = data.products || [];
    updateRetailers();
    updateBrands();

    if (currentProducts.length) {
      renderProducts();
    } else {
      showMessage(
        'No offers were returned for this search. Try a more general product or model name.'
      );
    }

    const time = data.updatedAt
      ? new Date(data.updatedAt).toLocaleTimeString()
      : '';

    status.textContent =
      `${data.count || 0} products returned · ${data.provider || 'Google Shopping'}` +
      `${time ? ` · checked ${time}` : ''}` +
      `${data.cached ? ' · cached result' : ''}`;
  } catch (error) {
    if (currentRequest !== requestNumber) return;

    currentProducts = [];
    updateRetailers();
    updateBrands();
    showMessage(error.message);
    status.textContent = 'Search could not be completed.';
  } finally {
    if (currentRequest === requestNumber) {
      refresh.disabled = !lastQuery;
    }
  }
}

// Offer Comparison Modal Logic
function openModal(titleText) {
  if (!compareModal) return;
  modalTitle.textContent = titleText || 'Retailer Offers';
  modalBody.innerHTML = `
    <div class="modal-loading">
      <div class="spinner"></div>
      <p>Fetching real-time prices and seller offers…</p>
    </div>
  `;
  compareModal.classList.add('active');
  compareModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  if (!compareModal) return;
  compareModal.classList.remove('active');
  compareModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

async function handleCompareClick(productId, productTitle) {
  openModal(`Offers for “${productTitle}”`);

  try {
    const data = await compareOffers(productId);
    const stores = data.stores || [];

    if (!stores.length) {
      modalBody.innerHTML = `
        <div class="modal-empty">
          <p>No multi-store offers were returned by the shopping provider for this specific listing.</p>
          <p class="modal-empty-note">Some products are sold exclusively through a single merchant or lack active retailer feeds.</p>
        </div>
      `;
      return;
    }

    const prices = stores
      .map(s => s.price)
      .filter(p => p !== null && Number.isFinite(p));

    const lowestPrice = prices.length ? Math.min(...prices) : null;
    const highestPrice = prices.length ? Math.max(...prices) : null;

    const rows = stores.map((store, index) => {
      const isLowest = store.price !== null && store.price === lowestPrice && prices.length > 1;
      const savings = (isLowest && highestPrice !== null) ? (highestPrice - store.price) : 0;

      return `
        <div class="offer-row ${isLowest ? 'best-deal' : ''}">
          <div class="offer-store">
            <span class="store-badge">${escapeHtml(store.store)}</span>
            ${isLowest ? '<span class="offer-badge-pill">🏆 Lowest Price</span>' : ''}
            ${store.rating ? `<span class="store-rating">★ ${escapeHtml(store.rating)}</span>` : ''}
          </div>
          <div class="offer-delivery">
            ${escapeHtml(store.delivery || 'Standard shipping')}
          </div>
          <div class="offer-price-col">
            <div class="offer-price">${money(store.price)}</div>
            ${savings > 0 ? `<div class="offer-savings">Save ${money(savings)}</div>` : ''}
          </div>
          <div class="offer-action">
            <a class="buy offer-buy-btn" href="${escapeHtml(store.buyUrl)}" target="_blank" rel="sponsored nofollow noopener noreferrer">
              Buy at ${escapeHtml(store.store)} ↗
            </a>
          </div>
        </div>
      `;
    }).join('');

    modalBody.innerHTML = `
      <div class="modal-offers-container">
        <div class="modal-summary-bar">
          <span>Found <strong>${stores.length}</strong> store offers</span>
          ${lowestPrice !== null ? `<span>Best price: <strong>${money(lowestPrice)}</strong></span>` : ''}
        </div>
        <div class="offer-list">
          ${rows}
        </div>
        <div class="modal-footer-note">
          Prices and availability are updated regularly by merchants. Confirm final details at checkout.
        </div>
      </div>
    `;
  } catch (err) {
    modalBody.innerHTML = `
      <div class="modal-error">
        <p>⚠️ ${escapeHtml(err.message || 'Could not load retailer offers.')}</p>
      </div>
    `;
  }
}

// Event Delegation for Compare Buttons
results.addEventListener('click', event => {
  const compareBtn = event.target.closest('.btn-compare');
  if (!compareBtn) return;

  const productId = compareBtn.getAttribute('data-product-id');
  const productTitle = compareBtn.getAttribute('data-product-title') || 'Product';
  if (productId) {
    handleCompareClick(productId, productTitle);
  }
});

// Modal close handlers
if (modalClose) modalClose.addEventListener('click', closeModal);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && compareModal && compareModal.classList.contains('active')) {
    closeModal();
  }
});

form.addEventListener('submit', event => {
  event.preventDefault();
  runSearch(input.value);
});

refresh.addEventListener('click', () => {
  if (lastQuery) runSearch(lastQuery);
});

if (priceSort) priceSort.addEventListener('change', renderProducts);
if (retailerFilter) retailerFilter.addEventListener('change', renderProducts);
if (brandFilter) brandFilter.addEventListener('change', renderProducts);
if (applyFilters) applyFilters.addEventListener('click', renderProducts);

if (clearFilters) {
  clearFilters.addEventListener('click', () => {
    minPriceInput.value = '';
    maxPriceInput.value = '';
    if (retailerFilter) retailerFilter.value = 'all';
    if (brandFilter) brandFilter.value = 'all';
    if (priceSort) priceSort.value = 'default';
    renderProducts();
  });
}
