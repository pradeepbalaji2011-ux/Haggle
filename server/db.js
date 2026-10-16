/**
 * server/db.js — SQLite Database Connection, Schema Migrations, and Model Queries
 *
 * Uses modern async SQLite (sqlite + sqlite3) with WAL mode enabled.
 * Tables:
 *   - users: Accounts and credentials
 *   - wishlist: Saved products per user
 *   - price_history: Historical price tracking across retailers
 *
 * Automatically migrates existing records from data/users.json on startup.
 */

import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'haggle.sqlite');

let dbInstance = null;

/**
 * Get or open the SQLite database connection
 */
export async function getDb() {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  dbInstance = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  // Enable Write-Ahead Logging for improved concurrency and performance
  await dbInstance.run('PRAGMA journal_mode = WAL;');
  await dbInstance.run('PRAGMA foreign_keys = ON;');

  return dbInstance;
}

/**
 * Initialize database schema and run automatic migrations
 */
export async function initDb() {
  const db = await getDb();

  // Create Users Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create Wishlist Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price TEXT,
      store TEXT,
      image TEXT,
      buy_url TEXT,
      saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);
  `);

  // Create Price History Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT,
      name TEXT NOT NULL,
      store TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_price_history_pid ON price_history(product_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_price_history_name ON price_history(name, recorded_at);
  `);

  // Migrate legacy data/users.json if database has 0 users
  await migrateLegacyJson(db);

  return db;
}

/**
 * Automatically import users & wishlist items from JSON files if database users table is empty
 */
async function migrateLegacyJson(db) {
  try {
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    if (userCount && userCount.count > 0) {
      return; // Already migrated or has users
    }

    // Check potential legacy paths
    const legacyPaths = [
      path.join(DATA_DIR, 'users.json'),
      path.join(__dirname, 'data/users.json')
    ];

    for (const legacyPath of legacyPaths) {
      if (fs.existsSync(legacyPath)) {
        const raw = fs.readFileSync(legacyPath, 'utf8');
        const legacyUsers = JSON.parse(raw);
        if (Array.isArray(legacyUsers) && legacyUsers.length > 0) {
          console.log(`[Database Migration] Migrating ${legacyUsers.length} users from ${legacyPath}...`);

          for (const u of legacyUsers) {
            const userId = String(u.id || `u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
            const name = u.name || (u.email ? u.email.split('@')[0] : 'User');
            const email = (u.email || '').toLowerCase().trim();
            const password = u.password || u.passwordHash;

            if (email && password) {
              await db.run(
                `INSERT OR IGNORE INTO users (id, name, email, password, created_at) VALUES (?, ?, ?, ?, ?)`,
                [userId, name, email, password, u.createdAt || new Date().toISOString()]
              );

              // Migrate user's wishlist
              if (Array.isArray(u.wishlist)) {
                for (const item of u.wishlist) {
                  if (item && (item.id || item.productId)) {
                    await db.run(
                      `INSERT OR IGNORE INTO wishlist (user_id, product_id, name, price, store, image, buy_url, saved_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        userId,
                        String(item.id || item.productId),
                        item.name || item.title || 'Product',
                        item.price != null ? String(item.price) : null,
                        item.store || null,
                        item.image || null,
                        item.buyUrl || item.url || null,
                        item.savedAt || new Date().toISOString()
                      ]
                    );
                  }
                }
              }
            }
          }

          // Backup legacy file
          try {
            const backupPath = `${legacyPath}.migrated.bak`;
            fs.copyFileSync(legacyPath, backupPath);
            console.log(`[Database Migration] Backed up ${legacyPath} to ${backupPath}`);
          } catch (e) {
            console.warn(`[Database Migration] Could not create backup file:`, e.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Database Migration Error]:', err);
  }
}

// ==========================================
// USER REPOSITORY
// ==========================================

export async function findUserByEmail(email) {
  const db = await getDb();
  return db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
}

export async function findUserById(id) {
  const db = await getDb();
  return db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [String(id)]);
}

export async function createUser({ name, email, password }) {
  const db = await getDb();
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await db.get('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
  if (existing) {
    const error = new Error('EMAIL_TAKEN');
    error.code = 'EMAIL_TAKEN';
    throw error;
  }

  const id = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db.run(
    `INSERT INTO users (id, name, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [id, name.trim(), normalizedEmail, password]
  );

  return { id, name: name.trim(), email: normalizedEmail };
}

export async function updateUserProfile(id, { name }) {
  const db = await getDb();
  await db.run(
    `UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [name.trim(), String(id)]
  );
  return findUserById(id);
}

export async function updateUserPassword(id, newPasswordHash) {
  const db = await getDb();
  await db.run(
    `UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [newPasswordHash, String(id)]
  );
}

// ==========================================
// WISHLIST REPOSITORY
// ==========================================

export async function getUserWishlist(userId) {
  const db = await getDb();
  const rows = await db.all(
    `SELECT product_id as id, name, price, store, image, buy_url as buyUrl, saved_at as savedAt
     FROM wishlist
     WHERE user_id = ?
     ORDER BY saved_at DESC`,
    [String(userId)]
  );
  return rows || [];
}

export async function addToWishlist(userId, product) {
  const db = await getDb();
  const productId = String(product.id || product.productId);
  if (!productId) throw new Error('Product ID required');

  await db.run(
    `INSERT INTO wishlist (user_id, product_id, name, price, store, image, buy_url, saved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, product_id) DO UPDATE SET
       name = excluded.name,
       price = excluded.price,
       store = excluded.store,
       image = excluded.image,
       buy_url = excluded.buy_url,
       saved_at = CURRENT_TIMESTAMP`,
    [
      String(userId),
      productId,
      product.name || product.title || 'Product',
      product.price != null ? String(product.price) : null,
      product.store || null,
      product.image || null,
      product.buyUrl || product.url || null
    ]
  );

  return getUserWishlist(userId);
}

export async function removeFromWishlist(userId, productId) {
  const db = await getDb();
  await db.run(
    `DELETE FROM wishlist WHERE user_id = ? AND product_id = ?`,
    [String(userId), String(productId)]
  );
  return getUserWishlist(userId);
}

export async function setUserWishlist(userId, items) {
  const db = await getDb();
  const uid = String(userId);

  await db.run('BEGIN TRANSACTION');
  try {
    await db.run('DELETE FROM wishlist WHERE user_id = ?', [uid]);

    if (Array.isArray(items)) {
      for (const item of items) {
        const pid = String(item.id || item.productId);
        if (pid) {
          await db.run(
            `INSERT OR REPLACE INTO wishlist (user_id, product_id, name, price, store, image, buy_url, saved_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uid,
              pid,
              item.name || item.title || 'Product',
              item.price != null ? String(item.price) : null,
              item.store || null,
              item.image || null,
              item.buyUrl || item.url || null,
              item.savedAt || new Date().toISOString()
            ]
          );
        }
      }
    }

    await db.run('COMMIT');
  } catch (err) {
    await db.run('ROLLBACK');
    throw err;
  }

  return getUserWishlist(userId);
}

// ==========================================
// PRICE HISTORY REPOSITORY
// ==========================================

export async function recordPrices(products) {
  if (!Array.isArray(products) || products.length === 0) return 0;
  const db = await getDb();

  let count = 0;
  await db.run('BEGIN TRANSACTION');
  try {
    for (const item of products) {
      const priceNum = typeof item.price === 'number' ? item.price : Number(String(item.price || '').replace(/[^\d.]/g, ''));
      if (Number.isFinite(priceNum) && priceNum > 0 && item.name && item.store) {
        await db.run(
          `INSERT INTO price_history (product_id, name, store, price, currency, recorded_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            item.productId || item.id ? String(item.productId || item.id) : null,
            item.name.slice(0, 200),
            item.store.slice(0, 100),
            priceNum,
            item.currency || 'INR'
          ]
        );
        count++;
      }
    }
    await db.run('COMMIT');
  } catch (err) {
    await db.run('ROLLBACK');
    console.error('Failed to record price history:', err.message);
  }

  return count;
}

export async function getPriceHistory(productId, limit = 50) {
  const db = await getDb();
  const pid = String(productId);

  const rows = await db.all(
    `SELECT id, product_id, name, store, price, currency, recorded_at
     FROM price_history
     WHERE product_id = ?
     ORDER BY recorded_at ASC
     LIMIT ?`,
    [pid, limit]
  );

  return rows || [];
}
