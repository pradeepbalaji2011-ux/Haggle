/**
 * data.js — Store list, category keywords, and helper functions
 * Centralized reference for Haggle price comparison engine
 */

import { TOP_PLATFORMS, TOTAL_PLATFORMS, matchPlatform, isAllowedPlatform } from './server/platforms.js';
import {
  ACCESSORY_KEYWORDS,
  MODEL_MODIFIERS,
  queryHasAccessory,
  isProductAccessory,
  extractModifiers,
  isRelevant,
  calculateMedianPrice,
  filterByPriceSanity,
  parseNumericPrice
} from './server/relevance.js';
import { isValidProductUrl, formatAffiliateUrl } from './server/links.js';

export const POPULAR_CATEGORIES = [
  { id: 'mobiles', name: 'Mobiles & Tablets', query: 'smartphone 5G', icon: '📱' },
  { id: 'laptops', name: 'Laptops & Computers', query: 'laptop', icon: '💻' },
  { id: 'headphones', name: 'Headphones & Audio', query: 'wireless headphones', icon: '🎧' },
  { id: 'smartwatches', name: 'Smartwatches', query: 'smartwatch', icon: '⌚' },
  { id: 'appliances', name: 'Home Appliances', query: 'air conditioner', icon: '❄️' },
  { id: 'fashion', name: 'Fashion & Shoes', query: 'running shoes', icon: '👟' },
  { id: 'groceries', name: 'Groceries', query: 'olive oil', icon: '🛒' }
];

export {
  TOP_PLATFORMS,
  TOTAL_PLATFORMS,
  matchPlatform,
  isAllowedPlatform,
  ACCESSORY_KEYWORDS,
  MODEL_MODIFIERS,
  queryHasAccessory,
  isProductAccessory,
  extractModifiers,
  isRelevant,
  calculateMedianPrice,
  filterByPriceSanity,
  parseNumericPrice,
  isValidProductUrl,
  formatAffiliateUrl
};
