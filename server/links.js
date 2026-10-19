/**
 * server/links.js — Buy URL Resolver, Sanitizer, and Validator
 *
 * Validates that buy URLs:
 * 1. Belong to one of the 20 approved Indian platforms.
 * 2. Have an exact product path (never home page, never bare search, never bare category).
 * 3. Resolves and strips Google ad tracking redirects.
 * 4. Applies official affiliate tags through server/affiliate.js.
 * 5. Rejects and drops any offer failing validation instead of linking to home/search pages.
 */

import { matchPlatform } from './platforms.js';
import { applyAffiliateTag } from './affiliate.js';

// Query parameters to strip from destination URLs
const TRACKING_PARAMS = [
  'srsltid', 'gclid', 'gbraid', 'wbraid', 'cmpid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'gad_source', 'gad_campaign', 'gclsr'
];

// Disallowed generic non-product path patterns across e-commerce sites
const BARE_NON_PRODUCT_PATHS = [
  /^\/?$/,                                       // Bare homepage '/'
  /^\/search\/?$/i,                              // Bare /search or /search/
  /^\/s\/?$/i,                                   // Amazon bare /s
  /^\/gp\/search/i,                              // Amazon search
  /^\/search-results?\/?$/i,                     // Generic search results
  /^\/category\/?$/i,                            // Generic category root
  /^\/categories\/?$/i,                          // Generic categories
  /^\/all-categories\/?$/i,                      // Generic all-categories
  /^\/browse\/?$/i,                              // Generic browse
  /^\/deals?\/?$/i,                              // Generic deals
  /^\/offers?\/?$/i,                             // Generic offers
  /^\/home\/?$/i,                                // Home alias
  /^\/index\.(html?|php)\/?$/i                   // Index page
];

/**
 * Recursively unwrap Google and ad-service redirects to reach destination URL
 */
export function unwrapTrackingUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();

    // Check if URL is Google redirect or tracking gateway
    const isRedirectGateway = (
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host.startsWith('google.') ||
      host.includes('googleadservices') ||
      host.includes('doubleclick.net')
    );

    if (isRedirectGateway) {
      for (const param of ['adurl', 'url', 'dest', 'rurl', 'target_url', 'q', 'link']) {
        if (parsed.searchParams.has(param)) {
          const target = parsed.searchParams.get(param);
          if (target && (target.startsWith('http://') || target.startsWith('https://'))) {
            // Recursively unwrap nested redirects
            return unwrapTrackingUrl(target);
          }
        }
      }
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Remove tracking and telemetry query params
 */
function stripTrackingParameters(urlStr) {
  try {
    const parsed = new URL(urlStr);
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString();
  } catch {
    return urlStr;
  }
}

/**
 * Check whether a URL pathname is an exact product link vs. a generic homepage/search/category
 */
export function isExactProductPath(parsedUrl, platformId) {
  const pathname = parsedUrl.pathname || '/';

  // Check against general non-product patterns
  for (const regex of BARE_NON_PRODUCT_PATHS) {
    if (regex.test(pathname)) {
      return false;
    }
  }

  // Path must have some depth (at least one slug segment)
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return false;
  }

  // Platform-specific validation rules
  switch (platformId) {
    case 'amazon':
      // Amazon product pages contain /dp/, /gp/product/, or /gp/aw/d/
      return pathname.includes('/dp/') || pathname.includes('/gp/product/') || pathname.includes('/gp/aw/d/');

    case 'flipkart':
    case 'shopsy':
      // Flipkart / Shopsy product pages contain /p/ or product slug with pid in query/path
      return pathname.includes('/p/') || parsedUrl.searchParams.has('pid');

    case 'myntra':
      // Myntra product URLs end with /buy or have numeric style ID slug (e.g. /clothing/.../12345/buy)
      return segments.length >= 2 && !pathname.startsWith('/search');

    case 'ajio':
      return pathname.includes('/p/') || (segments.length >= 2 && !pathname.startsWith('/search'));

    case 'nykaa':
      return pathname.includes('/p/') || (segments.length >= 2 && !pathname.startsWith('/search'));

    case 'tatacliq':
      return pathname.includes('/p-mp') || pathname.includes('/p-') || (segments.length >= 2 && !pathname.startsWith('/search'));

    case 'jiomart':
      return pathname.includes('/p/') || (segments.length >= 2 && !pathname.startsWith('/search'));

    case 'bigbasket':
      return pathname.includes('/pd/') || pathname.includes('/ps/') || (segments.length >= 2 && !pathname.startsWith('/search'));

    case 'firstcry':
      return pathname.includes('/product-detail') || (segments.length >= 2 && !pathname.startsWith('/search'));

    case 'meesho':
      return pathname.includes('/p/') || pathname.includes('/s/p/') || (segments.length >= 2 && !pathname.startsWith('/search'));

    case 'snapdeal':
      return pathname.includes('/product/') || (segments.length >= 2 && !pathname.startsWith('/search'));

    case 'shopclues':
      return pathname.includes('/product/') || (segments.length >= 2 && !pathname.startsWith('/search'));

    case 'blinkit':
      return pathname.includes('/prid/') || (segments.length >= 2 && !pathname.startsWith('/s/'));

    case 'zepto':
      return pathname.includes('/pn/') || pathname.includes('/product/') || (segments.length >= 2 && !pathname.startsWith('/search'));

    case 'swiggy_instamart':
      return pathname.includes('/instamart/item/') || pathname.includes('/item/') || (segments.length >= 2 && !pathname.startsWith('/search'));

    case 'indiamart':
      return pathname.includes('/proddetail') || pathname.includes('/impcat') || (segments.length >= 1 && !pathname.startsWith('/search'));

    default:
      // General rule: must have at least 1 significant slug segment and not be a bare search
      return segments.length >= 1 && !pathname.toLowerCase().includes('/search');
  }
}

/**
 * Validate and clean a buy URL.
 * Drops any link that fails validation (wrong store, homepage link, bare search link).
 *
 * @param {string} rawUrl - Initial offer link
 * @param {string} storeName - Store name provided by shopping feed
 * @returns {{ valid: boolean, cleanUrl: string|null, platform: object|null, reason?: string }}
 */
export function validateAndCleanBuyUrl(rawUrl, storeName = '') {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, cleanUrl: null, platform: null, reason: 'MISSING_URL' };
  }

  // 1. Unwrap Google and ad redirects
  const unwrapped = unwrapTrackingUrl(rawUrl);
  if (!unwrapped) {
    return { valid: false, cleanUrl: null, platform: null, reason: 'INVALID_URL_FORMAT' };
  }

  let parsed;
  try {
    parsed = new URL(unwrapped);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, cleanUrl: null, platform: null, reason: 'INVALID_PROTOCOL' };
    }
  } catch {
    return { valid: false, cleanUrl: null, platform: null, reason: 'MALFORMED_URL' };
  }

  // 2. Match against Top 20 approved platforms
  const platform = matchPlatform(unwrapped, storeName);
  if (!platform) {
    return { valid: false, cleanUrl: null, platform: null, reason: 'STORE_NOT_IN_TOP_20' };
  }

  // 3. Ensure destination hostname matches platform domain
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const domainMatches = platform.domains.some(d => {
    const cleanD = d.replace(/^www\./, '').toLowerCase();
    return host === cleanD || host.endsWith('.' + cleanD);
  });

  if (!domainMatches) {
    return { valid: false, cleanUrl: null, platform: null, reason: 'DOMAIN_MISMATCH' };
  }

  // 4. Validate that this is an exact product path and NOT a homepage or bare search
  if (!isExactProductPath(parsed, platform.id)) {
    return { valid: false, cleanUrl: null, platform, reason: 'NOT_AN_EXACT_PRODUCT_PAGE' };
  }

  // 5. Clean tracking query parameters
  const strippedUrl = stripTrackingParameters(parsed.toString());

  // 6. Apply affiliate tags
  const finalizedUrl = applyAffiliateTag(strippedUrl, platform.id);

  return {
    valid: true,
    cleanUrl: finalizedUrl,
    platform,
    storeName: platform.name,
    badgeColor: platform.badgeColor
  };
}
