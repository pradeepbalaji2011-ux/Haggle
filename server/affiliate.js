/**
 * server/affiliate.js — Affiliate Tag & Parameter Injector
 *
 * Attaches official partner/affiliate parameters to validated retailer URLs.
 */

function getAffiliateConfig(platformId) {
  const configs = {
    amazon: {
      param: 'tag',
      tag: process.env.AMAZON_AFFILIATE_TAG || null
    },
    flipkart: {
      param: 'affid',
      tag: process.env.FLIPKART_AFFILIATE_TAG || null
    },
    tatacliq: {
      param: 'aff',
      tag: process.env.TATACLIQ_AFFILIATE_TAG || null
    },
    myntra: {
      param: 'aff',
      tag: process.env.MYNTRA_AFFILIATE_TAG || null
    }
  };
  return configs[platformId] || null;
}

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
    const config = getAffiliateConfig(platformId);

    if (config && config.param && config.tag) {
      parsed.searchParams.set(config.param, config.tag);
      // Only include haggle referral marker when we have an affiliate tag
      if (!parsed.searchParams.has('ref_source')) {
        parsed.searchParams.set('ref_source', 'haggle');
      }
    }

    return parsed.toString();
  } catch {
    return url;
  }
}
