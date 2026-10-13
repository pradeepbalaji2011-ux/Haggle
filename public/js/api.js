// All frontend calls to the backend live here.

async function fetchWithRetry(url, options = {}, retries = 1, delayMs = 3000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000); // 35s timeout
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    if (retries > 0) {
      console.warn('Network request failed, retrying in', delayMs, 'ms...', err.message);
      await new Promise(r => setTimeout(r, delayMs));
      return fetchWithRetry(url, options, retries - 1, delayMs);
    }
    throw err;
  }
}

export async function searchProducts(query) {
  let response;
  try {
    response = await fetchWithRetry(`/api/products/search?q=${encodeURIComponent(query)}`, {}, 1, 3500);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Search timed out. The server may still be starting up — please click Refresh.');
    }
    throw new Error('Connection to Haggle server failed. If using Render, the free instance may be waking up from sleep. Please wait a few seconds and try again.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Server returned error (${response.status}). Please try again.`);
  }
  return data;
}

export async function compareOffers(productId) {
  let response;
  try {
    response = await fetchWithRetry(`/api/products/compare?productId=${encodeURIComponent(productId)}`, {}, 1, 3500);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Comparison timed out. Please try again.');
    }
    throw new Error('Connection to server failed. Please check your internet or try again in a moment.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Could not load retailer offers (${response.status}).`);
  }
  return data;
}
