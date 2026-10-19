/**
 * public/js/api.js — Frontend API Client
 *
 * Centralized client for all backend communication:
 * - Product search with retry and error handling
 * - Featured products caching
 * - Product detail & multi-store comparison
 * - User authentication & /api/me single source of truth
 * - Wishlist CRUD operations
 */

async function request(url, options = {}) {
  const headers = {
    'Accept': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
    ...(options.headers || {})
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Search products
 */
export async function searchProducts(query) {
  return request(`/api/products/search?q=${encodeURIComponent(query)}`);
}

/**
 * Fetch featured products for home page rotation
 */
export async function fetchFeaturedProducts() {
  return request('/api/featured');
}

/**
 * Fetch product detail and comparison offers
 */
export async function fetchProductDetail(productId, params = {}) {
  const searchParams = new URLSearchParams({
    productId: productId || '',
    title: params.title || '',
    image: params.image || '',
    price: params.price != null ? String(params.price) : '',
    store: params.store || '',
    buyUrl: params.buyUrl || '',
    brand: params.brand || '',
    rating: params.rating != null ? String(params.rating) : '',
    reviews: params.reviews != null ? String(params.reviews) : '',
    pageToken: params.pageToken || ''
  });

  return request(`/api/products/detail?${searchParams.toString()}`);
}

/**
 * Fetch current logged-in user profile & wishlist (/api/me)
 */
export async function fetchMe(token) {
  if (!token) return null;
  return request('/api/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
}

/**
 * User Login
 */
export async function loginUser(email, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });
}

/**
 * User Registration
 */
export async function registerUser(name, email, password) {
  return request('/api/auth/register', {
    method: 'POST',
    body: { name, email, password }
  });
}

/**
 * Update Profile
 */
export async function updateProfile(token, payload) {
  return request('/api/auth/profile', {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
    body: payload
  });
}

/**
 * Fetch user wishlist from server
 */
export async function fetchWishlist(token) {
  return request('/api/wishlist', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
}

/**
 * Add item to user wishlist
 */
export async function addToWishlist(token, product) {
  return request('/api/wishlist/add', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: { product }
  });
}

/**
 * Remove item from user wishlist
 */
export async function removeFromWishlist(token, productId) {
  return request(`/api/wishlist/remove/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
}

/**
 * Fetch user price alerts from server
 */
export async function fetchAlerts(token) {
  return request('/api/alerts', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
}

/**
 * Set/add target price alert
 */
export async function addPriceAlert(token, alertData) {
  return request('/api/alerts/add', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: alertData
  });
}

/**
 * Remove price alert
 */
export async function removePriceAlert(token, productId) {
  return request(`/api/alerts/remove/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
}

