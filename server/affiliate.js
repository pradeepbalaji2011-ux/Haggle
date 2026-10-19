/**
 * server/affiliate.js — Affiliate Tag & Parameter Injector
 *
 * Attaches official partner/affiliate parameters to validated retailer URLs.
 */

const AFFILIATE_CONFIG = {
  amazon: {
    param: 'tag',
    tag: process.env.AMAZON_AFFILIATE_TAG || 'haggle-21'
  },
  flipkart: {
    param: 'affid',
    tag: process.env.FLIPKART_AFFILIATE_TAG || 'haggle2026'
  },
  tatacliq: {
    param: 'aff',
    tag: 'haggle'
  },
  myntra: {
    param: 'aff',
    tag: 'haggle'
  },
  default: {
    param: 'utm_source',
    tag: 'haggle'
  }
};

/**
 * Cleanly attaches affiliate tag to a validated product URL.
 * Preserves all original product parameters and hashes.
 *
 * @param {string} url - Validated direct product URL
 * @param {string} platformId - ID from TOP_PLATFORMS (e.g. 'amazon', 'flipkart')
 * @returns {string} URL with affiliate tag attached
 */
export function applyAffiliateTag(url, platformId) {
  if (!url || typeof url !== 'string') return url;

  try {
    const parsed = new URL(url);
    const config = AFFILIATE_CONFIG[platformId] || AFFILIATE_CONFIG.default;

    if (config.param && config.tag) {
      parsed.searchParams.set(config.param, config.tag);
    }

    // Always include haggle referral marker
    if (!parsed.searchParams.has('ref_source')) {
      parsed.searchParams.set('ref_source', 'haggle');
    }

    return parsed.toString();
  } catch {
    return url;
  }
}
