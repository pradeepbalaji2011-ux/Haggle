// All frontend calls to the backend live here.
export async function searchProducts(query) {
  const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not load products.');
  return data;
}
