/**
 * server/platforms.js — The Top 20 Indian Platforms Configuration
 *
 * Haggle strictly filters offers across only these 20 designated Indian platforms.
 * Every offer from any other store is dropped.
 */

export const TOP_PLATFORMS = [
  {
    id: 'amazon',
    name: 'Amazon India',
    domain: 'amazon.in',
    domains: ['amazon.in', 'www.amazon.in'],
    aliases: ['amazon', 'amazon india', 'amazon.in', 'amazon in'],
    category: 'General Marketplace',
    badgeColor: '#FF9900'
  },
  {
    id: 'flipkart',
    name: 'Flipkart',
    domain: 'flipkart.com',
    domains: ['flipkart.com', 'www.flipkart.com', 'dl.flipkart.com'],
    aliases: ['flipkart', 'flipkart.com', 'flipkart wholesale'],
    category: 'General Marketplace',
    badgeColor: '#2874F0'
  },
  {
    id: 'meesho',
    name: 'Meesho',
    domain: 'meesho.com',
    domains: ['meesho.com', 'www.meesho.com'],
    aliases: ['meesho', 'meesho.com'],
    category: 'Social Commerce & Fashion',
    badgeColor: '#E91E63'
  },
  {
    id: 'shopsy',
    name: 'Shopsy',
    domain: 'shopsy.in',
    domains: ['shopsy.in', 'www.shopsy.in'],
    aliases: ['shopsy', 'shopsy by flipkart', 'shopsy.in'],
    category: 'Budget Marketplace',
    badgeColor: '#7C3AED'
  },
  {
    id: 'indiamart',
    name: 'IndiaMART',
    domain: 'indiamart.com',
    domains: ['indiamart.com', 'www.indiamart.com', 'dir.indiamart.com'],
    aliases: ['indiamart', 'india mart', 'indiamart.com'],
    category: 'B2B Marketplace',
    badgeColor: '#00A699'
  },
  {
    id: 'myntra',
    name: 'Myntra',
    domain: 'myntra.com',
    domains: ['myntra.com', 'www.myntra.com'],
    aliases: ['myntra', 'myntra.com'],
    category: 'Fashion & Apparel',
    badgeColor: '#FF3F6C'
  },
  {
    id: 'ajio',
    name: 'AJIO',
    domain: 'ajio.com',
    domains: ['ajio.com', 'www.ajio.com'],
    aliases: ['ajio', 'ajio.com', 'ajio luxe'],
    category: 'Fashion & Lifestyle',
    badgeColor: '#2C4152'
  },
  {
    id: 'nykaa',
    name: 'Nykaa',
    domain: 'nykaa.com',
    domains: ['nykaa.com', 'www.nykaa.com', 'nykaaman.com', 'www.nykaaman.com'],
    aliases: ['nykaa', 'nykaa.com', 'nykaa man', 'nykaa fashion'],
    category: 'Beauty & Cosmetics',
    badgeColor: '#FC2779'
  },
  {
    id: 'tatacliq',
    name: 'Tata CLiQ',
    domain: 'tatacliq.com',
    domains: ['tatacliq.com', 'www.tatacliq.com', 'luxury.tatacliq.com'],
    aliases: ['tata cliq', 'tatacliq', 'tatacliq.com', 'tata cliq luxury'],
    category: 'Multi-category & Electronics',
    badgeColor: '#0F172A'
  },
  {
    id: 'jiomart',
    name: 'JioMart',
    domain: 'jiomart.com',
    domains: ['jiomart.com', 'www.jiomart.com'],
    aliases: ['jiomart', 'jio mart', 'jiomart.com'],
    category: 'Groceries & Electronics',
    badgeColor: '#0078AD'
  },
  {
    id: 'bigbasket',
    name: 'BigBasket',
    domain: 'bigbasket.com',
    domains: ['bigbasket.com', 'www.bigbasket.com'],
    aliases: ['bigbasket', 'big basket', 'bb daily', 'bigbasket.com'],
    category: 'Online Grocery',
    badgeColor: '#84C225'
  },
  {
    id: 'firstcry',
    name: 'FirstCry',
    domain: 'firstcry.com',
    domains: ['firstcry.com', 'www.firstcry.com'],
    aliases: ['firstcry', 'first cry', 'firstcry.com'],
    category: 'Baby, Kids & Toys',
    badgeColor: '#FF6F61'
  },
  {
    id: 'snapdeal',
    name: 'Snapdeal',
    domain: 'snapdeal.com',
    domains: ['snapdeal.com', 'www.snapdeal.com'],
    aliases: ['snapdeal', 'snapdeal.com'],
    category: 'Value Marketplace',
    badgeColor: '#E40046'
  },
  {
    id: 'shopclues',
    name: 'ShopClues',
    domain: 'shopclues.com',
    domains: ['shopclues.com', 'www.shopclues.com'],
    aliases: ['shopclues', 'shop clues', 'shopclues.com'],
    category: 'Value Marketplace',
    badgeColor: '#24A3B5'
  },
  {
    id: 'blinkit',
    name: 'Blinkit',
    domain: 'blinkit.com',
    domains: ['blinkit.com', 'www.blinkit.com'],
    aliases: ['blinkit', 'grofers', 'blinkit.com'],
    category: 'Quick Commerce',
    badgeColor: '#F8CB46'
  },
  {
    id: 'zepto',
    name: 'Zepto',
    domain: 'zepto.now',
    domains: ['zepto.now', 'zeptonow.com', 'www.zeptonow.com'],
    aliases: ['zepto', 'zepto.now', 'zeptonow'],
    category: 'Quick Commerce',
    badgeColor: '#8B5CF6'
  },
  {
    id: 'swiggy_instamart',
    name: 'Swiggy Instamart',
    domain: 'swiggy.com/instamart',
    domains: ['swiggy.com', 'www.swiggy.com'],
    aliases: ['swiggy instamart', 'instamart', 'swiggy'],
    category: 'Quick Commerce',
    badgeColor: '#FC8019'
  },
  {
    id: 'lenskart',
    name: 'Lenskart',
    domain: 'lenskart.com',
    domains: ['lenskart.com', 'www.lenskart.com'],
    aliases: ['lenskart', 'lenskart.com'],
    category: 'Eyewear & Vision Care',
    badgeColor: '#000042'
  },
  {
    id: 'pepperfry',
    name: 'Pepperfry',
    domain: 'pepperfry.com',
    domains: ['pepperfry.com', 'www.pepperfry.com'],
    aliases: ['pepperfry', 'pepperfry.com'],
    category: 'Furniture & Home Décor',
    badgeColor: '#F16521'
  },
  {
    id: 'tataneu',
    name: 'Tata Neu',
    domain: 'tataneu.com',
    domains: ['tataneu.com', 'www.tataneu.com'],
    aliases: ['tata neu', 'tataneu', 'tataneu.com'],
    category: 'Super App & Marketplace',
    badgeColor: '#5C2D91'
  }
];

export const TOTAL_PLATFORMS = TOP_PLATFORMS.length; // 20

/**
 * Normalizes store name string for fuzzy matching
 */
function normalizeStoreName(name = '') {
  return String(name || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[^\w\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts hostname from URL safely
 */
function extractHostname(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Match a store to one of the Top 20 platforms.
 * First priority: Domain match against URL.
 * Second priority: Alias match against store name.
 *
 * @param {string} url - Product or offer URL
 * @param {string} storeName - Retailer/seller name string
 * @returns {object|null} Matched platform object or null if not in Top 20
 */
export function matchPlatform(url, storeName) {
  // 1. First priority: match by domain in URL
  const hostname = extractHostname(url);
  if (hostname) {
    for (const p of TOP_PLATFORMS) {
      if (p.domains.some(d => {
        const cleanD = d.replace(/^www\./, '').toLowerCase();
        return hostname === cleanD || hostname.endsWith('.' + cleanD);
      })) {
        // Special case: check swiggy instamart path if domain is swiggy.com
        if (p.id === 'swiggy_instamart') {
          try {
            const parsed = new URL(url);
            if (parsed.pathname.includes('/instamart') || normalizeStoreName(storeName).includes('instamart')) {
              return p;
            }
          } catch {}
        }
        return p;
      }
    }
  }

  // 2. Second priority: match by name aliases
  const cleanName = normalizeStoreName(storeName);
  if (cleanName) {
    for (const p of TOP_PLATFORMS) {
      for (const alias of p.aliases) {
        const cleanAlias = normalizeStoreName(alias);
        if (cleanName === cleanAlias || cleanName.includes(cleanAlias) || cleanAlias.includes(cleanName)) {
          return p;
        }
      }
    }
  }

  return null;
}

/**
 * Returns true if the offer belongs to one of the 20 approved platforms
 */
export function isAllowedPlatform(url, storeName) {
  return matchPlatform(url, storeName) !== null;
}
