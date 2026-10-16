import { searchProducts, compareOffers } from './api.js';
import { productCard } from './product-card.js';
import { CONFIG } from './config.js';
import { updateNavbarAuth } from './auth.js';
import { updateWishlistBadge, openWishlistModal, WishlistManager } from './wishlist.js';
import { renderProductDetailView } from './product-view.js';
import { renderProfileView } from './profile-view.js';

const homeView = document.querySelector('#homeView');
const productDetailView = document.querySelector('#productDetailView');
const profileView = document.querySelector('#profileView');

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

// Contact Form elements
const contactForm = document.querySelector('#contact-form');
const contactStatus = document.querySelector('#contact-status');

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

  let products = currentProducts.filter(product => {
    const price = validPrice(product);
    const store = product.store || 'Retailer';
    const brand = getBrand(product);

    if (brandFilter && brandFilter.value !== 'all' && brand !== brandFilter.value) return false;
    if (retailerFilter && retailerFilter.value !== 'all' && store !== retailerFilter.value) return false;
    if ((minPrice !== null || maxPrice !== null) && price === null) return false;
    if (minPrice !== null && price < minPrice) return false;
    if (maxPrice !== null && price > maxPrice) return false;

    return true;
  });

  const sortMode = priceSort ? priceSort.value : 'default';

  if (sortMode === 'ascending') {
    products.sort((a, b) => (validPrice(a) ?? Infinity) - (validPrice(b) ?? Infinity));
  } else if (sortMode === 'descending') {
    products.sort((a, b) => (validPrice(b) ?? -1) - (validPrice(a) ?? -1));
  }

  if (!products.length) {
    showMessage('No offers match these filters. Try adjusting price range, brand, or retailer.');
    return;
  }

  const prices = products.map(validPrice).filter(p => p !== null);
  const lowestPrice = prices.length ? Math.min(...prices) : null;
  const highestPrice = prices.length ? Math.max(...prices) : null;

  results.innerHTML = products.map(product => {
    const price = validPrice(product);
    const savings = price !== null && highestPrice !== null ? Math.max(0, highestPrice - price) : 0;

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
  showMessage('Loading product images and live prices…');

  try {
    const data = await searchProducts(trimmed);
    if (currentRequest !== requestNumber) return;

    currentProducts = data.products || [];
    updateRetailers();
    updateBrands();

    if (currentProducts.length) {
      renderProducts();
    } else {
      showMessage('No offers were returned for this search. Try a more general product or model name.');
    }

    const time = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : '';
    status.textContent = `${data.count || 0} products returned · ${data.provider || 'Google Shopping'}` +
      `${time ? ` · checked ${time}` : ''}` + `${data.cached ? ' · cached result' : ''}`;
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
        </div>
      `;
      return;
    }

    const prices = stores.map(s => s.price).filter(p => p !== null && Number.isFinite(p));
    const lowestPrice = prices.length ? Math.min(...prices) : null;
    const highestPrice = prices.length ? Math.max(...prices) : null;

    const rows = stores.map(store => {
      const isLowest = store.price !== null && store.price === lowestPrice && prices.length > 1;
      const savings = (isLowest && highestPrice !== null) ? (highestPrice - store.price) : 0;

      return `
        <div class="offer-row ${isLowest ? 'best-deal' : ''}">
          <div class="offer-store">
            <span class="store-badge">${escapeHtml(store.store)}</span>
            ${isLowest ? '<span class="offer-badge-pill">🏆 Lowest Price</span>' : ''}
            ${store.rating ? `<span class="store-rating">★ ${escapeHtml(store.rating)}</span>` : ''}
          </div>
          <div class="offer-delivery">${escapeHtml(store.delivery || 'Standard shipping')}</div>
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
        <div class="offer-list">${rows}</div>
      </div>
    `;
  } catch (err) {
    modalBody.innerHTML = `<div class="modal-error"><p>⚠️ ${escapeHtml(err.message || 'Could not load retailer offers.')}</p></div>`;
  }
}

// ==========================================
// UNIFIED GLOBAL CLICK HANDLER (Chips, Compare, Wishlist)
// ==========================================
document.addEventListener('click', async event => {
  // 1. Suggestion & Category Chips
  const chip = event.target.closest('[data-search]');
  if (chip) {
    const queryTerm = chip.getAttribute('data-search') || chip.textContent.trim();
    if (queryTerm) {
      if (input) input.value = queryTerm;
      runSearch(queryTerm);
      const offersSection = document.querySelector('#offers');
      if (offersSection) offersSection.scrollIntoView({ behavior: 'smooth' });
    }
    updateNavbarAuth();
    updateWishlistBadge();
    return;
  }

  // In-App Dedicated Product Detail Page Trigger
  const viewDetailsTrigger = event.target.closest('.btn-view-details') || event.target.closest('.clickable-product-view');
  if (viewDetailsTrigger && !event.target.closest('.btn-wishlist-card') && !event.target.closest('a.buy')) {
    const card = viewDetailsTrigger.closest('.product-card');
    const productId = viewDetailsTrigger.getAttribute('data-product-id') || card?.getAttribute('data-lookup-id') || card?.getAttribute('data-product-id');
    const pTitle = viewDetailsTrigger.getAttribute('data-product-title') || card?.getAttribute('data-product-title') || card?.querySelector('.product-title')?.textContent || '';
    const pImage = viewDetailsTrigger.getAttribute('data-product-image') || card?.getAttribute('data-product-image') || card?.querySelector('.product-image')?.src || '';
    const pPrice = viewDetailsTrigger.getAttribute('data-product-price') || card?.getAttribute('data-product-price') || '';
    const pStore = viewDetailsTrigger.getAttribute('data-product-store') || card?.getAttribute('data-product-store') || '';
    const pBuyUrl = viewDetailsTrigger.getAttribute('data-product-buy-url') || card?.getAttribute('data-product-buy-url') || '';
    const pBrand = viewDetailsTrigger.getAttribute('data-product-brand') || card?.getAttribute('data-product-brand') || '';
    const pDelivery = viewDetailsTrigger.getAttribute('data-product-delivery') || card?.getAttribute('data-product-delivery') || '';
    const pRating = viewDetailsTrigger.getAttribute('data-product-rating') || card?.getAttribute('data-product-rating') || '';
    const pReviews = viewDetailsTrigger.getAttribute('data-product-reviews') || card?.getAttribute('data-product-reviews') || '';

    if (productId) {
      const q = new URLSearchParams({
        id: productId,
        title: pTitle,
        image: pImage,
        price: pPrice,
        store: pStore,
        buyUrl: pBuyUrl,
        brand: pBrand,
        delivery: pDelivery,
        rating: pRating,
        reviews: pReviews
      });
      window.location.hash = `#/product?${q.toString()}`;
    }
    return;
  }

  // 2. Compare Offers Button on Product Cards
  const compareBtn = event.target.closest('.btn-compare');
  if (compareBtn) {
    const productId = compareBtn.getAttribute('data-product-id');
    const productTitle = compareBtn.getAttribute('data-product-title') || 'Product';
    if (productId) handleCompareClick(productId, productTitle);
    return;
  }

  // 3. Header Wishlist Navbar Button
  const wishlistNavBtn = event.target.closest('#openWishlistModalBtn');
  if (wishlistNavBtn) {
    openWishlistModal();
    return;
  }

  // 4. Product Card Wishlist Heart Button (Upgraded to catch any class name)
  const wishlistBtn = event.target.closest('.btn-wishlist-card') || event.target.closest('.wishlist-btn') || event.target.closest('.heart-btn');
  if (wishlistBtn) {
    const card = wishlistBtn.closest('.product-card');
    const productId = wishlistBtn.getAttribute('data-product-id') || wishlistBtn.dataset.productId;
    if (!productId || !card) return;

    // Grab the buy link from the product card
    const buyLinkElement = card.querySelector('a.buy') || card.querySelector('a[href]');

    const product = {
      id: productId,
      name: card.querySelector('.product-title')?.textContent || 'Product',
      price: card.querySelector('.price')?.textContent || '',
      store: card.querySelector('.store')?.textContent || '',
      image: card.querySelector('.product-image')?.src || '',
      buyUrl: buyLinkElement ? buyLinkElement.href : ''
    };

    const isSaved = await WishlistManager.has(productId);
    if (isSaved) {
      await WishlistManager.remove(productId);
      wishlistBtn.style.transform = 'scale(1)';
      wishlistBtn.style.background = 'rgba(255,255,255,0.9)';
      wishlistBtn.title = 'Save to Wishlist';
    } else {
      await WishlistManager.add(product);
      wishlistBtn.style.transform = 'scale(1.15)';
      wishlistBtn.style.background = 'var(--primary-light)';
      wishlistBtn.title = 'Saved in Wishlist!';
    }

    // Instantly refresh the badge
    await updateWishlistBadge();
  }
});

// View Router
function handleRoute() {
  const hash = window.location.hash || '';

  if (hash.startsWith('#/profile')) {
    if (homeView) homeView.style.display = 'none';
    if (productDetailView) productDetailView.style.display = 'none';
    if (profileView) {
      profileView.style.display = 'block';
      renderProfileView(profileView);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (hash.startsWith('#/product')) {
    if (homeView) homeView.style.display = 'none';
    if (profileView) profileView.style.display = 'none';
    if (productDetailView) {
      productDetailView.style.display = 'block';
      const qIndex = hash.indexOf('?');
      const params = new URLSearchParams(qIndex !== -1 ? hash.slice(qIndex + 1) : '');
      const productId = params.get('id');
      renderProductDetailView(productDetailView, productId, {
        title: params.get('title'),
        image: params.get('image'),
        price: params.get('price'),
        store: params.get('store'),
        buyUrl: params.get('buyUrl'),
        brand: params.get('brand'),
        delivery: params.get('delivery'),
        rating: params.get('rating'),
        reviews: params.get('reviews')
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    if (homeView) homeView.style.display = 'block';
    if (productDetailView) productDetailView.style.display = 'none';
    if (profileView) profileView.style.display = 'none';
  }
}

window.addEventListener('hashchange', handleRoute);

// Page Initialization
document.addEventListener('DOMContentLoaded', () => {
  updateNavbarAuth();
  updateWishlistBadge();
  handleRoute();
});

// Modal close handlers
if (modalClose) modalClose.addEventListener('click', closeModal);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && compareModal && compareModal.classList.contains('active')) {
    closeModal();
  }
});

// Search form submit & Filters
if (form) form.addEventListener('submit', event => { event.preventDefault(); runSearch(input.value); });
if (refresh) refresh.addEventListener('click', () => { if (lastQuery) runSearch(lastQuery); });
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

// Contact Form submission
if (contactForm) {
  contactForm.addEventListener('submit', event => {
    event.preventDefault();
    const btn = contactForm.querySelector('button[type="submit"]');
    const nameInput = document.querySelector('#contact-name');
    const name = nameInput ? nameInput.value.trim() : 'there';
    if (btn) btn.disabled = true;
    if (contactStatus) {
      contactStatus.innerHTML = `✓ Thank you, ${escapeHtml(name)}! Your message has been received. Our support team will get in touch with you shortly.`;
      contactStatus.className = 'contact-status success';
      contactStatus.style.display = 'block';
    }
    contactForm.reset();
    setTimeout(() => { if (btn) btn.disabled = false; }, 3000);
  });
}
// Listen for clicks on any heart / wishlist button on product cards
document.addEventListener('click', async (e) => {
  const heartBtn = e.target.closest('.wishlist-btn') || e.target.closest('.heart-btn');
  if (!heartBtn) return;

  // Grab the product data stored on the button
  const productDataStr = heartBtn.getAttribute('data-product');
  if (!productDataStr) return;

  try {
    const product = JSON.parse(productDataStr);
    
    // Add to wishlist (handles guest or logged-in user automatically)
    const success = await WishlistManager.add(product);
    
    if (success) {
      // Instantly update the badge number on the navbar
      await updateWishlistBadge();
    }
  } catch (err) {
    console.error('Error adding product to wishlist:', err);
  }
});