/**
 * tests/relevance-dedupe.test.js
 *
 * Automated tests for server/relevance.js and server/dedupe.js using Node.js built-in test runner.
 * Covers:
 * 1. "iphone 16" excludes "iPhone 16 silicone case"
 * 2. "iphone 16 case" includes it
 * 3. two listings of "Apple iPhone 16 128GB Black" merge
 * 4. "iPhone 16 Pro" does not appear for "iphone 16"
 * 5. Same store twice keeps lowest price
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { isRelevant, filterRelevantProducts } from '../server/relevance.js';
import { deduplicateProducts } from '../server/dedupe.js';

test('Relevance: "iphone 16" excludes accessory "iPhone 16 silicone case"', () => {
  const result = isRelevant({ name: 'iPhone 16 silicone case' }, 'iphone 16');
  assert.equal(result, false, 'Accessory should be excluded when query has no accessory keyword');
});

test('Relevance: "iphone 16 case" includes "iPhone 16 silicone case"', () => {
  const result = isRelevant({ name: 'iPhone 16 silicone case' }, 'iphone 16 case');
  assert.equal(result, true, 'Accessory should be included when query specifically asks for case');
});

test('Relevance: "iPhone 16 Pro" does not appear for "iphone 16"', () => {
  const result = isRelevant({ name: 'Apple iPhone 16 Pro (128 GB) - Natural Titanium' }, 'iphone 16');
  assert.equal(result, false, 'iPhone 16 Pro must not match query for base iphone 16');
});

test('Relevance: "iPhone 16 Plus" does not appear for "iphone 16"', () => {
  const result = isRelevant({ name: 'Apple iPhone 16 Plus (128 GB) - Ultramarine' }, 'iphone 16');
  assert.equal(result, false, 'iPhone 16 Plus must not match query for base iphone 16');
});

test('Relevance: "iPhone 16 Pro" appears for query "iphone 16 pro"', () => {
  const result = isRelevant({ name: 'Apple iPhone 16 Pro (128 GB) - Desert Titanium' }, 'iphone 16 pro');
  assert.equal(result, true, 'iPhone 16 Pro must match query iphone 16 pro');
});

test('Relevance: "iPhone 16 Pro Max" does NOT appear for query "iphone 16 pro"', () => {
  const result = isRelevant({ name: 'Apple iPhone 16 Pro Max 256GB' }, 'iphone 16 pro');
  assert.equal(result, false, 'iPhone 16 Pro Max must not match query iphone 16 pro');
});

test('Relevance: Generic query "smartphone 5G" matches phone titles without literal word "smartphone"', () => {
  const samsung = isRelevant({ name: 'Samsung Galaxy M35 5G (Moonlight Blue, 128 GB)' }, 'smartphone 5G');
  assert.equal(samsung, true, 'Samsung Galaxy M35 5G should match smartphone 5G');

  const poco = isRelevant({ name: 'POCO X6 Pro 5G (Yellow, 256 GB)' }, 'smartphone 5G');
  assert.equal(poco, true, 'POCO X6 Pro 5G should match smartphone 5G even with Pro modifier');

  const caseItem = isRelevant({ name: 'Redmi 13C 5G Transparent Silicone Back Cover' }, 'smartphone 5G');
  assert.equal(caseItem, false, 'Phone back cover should be excluded from smartphone 5G query');
});

test('Relevance: Generic query "laptop" matches laptop titles', () => {
  const macbook = isRelevant({ name: 'Apple MacBook Air M2 (16GB RAM, 256GB SSD)' }, 'laptop');
  assert.equal(macbook, true, 'MacBook Air should match generic laptop query');

  const bag = isRelevant({ name: 'Waterproof Laptop Sleeve Case Cover' }, 'laptop');
  assert.equal(bag, false, 'Laptop sleeve should be excluded from generic laptop query');
});

test('Deduplication: two listings of "Apple iPhone 16 128GB Black" merge into one product card', () => {
  const sampleProducts = [
    {
      id: 'p1',
      name: 'Apple iPhone 16 (128 GB) - Black',
      brand: 'Apple',
      price: 79900,
      store: 'Amazon India',
      buyUrl: 'https://www.amazon.in/dp/B0DGJ9B5DX'
    },
    {
      id: 'p2',
      name: 'Apple iPhone 16 128GB Black',
      brand: 'Apple',
      price: 78999,
      store: 'Flipkart',
      buyUrl: 'https://www.flipkart.com/apple-iphone-16-black-128-gb/p/itm12345'
    }
  ];

  const merged = deduplicateProducts(sampleProducts);
  assert.equal(merged.length, 1, 'Should merge into a single product card');
  assert.equal(merged[0].lowestPrice, 78999, 'Lowest price should be Flipkart offer (₹78,999)');
  assert.equal(merged[0].storeCount, 2, 'Store count should be 2');
  assert.equal(merged[0].stores.length, 2, 'Should contain both store offers');
});

test('Deduplication: never shows the same store twice for one product (keeps lowest price)', () => {
  const sampleProducts = [
    {
      id: 'p1',
      name: 'Apple iPhone 16 (128 GB) - Black',
      brand: 'Apple',
      price: 79900,
      store: 'Amazon India',
      buyUrl: 'https://www.amazon.in/dp/B0DGJ9B5DX'
    },
    {
      id: 'p2',
      name: 'Apple iPhone 16 128GB Black',
      brand: 'Apple',
      price: 76999, // Lower price from Amazon
      store: 'Amazon India',
      buyUrl: 'https://www.amazon.in/dp/B0DGJ9B5DX_deal'
    }
  ];

  const merged = deduplicateProducts(sampleProducts);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].stores.length, 1, 'Same store must not appear twice');
  assert.equal(merged[0].stores[0].price, 76999, 'Should keep lowest price from Amazon India');
  assert.equal(merged[0].lowestPrice, 76999);
});

test('Relevance: price sanity check filters out cheap accessories (< 18% of median price)', () => {
  const items = [
    { name: 'Apple iPhone 16 128GB', price: 79900 },
    { name: 'Apple iPhone 16 128GB', price: 78999 },
    { name: 'Apple iPhone 16 128GB', price: 79499 },
    { name: 'Apple iPhone 16 Tempered Glass (Unlabeled)', price: 299 } // cheap accessory
  ];

  const filtered = filterRelevantProducts(items, 'iphone 16');
  assert.equal(filtered.length, 3, '₹299 accessory should be filtered out by median price check');
  assert.ok(filtered.every(p => p.price > 10000));
});

test('Relevance: price sanity check keeps products when query explicitly asks for accessories', () => {
  const items = [
    { name: 'Apple iPhone 16 Silicone Case Pink', price: 4900 },
    { name: 'Apple iPhone 16 Clear Case', price: 4500 },
    { name: 'iPhone 16 TPU Soft Case', price: 399 }
  ];

  const filtered = filterRelevantProducts(items, 'iphone 16 case');
  assert.equal(filtered.length, 3, 'When query asks for case, cheap case should not be filtered');
});

