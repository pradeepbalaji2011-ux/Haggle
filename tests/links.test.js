/**
 * tests/links.test.js
 *
 * Automated tests for server/links.js, server/platforms.js, and server/affiliate.js.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAndCleanBuyUrl, unwrapTrackingUrl, isExactProductPath } from '../server/links.js';
import { matchPlatform, TOP_PLATFORMS, TOTAL_PLATFORMS } from '../server/platforms.js';

test('Platforms: Exactly 12 platforms configured', () => {
  assert.equal(TOP_PLATFORMS.length, 12);
  assert.equal(TOTAL_PLATFORMS, 12);
});

test('Links: Valid Amazon India product page passes validation and receives affiliate tag', () => {
  process.env.AMAZON_AFFILIATE_TAG = 'haggle-test';
  const url = 'https://www.amazon.in/Apple-iPhone-16-128-GB/dp/B0DGJ9B5DX';
  const result = validateAndCleanBuyUrl(url, 'Amazon India');

  assert.equal(result.valid, true);
  assert.equal(result.platform.id, 'amazon');
  assert.ok(result.cleanUrl.includes('amazon.in'));
  assert.ok(result.cleanUrl.includes('tag=haggle-test'), 'Affiliate tag must be present when env var is set');
  delete process.env.AMAZON_AFFILIATE_TAG;
});

test('Links: Valid Flipkart product page passes validation', () => {
  const url = 'https://www.flipkart.com/apple-iphone-16-black-128-gb/p/itm123456789?pid=MOB12345';
  const result = validateAndCleanBuyUrl(url, 'Flipkart');

  assert.equal(result.valid, true);
  assert.equal(result.platform.id, 'flipkart');
  assert.ok(result.cleanUrl.includes('flipkart.com'));
});

test('Links: Bare homepages are rejected and dropped', () => {
  const amazonHome = validateAndCleanBuyUrl('https://www.amazon.in/', 'Amazon India');
  assert.equal(amazonHome.valid, false, 'Bare Amazon homepage must be rejected');

  const flipkartHome = validateAndCleanBuyUrl('https://www.flipkart.com', 'Flipkart');
  assert.equal(flipkartHome.valid, false, 'Bare Flipkart homepage must be rejected');
});

test('Links: Bare search URLs are rejected and dropped', () => {
  const amazonSearch = validateAndCleanBuyUrl('https://www.amazon.in/s?k=iphone+16', 'Amazon India');
  assert.equal(amazonSearch.valid, false, 'Amazon search URL must be rejected');

  const flipkartSearch = validateAndCleanBuyUrl('https://www.flipkart.com/search?q=iphone+16', 'Flipkart');
  assert.equal(flipkartSearch.valid, false, 'Flipkart search URL must be rejected');
});

test('Links: Non-approved stores outside Top 12 are rejected', () => {
  const foreignStore = validateAndCleanBuyUrl('https://www.ebay.com/itm/123456', 'eBay');
  assert.equal(foreignStore.valid, false, 'eBay is not in the Top 12 Indian platforms');
});

test('Links: Google redirects are unwrapped to destination retailer URL', () => {
  const redirect = 'https://www.google.com/url?url=https://www.amazon.in/dp/B0DGJ9B5DX&rct=j&q=&esrc=s';
  const unwrapped = unwrapTrackingUrl(redirect);
  assert.ok(unwrapped.startsWith('https://www.amazon.in/dp/B0DGJ9B5DX'));

  const result = validateAndCleanBuyUrl(redirect, 'Amazon India');
  assert.equal(result.valid, true);
  assert.ok(result.cleanUrl.includes('amazon.in/dp/B0DGJ9B5DX'));
});
