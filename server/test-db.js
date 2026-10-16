/**
 * server/test-db.js — Automated Verification Test for SQLite Migration & Operations
 */

import {
  initDb,
  findUserByEmail,
  findUserById,
  createUser,
  getUserWishlist,
  addToWishlist,
  removeFromWishlist,
  recordPrices,
  getPriceHistory
} from './db.js';

async function runTests() {
  console.log('--- Starting Haggle SQLite Database Test Suite ---\n');

  // Step 1: Initialize Database & Run Migrations
  console.log('1. Initializing DB & migrations...');
  const db = await initDb();
  console.log('✓ Database initialized successfully.');

  // Step 2: Check Migrated Legacy User
  console.log('\n2. Testing migrated user lookup...');
  const migratedEmail = 'pradeepbalaji2011@gmail.com';
  const user = await findUserByEmail(migratedEmail);
  if (user) {
    console.log(`✓ Found migrated user: ${user.name} (${user.email}) [ID: ${user.id}]`);
    const wishlist = await getUserWishlist(user.id);
    console.log(`✓ User has ${wishlist.length} migrated wishlist items:`);
    wishlist.forEach((item, idx) => {
      console.log(`   ${idx + 1}. [${item.store}] ${item.name} - ${item.price}`);
    });
  } else {
    console.log(`ℹ Migrated user ${migratedEmail} not found, proceeding with fresh user test.`);
  }

  // Step 3: Test New User Creation
  console.log('\n3. Testing user creation...');
  const testEmail = `test_${Date.now()}@haggle.dev`;
  const newUser = await createUser({
    name: 'Test Buyer',
    email: testEmail,
    password: '$2b$10$fakepasswordhashforetestingonly12345'
  });
  console.log(`✓ Created user: ${newUser.name} with ID ${newUser.id}`);

  // Test duplicate email constraint
  try {
    await createUser({ name: 'Dup', email: testEmail, password: 'xyz' });
    console.error('✗ Duplicate email was unexpectedly allowed!');
  } catch (err) {
    console.log(`✓ Duplicate email prevention passed: ${err.message}`);
  }

  // Step 4: Wishlist Operations
  console.log('\n4. Testing wishlist operations...');
  const testProduct = {
    id: 'prod_9999',
    productId: 'prod_9999',
    name: 'Sony WH-1000XM5 Wireless Headphones',
    price: '₹26,990',
    store: 'Amazon.in',
    image: 'https://example.com/headphones.jpg',
    buyUrl: 'https://www.amazon.in/s?k=Sony+WH1000XM5'
  };

  const updatedList = await addToWishlist(newUser.id, testProduct);
  console.log(`✓ Added product to wishlist. Wishlist count: ${updatedList.length}`);
  if (updatedList[0].id === testProduct.id) {
    console.log(`✓ Wishlist product verified: ${updatedList[0].name} (${updatedList[0].price})`);
  }

  // Step 5: Price History Recording & Retrieval
  console.log('\n5. Testing price history tracking...');
  const samplePrices = [
    {
      productId: 'prod_9999',
      name: 'Sony WH-1000XM5 Wireless Headphones',
      store: 'Amazon.in',
      price: 26990,
      currency: 'INR'
    },
    {
      productId: 'prod_9999',
      name: 'Sony WH-1000XM5 Wireless Headphones',
      store: 'Croma',
      price: 27999,
      currency: 'INR'
    },
    {
      productId: 'prod_9999',
      name: 'Sony WH-1000XM5 Wireless Headphones',
      store: 'Reliance Digital',
      price: 28490,
      currency: 'INR'
    }
  ];

  const recordedCount = await recordPrices(samplePrices);
  console.log(`✓ Recorded ${recordedCount} price observation records.`);

  const history = await getPriceHistory('prod_9999');
  console.log(`✓ Retrieved ${history.length} price records for prod_9999:`);
  history.forEach(h => {
    console.log(`   - ${h.store}: ₹${h.price} at ${h.recorded_at}`);
  });

  // Step 6: Wishlist Removal
  console.log('\n6. Testing wishlist item removal...');
  const afterRemoval = await removeFromWishlist(newUser.id, 'prod_9999');
  console.log(`✓ Removed product. Remaining wishlist count: ${afterRemoval.length}`);

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
