/**
 * tests/data-integrity-group2.test.js
 * Verifies Group 2 data integrity requirements:
 * - normalizeProductKey distinguishes models correctly
 * - getFormattedPriceHistory returns correct shape
 * - fallback-catalog.js is deleted
 * - platform count is 12
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

describe('Group 2 - Data Integrity Tests', () => {
  it('normalizeProductKey: "iPhone 16" does NOT match "iPhone 16 Pro"', async () => {
    const { normalizeProductKey } = await import('../server/db.js');
    const key16 = normalizeProductKey('Apple iPhone 16 128GB Black');
    const key16pro = normalizeProductKey('Apple iPhone 16 Pro 256GB Titanium');
    // "pro" should appear in key16pro but not key16
    assert.ok(key16pro.includes('pro'), `Expected "pro" in "${key16pro}"`);
    assert.ok(!key16.includes('pro'), `Did not expect "pro" in "${key16}"`);
  });

  it('normalizeProductKey: strips store names', async () => {
    const { normalizeProductKey } = await import('../server/db.js');
    const key = normalizeProductKey('Amazon iPhone 16 Flipkart deal');
    assert.ok(!key.includes('amazon'), `Should strip "amazon" from key: "${key}"`);
    assert.ok(!key.includes('flipkart'), `Should strip "flipkart" from key: "${key}"`);
    assert.ok(key.includes('iphone'), `Should keep "iphone" in key: "${key}"`);
  });

  it('getFormattedPriceHistory returns correct shape', async () => {
    const { getFormattedPriceHistory } = await import('../server/db.js');
    const result = await getFormattedPriceHistory('test product query');
    assert.ok(typeof result.hasData === 'boolean', 'hasData must be boolean');
    assert.ok(Array.isArray(result.allPoints), 'allPoints must be an array');
    // trackingSince is string or null
    assert.ok(result.trackingSince === null || typeof result.trackingSince === 'string',
      'trackingSince must be string or null');
  });

  it('fallback-catalog.js is deleted', () => {
    const fcPath = path.join(ROOT, 'server', 'fallback-catalog.js');
    assert.ok(!existsSync(fcPath), 'server/fallback-catalog.js should be deleted');
  });

  it('Platform count is exactly 12', async () => {
    const { TOP_PLATFORMS, TOTAL_PLATFORMS } = await import('../server/platforms.js');
    assert.strictEqual(TOP_PLATFORMS.length, 12, `Expected 12 platforms, got ${TOP_PLATFORMS.length}`);
    assert.strictEqual(TOTAL_PLATFORMS, 12);
  });

  it('products.js does not import fallback-catalog.js', async () => {
    const { readFileSync } = await import('node:fs');
    const productsJs = readFileSync(path.join(ROOT, 'server', 'routes', 'products.js'), 'utf8');
    assert.ok(!productsJs.includes('fallback-catalog'), 'products.js must not reference fallback-catalog');
  });

  it('catalog-lookup.js does not import fallback-catalog.js', async () => {
    const { readFileSync } = await import('node:fs');
    const lookupJs = readFileSync(path.join(ROOT, 'server', 'chatbot', 'catalog-lookup.js'), 'utf8');
    assert.ok(!lookupJs.includes('fallback-catalog'), 'catalog-lookup.js must not reference fallback-catalog');
  });
});
