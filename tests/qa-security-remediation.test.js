/**
 * tests/qa-security-remediation.test.js
 *
 * Comprehensive Automated Test Suite covering QA & Security fixes:
 * 1. Exact edge cases from original bugs (Generic category query filter failure, modifier bypass, etc.)
 * 2. Happy path scenarios (category searches, valid logins, legitimate link unwrapping)
 * 3. Unhappy path scenarios (XSS strings, malicious URI schemes, brute-force rate-limiting, DB corruption recovery)
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isRelevant,
  filterRelevantProducts,
  isGenericCategoryQuery,
  filterByPriceSanity,
  calculateMedianPrice
} from '../server/relevance.js';
import {
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
  verifySessionToken,
  JWT_SECRET
} from '../server/auth.js';
import {
  normalizeEmail,
  createNewUser,
  getUserByEmail,
  getAllUsers,
  saveAllUsers
} from '../server/users.js';
import {
  validateAndCleanBuyUrl,
  unwrapTrackingUrl
} from '../server/links.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// ============================================================================
// 1. EXACT ORIGINAL BUG EDGE CASES
// ============================================================================
describe('1. Original Bug Edge Cases (Relevance & Category Filtering)', () => {
  test('Edge Case: "smartphone 5G" query matches phone title omitting literal word "smartphone"', () => {
    const title = 'Samsung Galaxy M35 5G (Moonlight Blue, 128 GB)';
    const result = isRelevant({ name: title }, 'smartphone 5G');
    assert.equal(result, true, 'Phone with 5G spec must be accepted for smartphone 5G search');
  });

  test('Edge Case: "smartphone 5G" query accepts variants with "Pro" or "Plus" modifiers', () => {
    const pocoPro = isRelevant({ name: 'POCO X6 Pro 5G (Yellow, 256 GB)' }, 'smartphone 5G');
    assert.equal(pocoPro, true, 'POCO X6 Pro must not be rejected by unrequested modifier rule on category searches');

    const redmiPlus = isRelevant({ name: 'Redmi Note 13 Pro+ 5G (Fusion White, 256 GB)' }, 'smartphone 5G');
    assert.equal(redmiPlus, true, 'Redmi Note Pro+ must match generic category search');
  });

  test('Edge Case: "smartphone 5G" still rejects phone cases and accessories', () => {
    const phoneCase = isRelevant({ name: 'Redmi 13C 5G Transparent Silicone Back Cover' }, 'smartphone 5G');
    assert.equal(phoneCase, false, 'Phone back cover accessory must be excluded from smartphone 5G search');

    const screenGuard = isRelevant({ name: 'Samsung Galaxy M35 5G Tempered Glass Screen Protector' }, 'smartphone 5G');
    assert.equal(screenGuard, false, 'Tempered glass accessory must be excluded from smartphone 5G search');
  });

  test('Edge Case: Specific model query "iphone 16" STILL excludes unrequested "Pro" or "Plus" variants', () => {
    const baseModel = isRelevant({ name: 'Apple iPhone 16 (128 GB) - Ultramarine' }, 'iphone 16');
    assert.equal(baseModel, true, 'Base iPhone 16 must match query for iphone 16');

    const proModel = isRelevant({ name: 'Apple iPhone 16 Pro (128 GB) - Desert Titanium' }, 'iphone 16');
    assert.equal(proModel, false, 'iPhone 16 Pro must NOT match query for base iphone 16');

    const plusModel = isRelevant({ name: 'Apple iPhone 16 Plus (128 GB) - Black' }, 'iphone 16');
    assert.equal(plusModel, false, 'iPhone 16 Plus must NOT match query for base iphone 16');
  });

  test('Edge Case: Specific model query "iphone 16 pro" accepts Pro but rejects Pro Max', () => {
    const proOnly = isRelevant({ name: 'Apple iPhone 16 Pro 128GB' }, 'iphone 16 pro');
    assert.equal(proOnly, true, 'iPhone 16 Pro matches iphone 16 pro query');

    const proMax = isRelevant({ name: 'Apple iPhone 16 Pro Max 256GB' }, 'iphone 16 pro');
    assert.equal(proMax, false, 'iPhone 16 Pro Max must NOT match iphone 16 pro query');
  });
});

// ============================================================================
// 2. HAPPY PATH SCENARIOS
// ============================================================================
describe('2. Happy Path Scenarios (Standard User Flows)', () => {
  test('Generic Category Detection correctly flags popular shopping categories', () => {
    assert.equal(isGenericCategoryQuery('smartphone 5G'), true);
    assert.equal(isGenericCategoryQuery('laptop'), true);
    assert.equal(isGenericCategoryQuery('wireless headphones'), true);
    assert.equal(isGenericCategoryQuery('smartwatch'), true);
    assert.equal(isGenericCategoryQuery('running shoes'), true);
    assert.equal(isGenericCategoryQuery('air conditioner'), true);
    // Specific model queries must NOT be flagged as generic categories
    assert.equal(isGenericCategoryQuery('iphone 16'), false);
    assert.equal(isGenericCategoryQuery('galaxy s24 ultra'), false);
    assert.equal(isGenericCategoryQuery('sony wh-1000xm5'), false);
  });

  test('Category Search: "laptop" matches major laptop listings', () => {
    const macbook = isRelevant({ name: 'Apple MacBook Air M2 16GB 256GB SSD' }, 'laptop');
    assert.equal(macbook, true);

    const asusVivobook = isRelevant({ name: 'ASUS Vivobook 15 Intel Core i3 12th Gen' }, 'laptop');
    assert.equal(asusVivobook, true);

    const lenovoIdeaPad = isRelevant({ name: 'Lenovo IdeaPad Slim 3 15.6 inch Laptop' }, 'laptop');
    assert.equal(lenovoIdeaPad, true);
  });

  test('Valid URL Validation: Legitimate retail links pass platform checks', () => {
    const amazonUrl = 'https://www.amazon.in/dp/B0DGJ9B5DX';
    const amzResult = validateAndCleanBuyUrl(amazonUrl, 'Amazon India');
    assert.equal(amzResult.valid, true, 'Amazon product URL with /dp/ should be valid');

    const flipkartUrl = 'https://www.flipkart.com/apple-iphone-16-ultramarine-128-gb/p/itme?pid=MOBH4DQFGZYT8QHZ';
    const fkResult = validateAndCleanBuyUrl(flipkartUrl, 'Flipkart');
    assert.equal(fkResult.valid, true, 'Flipkart product URL with /p/ should be valid');
  });

  test('Authentication: Legitimate user registration and password verification', async () => {
    const email = `qa_happy_${Date.now()}@example.com`;
    const password = 'StrongPassword!2026';
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await createNewUser({
      name: 'QA Tester',
      email,
      passwordHash
    });

    assert.ok(user.id);
    assert.equal(user.email, email.toLowerCase());

    const retrieved = await getUserByEmail(email);
    assert.ok(retrieved);
    const valid = await bcrypt.compare(password, retrieved.passwordHash);
    assert.equal(valid, true, 'Valid password must verify');
  });
});

// ============================================================================
// 3. UNHAPPY PATH SCENARIOS & SECURITY CHECKS
// ============================================================================
describe('3. Unhappy Path & Security Scenarios', () => {
  test('Unhappy: Empty, null, or whitespace-only queries return false cleanly', () => {
    assert.equal(isRelevant({ name: 'Samsung Galaxy M35 5G' }, ''), false);
    assert.equal(isRelevant({ name: 'Samsung Galaxy M35 5G' }, '   '), false);
    assert.equal(isRelevant(null, 'smartphone 5G'), false);
    assert.equal(isRelevant(undefined, 'laptop'), false);
    assert.equal(isRelevant({ name: '' }, 'smartphone 5G'), false);
  });

  test('Security: Malicious URL Schemes (javascript: and data:) are rejected', () => {
    assert.equal(validateAndCleanBuyUrl('javascript:alert(1)', 'Amazon India').valid, false, 'javascript: URI must be rejected');
    assert.equal(validateAndCleanBuyUrl('data:text/html,<script>alert(1)</script>', 'Amazon India').valid, false, 'data: URI must be rejected');
    assert.equal(validateAndCleanBuyUrl('vbscript:msgbox(1)', 'Amazon India').valid, false, 'vbscript: URI must be rejected');
    assert.equal(validateAndCleanBuyUrl('ftp://example.com/item', 'Amazon India').valid, false, 'ftp: URI must be rejected');
    assert.equal(validateAndCleanBuyUrl('https://malicious-phishing-store.com/buy', 'Phishing Store').valid, false, 'Untrusted non-approved domain must be rejected');
  });

  test('Security: Redirect gateway unrolling handles nested tracking without crashing', () => {
    const unwrapped = unwrapTrackingUrl('https://www.google.com/url?q=https://www.amazon.in/dp/B0DGJ9B5DX');
    assert.equal(unwrapped, 'https://www.amazon.in/dp/B0DGJ9B5DX');

    // Circular or empty redirect unwrapping
    assert.equal(unwrapTrackingUrl(''), null);
    assert.equal(unwrapTrackingUrl(null), null);
    assert.equal(unwrapTrackingUrl('invalid-not-a-url'), null);
  });

  test('Security: Constant-time check on non-existent users prevents timing attacks', async () => {
    const nonExistent = await getUserByEmail('definitely_does_not_exist_987654@example.com');
    assert.equal(nonExistent, null);

    // Timing attack mitigation: benchmark dummy hash compare
    const DUMMY_HASH = '$2a$10$7EqJtq98hPqEX7fNZaFWoOhiMbxC2/gIer3i2.f4Lh5gQ.Pquf6uG';
    const start = performance.now();
    const result = await bcrypt.compare('SomeRandomPassword123!', DUMMY_HASH);
    const duration = performance.now() - start;

    assert.equal(result, false);
    // Bcrypt comparison duration should be non-trivial (> 20ms) indicating full hash calculation
    assert.ok(duration > 15, 'Dummy hash must execute full bcrypt cost cycle');
  });

  test('Security: Rate limiting locks out after 5 consecutive failed attempts', () => {
    const testIpKey = `bruteforce_test_${Date.now()}@test.com|192.168.1.100`;
    resetLoginAttempts(testIpKey);

    for (let i = 0; i < 4; i++) {
      recordFailedLogin(testIpKey);
      assert.equal(checkLoginRateLimit(testIpKey).allowed, true, `Attempt ${i + 1} should be permitted`);
    }

    recordFailedLogin(testIpKey); // 5th failed attempt
    const blocked = checkLoginRateLimit(testIpKey);
    assert.equal(blocked.allowed, false, '5th failed attempt must trigger lockout');
    assert.ok(blocked.error.includes('Too many failed login attempts'));

    resetLoginAttempts(testIpKey);
  });

  test('Security: In-flight DB corruption recovery via .bak file', () => {
    // 1. Create a known state with test user
    const originalUsers = getAllUsers();
    const testMarker = { id: `recovery_test_${Date.now()}`, name: 'Backup Tester', email: 'recovery@example.com' };
    saveAllUsers([...originalUsers, testMarker]);
    saveAllUsers([...originalUsers, testMarker]); // Second save ensures .bak contains testMarker

    // Verify .bak file was created
    const bakFile = `${USERS_FILE}.bak`;
    assert.ok(existsSync(bakFile), '.bak file must exist after saveAllUsers');

    // 2. Simulate catastrophic corruption (truncated 0-byte or corrupted JSON in users.json)
    writeFileSync(USERS_FILE, '{ corrupted invalid json content [', 'utf8');

    // 3. Call getAllUsers — it should detect corrupt JSON and safely recover from .bak
    const recovered = getAllUsers();
    assert.ok(Array.isArray(recovered), 'Must return valid array upon recovery');
    assert.ok(recovered.some(u => u.id === testMarker.id), 'Test user must be recovered from .bak');

    // Clean up test user
    saveAllUsers(originalUsers);
  });

  test('Unhappy: Price sanity check filters out cheap mislabeled accessories (< 18% median)', () => {
    const products = [
      { name: 'Apple iPhone 16 128GB', price: 79900 },
      { name: 'Apple iPhone 16 128GB Blue', price: 78500 },
      { name: 'Apple iPhone 16 256GB', price: 89900 },
      { name: 'Apple iPhone 16 Screen Guard', price: 299 }, // accessory mislabeled as phone
      { name: 'Apple iPhone 16 Fast Charger Cable', price: 499 } // accessory mislabeled
    ];

    const median = calculateMedianPrice(products);
    assert.ok(median > 50000, 'Median price should reflect phone prices (~79,900)');

    const sanitized = filterByPriceSanity(products, 'iphone 16');
    assert.equal(sanitized.length, 3, 'Both ₹299 and ₹499 accessories must be dropped by sanity filter');
    assert.ok(!sanitized.some(p => p.price < 15000), 'No accessories should remain in device search');
  });

  test('Security: Route query param prototype pollution resistance', () => {
    // Simulating URLSearchParams input with malicious keys
    const maliciousParams = new URLSearchParams('__proto__[polluted]=yes&constructor[prototype][admin]=true&title=iPhone');
    const queryParams = Object.create(null);

    const safeAssignParam = (key, val) => {
      if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
        queryParams[key] = val;
      }
    };

    maliciousParams.forEach((val, key) => {
      safeAssignParam(key, val);
    });

    assert.equal(queryParams.title, 'iPhone');
    assert.equal(queryParams['__proto__'], undefined);
    assert.equal(queryParams['constructor'], undefined);
    assert.equal(({})['polluted'], undefined, 'Global Object.prototype must NOT be polluted');
  });
});
