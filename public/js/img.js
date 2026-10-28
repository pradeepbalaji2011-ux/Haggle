/**
 * public/js/img.js — Image Speed Layer (client side)
 *
 * Routes every remote product image through the Haggle image accelerator
 * (/api/img), which:
 *   - Bypasses retailer hotlink protection (fixes missing images)
 *   - Serves from a server-side disk + memory cache with immutable headers
 *   - Keeps the browser on same-origin connections (HTTP/2 multiplexed)
 *
 * Usage:
 *   <img src="${proxyImg(product.image)}" ...>
 *
 * Data-URLs, blob-URLs and local paths are passed through untouched, so the
 * raw original URL is still what gets stored in wishlists / detail links.
 */

const PROXY_PATH = '/api/img?u=';

/**
 * Maps a remote image URL to the cached same-origin proxy URL.
 * Local/inline URLs are returned unchanged.
 * @param {string} url
 * @returns {string}
 */
export function proxyImg(url) {
  if (!url) return url;
  const u = String(url).trim();

  // Inline data, blob, or already-local → no proxying needed
  if (!u || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('#')) return u;
  if (u.startsWith('/')) return u;

  // Only http(s) remote images go through the accelerator
  if (!/^https?:\/\//i.test(u)) return u;

  return `${PROXY_PATH}${encodeURIComponent(u)}`;
}

/**
 * Universal "no image" fallback — tiny inline SVG shopping-bag placeholder.
 * Used by onerror handlers so a broken src never shows the ugly browser icon.
 */
export const IMG_FALLBACK =
  "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22 viewBox=%220 0 200 200%22>" +
  "<rect fill=%22%231a1a20%22 width=%22200%22 height=%22200%22/>" +
  "<path d=%22M60 70h80l-8 90H68z%22 fill=%22none%22 stroke=%22%2352525b%22 stroke-width=%227%22 stroke-linejoin=%22round%22/>" +
  "<path d=%22M80 70a20 20 0 0 1 40 0%22 fill=%22none%22 stroke=%22%2352525b%22 stroke-width=%227%22/>" +
  "<text fill=%22%2352525b%22 font-family=%22sans-serif%22 font-size=%2213%22 font-weight=%22bold%22 x=%2250%25%22 y=%22185%22 text-anchor=%22middle%22>Haggle</text>" +
  "</svg>";

/**
 * Standard performance attributes for product <img> tags.
 * - decoding="async" keeps scrolling smooth while images decode
 * - referrerpolicy="no-referrer" as second layer of hotlink protection
 */
export const IMG_PERF_ATTRS = 'decoding="async" referrerpolicy="no-referrer"';
