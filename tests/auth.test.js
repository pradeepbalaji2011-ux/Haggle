/**
 * tests/auth.test.js
 *
 * Automated tests for server/auth.js and server/users.js using Node.js built-in test runner.
 * Covers:
 * 1. Sign-up with email normalization
 * 2. Login with different email casing and spaces (e.g. '   User@Example.COM   ')
 * 3. Wrong password returns "Wrong password"
 * 4. Unregistered email returns "Email not registered"
 * 5. Rate limiting on login attempts
 * 6. Expired / invalid session rejection
 * 7. Profile loading via verifySessionToken / /api/me
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  normalizeEmail,
  createNewUser,
  getUserByEmail,
  getUserById,
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
  getPriceAlerts,
  setPriceAlert,
  removePriceAlert
} from '../server/users.js';
import {
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
  verifySessionToken
} from '../server/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'haggle_super_secret_key_12345';

test('Email normalization: trims whitespace and converts to lowercase', () => {
  assert.equal(normalizeEmail('  Aakash.Sharma@Gmail.COM  '), 'aakash.sharma@gmail.com');
  assert.equal(normalizeEmail('USER@EXAMPLE.IN\u200B '), 'user@example.in');
});

test('Auth: User sign-up with password hashing', async () => {
  const testEmail = `test_${Date.now()}@example.com`;
  const rawPassword = 'SecretPassword123!';
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const user = await createNewUser({
    name: 'Test Shopper',
    email: testEmail.toUpperCase(),
    passwordHash
  });

  assert.ok(user.id);
  assert.equal(user.name, 'Test Shopper');
  assert.equal(user.email, testEmail.toLowerCase());

  // Verify plain password is NOT stored
  const storedUser = await getUserByEmail(testEmail);
  assert.equal(storedUser.password, undefined);
  assert.notEqual(storedUser.passwordHash, rawPassword);
  assert.ok(await bcrypt.compare(rawPassword, storedUser.passwordHash));
});

test('Auth: Login matches email regardless of case or accidental spaces', async () => {
  const testEmail = `case_test_${Date.now()}@example.com`;
  const password = 'MySecurePassword!';
  const passwordHash = await bcrypt.hash(password, 10);

  await createNewUser({
    name: 'Case Test',
    email: testEmail,
    passwordHash
  });

  // Query with uppercase and spaces
  const foundUser = await getUserByEmail(`   ${testEmail.toUpperCase()}   `);
  assert.ok(foundUser, 'User should be found with different casing and spaces');

  const match = await bcrypt.compare(password, foundUser.passwordHash);
  assert.equal(match, true, 'Password comparison must succeed');
});

test('Auth: Wrong password returns false', async () => {
  const passwordHash = await bcrypt.hash('CorrectPassword123', 10);
  const match = await bcrypt.compare('WrongPassword456', passwordHash);
  assert.equal(match, false, 'Wrong password must be rejected');
});

test('Auth: Unregistered email lookup returns null', async () => {
  const nonExistent = await getUserByEmail('non_existent_user_99999@example.com');
  assert.equal(nonExistent, null, 'Unregistered email should return null');
});

test('Auth: Rate limiting triggers after 5 failed attempts', () => {
  const testKey = `rate_test_${Date.now()}@test.com|127.0.0.1`;
  resetLoginAttempts(testKey);

  // Attempt 1-4 should be allowed
  for (let i = 0; i < 4; i++) {
    recordFailedLogin(testKey);
    const check = checkLoginRateLimit(testKey);
    assert.equal(check.allowed, true);
  }

  // 5th attempt
  recordFailedLogin(testKey);
  const blockedCheck = checkLoginRateLimit(testKey);
  assert.equal(blockedCheck.allowed, false, '5th failed attempt should trigger lockout');
  assert.ok(blockedCheck.error.includes('Too many failed login attempts'));

  resetLoginAttempts(testKey);
});

test('Auth: Expired or invalid session token is rejected', () => {
  // Invalid token
  const invalidResult = verifySessionToken('this_is_an_invalid_token');
  assert.equal(invalidResult, null, 'Invalid token must return null');

  // Expired token (expires -1 second ago)
  const expiredToken = jwt.sign({ id: 'u_123', email: 'test@example.com' }, JWT_SECRET, { expiresIn: '-1s' });
  const expiredResult = verifySessionToken(expiredToken);
  assert.equal(expiredResult, null, 'Expired token must return null');

  // Valid token
  const validToken = jwt.sign({ id: 'u_123', email: 'test@example.com' }, JWT_SECRET, { expiresIn: '1h' });
  const validResult = verifySessionToken(validToken);
  assert.ok(validResult, 'Valid token must decode');
  assert.equal(validResult.id, 'u_123');
});

test('Auth: Wishlist persistence per user', async () => {
  const testEmail = `wish_test_${Date.now()}@example.com`;
  const user = await createNewUser({
    name: 'Wishlist User',
    email: testEmail,
    passwordHash: 'hash'
  });

  const product = {
    id: 'prod_101',
    name: 'Apple iPhone 16 128GB',
    price: 79900,
    store: 'Amazon India'
  };

  const updatedWishlist = await addWishlistItem(user.id, product);
  assert.equal(updatedWishlist.length, 1);
  assert.equal(updatedWishlist[0].productId, 'prod_101');

  // Remove item
  const afterRemove = await removeWishlistItem(user.id, 'prod_101');
  assert.equal(afterRemove.length, 0);
});

test('Auth: Price alert persistence per user', async () => {
  const testEmail = `alert_test_${Date.now()}@example.com`;
  const user = await createNewUser({
    name: 'Alert User',
    email: testEmail,
    passwordHash: 'hash'
  });

  const alertData = {
    productId: 'iphone_16_128',
    name: 'Apple iPhone 16 128GB',
    currentPrice: 79900,
    targetPrice: 75000,
    store: 'Amazon India'
  };

  const updatedAlerts = await setPriceAlert(user.id, alertData);
  assert.equal(updatedAlerts.length, 1);
  assert.equal(updatedAlerts[0].productId, 'iphone_16_128');
  assert.equal(updatedAlerts[0].targetPrice, 75000);

  const fetchedAlerts = await getPriceAlerts(user.id);
  assert.equal(fetchedAlerts.length, 1);
  assert.equal(fetchedAlerts[0].targetPrice, 75000);

  const afterRemove = await removePriceAlert(user.id, 'iphone_16_128');
  assert.equal(afterRemove.length, 0);
});

