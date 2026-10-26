// UI configuration only. Provider secrets must never be placed in frontend files.
export const CONFIG = {
  currency: 'INR',
  locale: 'en-IN',
  fallbackImageEmoji: '🛍️'
};

/**
 * Standard Indian Rupee (INR) formatter for all currency amounts across Haggle.
 * Formats integers e.g. 64701 -> "₹64,701"
 */
export const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

/**
 * Formats a numeric price into localized INR currency string.
 * @param {number|string} amount
 * @returns {string} Formatted string e.g. "₹64,701" or "—"
 */
export function formatPrice(amount) {
  if (amount == null || isNaN(Number(amount))) return '\u2014';
  return inrFormatter.format(Number(amount));
}
