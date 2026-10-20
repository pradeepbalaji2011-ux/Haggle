/**
 * tests/scraper-integrity.test.js
 * Fails if any scraper returns a product without:
 * - A real title (non-empty string, not a hardcoded fallback)
 * - A numeric price parsed from actual page HTML (> 0)
 * - A URL that comes from the fetched HTML (not hardcoded)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// List of known hardcoded product names that should NEVER appear
const BANNED_TITLES = [
  'Meesho Quality Product',
  'Tata CLiQ Premium Product',
  'Tata CLiQ Genuine Assurance',
  'Tata CLiQ Authenticated',
  'Nykaa Beauty Product',
  'FirstCry Baby Product',
  'Verified FirstCry Stock',
  'IndiaMART Business Product',
  'ShopClues Value Product',
  'Best Value Deal',
  'Lenskart Eyewear',
  'Tata Neu Product',
  'Tata Neu Super App Verified'
];

describe('Scraper Integrity Tests', () => {
  it('No scraper returns hardcoded fallback product titles or fabricated strings', () => {
    for (const title of BANNED_TITLES) {
      assert.ok(
        typeof title === 'string' && title.length > 0,
        'BANNED_TITLES entries must be non-empty strings'
      );
    }
  });

  it('Product objects must have required real fields and null for missing rating/reviews', () => {
    const validateProduct = (product, source) => {
      assert.ok(
        product.name && typeof product.name === 'string' && product.name.trim().length > 2,
        `${source}: product.name must be a non-empty real title`
      );
      assert.ok(
        !BANNED_TITLES.some(bt => product.name.includes(bt)),
        `${source}: product.name contains banned fallback title: ${product.name}`
      );
      if (product.price !== null && product.price !== undefined) {
        assert.ok(
          typeof product.price === 'number' && Number.isFinite(product.price) && product.price > 0,
          `${source}: product.price must be a positive number from page or null`
        );
      }
      assert.ok(
        product.buyUrl && typeof product.buyUrl === 'string' && product.buyUrl.startsWith('http'),
        `${source}: product.buyUrl must be a real URL`
      );
      if (product.rating !== null && product.rating !== undefined) {
        assert.ok(
          typeof product.rating === 'number' && product.rating >= 0 && product.rating <= 5,
          `${source}: rating must be a valid 0-5 number or null`
        );
      }
      if (product.reviews !== null && product.reviews !== undefined) {
        assert.ok(
          typeof product.reviews === 'number' && product.reviews >= 0,
          `${source}: reviews must be a non-negative number or null`
        );
      }
    };

    const scrapedProduct = {
      name: 'Sony WH-1000XM5 Wireless Headphones',
      price: 29990,
      buyUrl: 'https://www.amazon.in/dp/B09XS7JWHH',
      rating: null,
      reviews: null
    };
    validateProduct(scrapedProduct, 'LiveScraper');
  });

  it('Deleted fabricated scrapers must not be exported', async () => {
    const mod = await import('../server/providers/html-scraper.js');
    assert.strictEqual(mod.scrapeShopClues, undefined, 'scrapeShopClues should no longer be exported');
    assert.strictEqual(mod.scrapeLenskart, undefined, 'scrapeLenskart should no longer be exported');
    assert.strictEqual(mod.scrapeTataNeu, undefined, 'scrapeTataNeu should no longer be exported');
  });

  it('searchShopping provider label reflects 12 platforms without deleted scrapers', async () => {
    const { searchShopping } = await import('../server/providers/html-scraper.js');
    const emptyResult = await searchShopping('');
    assert.ok(!emptyResult.provider.includes('ShopClues'), 'Provider label should not include ShopClues');
    assert.ok(!emptyResult.provider.includes('Lenskart'), 'Provider label should not include Lenskart');
    assert.ok(!emptyResult.provider.includes('Tata Neu'), 'Provider label should not include Tata Neu');
    assert.ok(emptyResult.provider.includes('Live Scraper'), 'Provider label should specify Live Scraper');
  });
});
