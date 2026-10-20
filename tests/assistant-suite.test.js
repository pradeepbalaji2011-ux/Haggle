/**
 * tests/assistant-suite.test.js
 *
 * Comprehensive Automated Benchmark Test Suite for Haggle Assistant Chatbot
 * Validates all 11 required shopping queries:
 * 1. "Price of Samsung S24 on all sites"
 * 2. "Show price history of boAt Airdopes 141"
 * 3. "Is the price of this laptop going to drop?"
 * 4. "Cheapest 55 inch smart TV right now"
 * 5. "Compare iPhone 15 and Galaxy S24"
 * 6. "Best running shoes under 3000"
 * 7. "Is this a good time to buy a fridge?"
 * 8. "Which site gives the best discount on Nike shoes?"
 * 9. "Tell me the specs of the Redmi Note 13"
 * 10. "What are trending products today?"
 * 11. "Similar cheaper alternatives to boAt Airdopes 141"
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { extractIntentAndEntities, parseQueryRuleBased } from '../server/chatbot/nlu.js';
import { retrieveProductData, analyzePriceHistory } from '../server/chatbot/retrieval.js';
import { generateVerifiedResponse, verifyCandidateResponse, extractGroundTruthNumbers } from '../server/chatbot/generator.js';

test('Benchmark 1: "Price of Samsung S24 on all sites"', async () => {
  const query = "Price of Samsung S24 on all sites";
  const parsed = parseQueryRuleBased(query);

  assert.ok(['current_price', 'compare_platforms'].includes(parsed.intent), `Intent was: ${parsed.intent}`);
  assert.ok(parsed.entity.productName.toLowerCase().includes('samsung') || parsed.entity.productName.toLowerCase().includes('s24'));

  const retrieved = await retrieveProductData(parsed.entity.productName);
  assert.ok(retrieved.products.length > 0, 'Products should be retrieved');

  const res = await generateVerifiedResponse({
    userMessage: query,
    intent: parsed.intent,
    entity: parsed.entity,
    retrievedData: retrieved,
    historyStats: null
  });

  assert.ok(res.text.includes('₹'), 'Response must contain verified prices with ₹');
  assert.ok(res.cards.length > 0, 'Product cards must be returned for rich UI');
  assert.ok(res.spokenSummary.length > 0, 'Spoken summary must be generated');
});

test('Benchmark 2: "Show price history of boAt Airdopes 141"', async () => {
  const query = "Show price history of boAt Airdopes 141";
  const parsed = parseQueryRuleBased(query);

  assert.equal(parsed.intent, 'price_history');
  assert.ok(parsed.entity.productName.toLowerCase().includes('boat'));

  const retrieved = await retrieveProductData(parsed.entity.productName);
  const activePrice = retrieved.products[0]?.price || 1099;
  const historyStats = await analyzePriceHistory(parsed.entity.productName, activePrice);

  const res = await generateVerifiedResponse({
    userMessage: query,
    intent: parsed.intent,
    entity: parsed.entity,
    retrievedData: retrieved,
    historyStats
  });

  assert.ok(res.text.includes('Price History') || res.text.includes('Lowest'), 'Must contain price history data');
  if (historyStats && historyStats.hasHistory) {
    assert.ok(res.miniChart !== undefined, 'Mini chart data should be present when history exists');
  }
});

test('Benchmark 3: "Is the price of this laptop going to drop?"', async () => {
  const query = "Is the price of this laptop going to drop?";
  const history = [
    { role: 'user', content: 'Tell me about Apple MacBook Air M2' },
    { role: 'assistant', content: 'The MacBook Air M2 is available for ₹94,900.' }
  ];

  const parsed = parseQueryRuleBased(query, history);
  assert.equal(parsed.intent, 'price_drop_trend');
  assert.ok(parsed.entity.productName.toLowerCase().includes('macbook'), 'Context resolver should find product from previous messages');

  const retrieved = await retrieveProductData(parsed.entity.productName);
  const historyStats = await analyzePriceHistory(parsed.entity.productName, retrieved.products[0]?.price);

  const res = await generateVerifiedResponse({
    userMessage: query,
    intent: parsed.intent,
    entity: parsed.entity,
    retrievedData: retrieved,
    historyStats
  });

  assert.ok(res.text.includes('Recommendation') || res.text.includes('price'), 'Must provide trend recommendation');
});

test('Benchmark 4: "Cheapest 55 inch smart TV right now"', async () => {
  const query = "Cheapest 55 inch smart TV right now";
  const parsed = parseQueryRuleBased(query);

  assert.ok(['best_deal', 'category_browsing', 'current_price'].includes(parsed.intent));
  const retrieved = await retrieveProductData('55 inch smart TV');
  assert.ok(retrieved.products.length > 0);

  const res = await generateVerifiedResponse({
    userMessage: query,
    intent: 'best_deal',
    entity: parsed.entity,
    retrievedData: retrieved,
    historyStats: null
  });

  assert.ok(res.text.includes('Best Deal Found') || res.text.includes('lowest price') || res.text.includes('₹'));
  assert.ok(res.cards.length > 0);
});

test('Benchmark 5: "Compare iPhone 15 and Galaxy S24"', async () => {
  const query = "Compare iPhone 15 and Galaxy S24";
  const parsed = parseQueryRuleBased(query);

  assert.equal(parsed.intent, 'compare_products');
  assert.ok(parsed.entity.productName);
  assert.ok(parsed.entity.secondProduct);

  const p1 = await retrieveProductData(parsed.entity.productName);
  const p2 = await retrieveProductData(parsed.entity.secondProduct);

  const combinedData = {
    query,
    products: [p1.products[0], p2.products[0]].filter(Boolean)
  };

  const res = await generateVerifiedResponse({
    userMessage: query,
    intent: parsed.intent,
    entity: parsed.entity,
    retrievedData: combinedData,
    historyStats: null
  });

  assert.ok(res.text.includes('Comparison') || res.text.includes('vs'));
  assert.ok(res.cards.length >= 1);
});

test('Benchmark 6: "Best running shoes under 3000"', async () => {
  const query = "Best running shoes under 3000";
  const parsed = parseQueryRuleBased(query);

  assert.equal(parsed.intent, 'category_browsing');
  assert.equal(parsed.entity.budgetMax, 3000, 'Budget max should be extracted as 3000');

  const retrieved = await retrieveProductData('running shoes');
  const filtered = {
    ...retrieved,
    products: retrieved.products.filter(p => p.price <= 3000)
  };

  const res = await generateVerifiedResponse({
    userMessage: query,
    intent: parsed.intent,
    entity: parsed.entity,
    retrievedData: filtered.products.length > 0 ? filtered : retrieved,
    historyStats: null
  });

  assert.ok(res.text.includes('₹'), 'Must list prices in ₹');
  assert.ok(res.cards.length > 0);
});

test('Benchmark 7: "Is this a good time to buy a fridge?"', async () => {
  const query = "Is this a good time to buy a fridge?";
  const parsed = parseQueryRuleBased(query);

  assert.equal(parsed.intent, 'should_i_buy');
  const retrieved = await retrieveProductData('refrigerator');

  const res = await generateVerifiedResponse({
    userMessage: query,
    intent: parsed.intent,
    entity: parsed.entity,
    retrievedData: retrieved,
    historyStats: null
  });

  assert.ok(res.text.toLowerCase().includes('buy') || res.text.toLowerCase().includes('deal'));
});

test('Benchmark 8: "Which site gives the best discount on Nike shoes?"', async () => {
  const query = "Which site gives the best discount on Nike shoes?";
  const parsed = parseQueryRuleBased(query);

  assert.ok(['best_deal', 'offers_discounts', 'compare_platforms'].includes(parsed.intent));
  const retrieved = await retrieveProductData('Nike shoes');

  const res = await generateVerifiedResponse({
    userMessage: query,
    intent: parsed.intent,
    entity: parsed.entity,
    retrievedData: retrieved,
    historyStats: null
  });

  assert.ok(res.text.includes('Best Deal') || res.text.includes('₹') || res.text.includes('best price') || res.text.includes('discount'));
});

test('Benchmark 9: "Tell me the specs of the Redmi Note 13"', async () => {
  const query = "Tell me the specs of the Redmi Note 13";
  const parsed = parseQueryRuleBased(query);

  assert.equal(parsed.intent, 'specifications');
  const retrieved = await retrieveProductData('Redmi Note 13');
  assert.ok(retrieved.products.length > 0);

  const res = await generateVerifiedResponse({
    userMessage: query,
    intent: parsed.intent,
    entity: parsed.entity,
    retrievedData: retrieved,
    historyStats: null
  });

  assert.ok(res.text.includes('Specifications') || res.text.includes('Rating'));
  assert.ok(res.cards.length > 0);
});

test('Benchmark 10: "What are trending products today?"', async () => {
  const query = "What are trending products today?";
  const parsed = parseQueryRuleBased(query);

  assert.equal(parsed.intent, 'trending');

  const res = await generateVerifiedResponse({
    userMessage: query,
    intent: parsed.intent,
    entity: parsed.entity,
    retrievedData: { products: [] },
    historyStats: null
  });

  assert.ok(res.text.length > 10);
  assert.ok(res.chips.length > 0);
});

test('Benchmark 11: "Similar cheaper alternatives to boAt Airdopes 141"', async () => {
  const query = "Similar cheaper alternatives to boAt Airdopes 141";
  const parsed = parseQueryRuleBased(query);

  assert.equal(parsed.intent, 'alternatives');
  const retrieved = await retrieveProductData('boAt Airdopes');

  const res = await generateVerifiedResponse({
    userMessage: query,
    intent: parsed.intent,
    entity: parsed.entity,
    retrievedData: retrieved,
    historyStats: null
  });

  assert.ok(res.text.includes('alternatives') || res.text.includes('Found'));
  assert.ok(res.cards.length > 0);
});

test('Numerical Verification Gatekeeper rejects hallucinated prices', () => {
  const groundTruth = new Set([79900, 82900, 4, 1840]);

  // Hallucinated price: ₹45,000 does NOT exist in ground truth
  const hallucinatedCandidate = "The Apple iPhone 16 is available for ₹45,000 on Amazon with 60% discount.";
  const passed = verifyCandidateResponse(hallucinatedCandidate, groundTruth);
  assert.equal(passed, false, 'Gatekeeper must reject text with hallucinated prices');

  // Valid ground truth text: ₹79,900 exists
  const validCandidate = "The Apple iPhone 16 is available for ₹79,900 on Amazon.";
  const validPassed = verifyCandidateResponse(validCandidate, groundTruth);
  assert.equal(validPassed, true, 'Gatekeeper must accept text matching verified ground truth');
});
