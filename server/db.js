/**
 * db.js — Lightweight JSON-file user database
 *
 * Stores users as a JSON array in server/data/users.json
 * No external database required — works out of the box on Render.
 * Each user: { id, name, email, passwordHash, wishlist[], createdAt }
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'users.json');

function ensureFile() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) writeFileSync(DB_FILE, '[]', 'utf8');
}

function readAll() {
  ensureFile();
  try {
    return JSON.parse(readFileSync(DB_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeAll(users) {
  ensureFile();
  writeFileSync(DB_FILE, JSON.stringify(users, null, 2), 'utf8');
}

export function findByEmail(email) {
  return readAll().find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export function findById(id) {
  return readAll().find(u => u.id === id) || null;
}

export function createUser({ name, email, passwordHash }) {
  const users = readAll();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('EMAIL_TAKEN');
  }
  const user = {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    wishlist: [],
    createdAt: new Date().toISOString()
  };
  users.push(user);
  writeAll(users);
  return user;
}

export function addToWishlist(userId, product) {
  const users = readAll();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) throw new Error('USER_NOT_FOUND');

  const list = users[idx].wishlist || [];
  // Avoid duplicates by id
  if (!list.find(p => p.id === product.id)) {
    list.push({ ...product, savedAt: new Date().toISOString() });
    users[idx].wishlist = list;
    writeAll(users);
  }
  return users[idx].wishlist;
}

export function removeFromWishlist(userId, productId) {
  const users = readAll();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) throw new Error('USER_NOT_FOUND');

  users[idx].wishlist = (users[idx].wishlist || []).filter(p => p.id !== productId);
  writeAll(users);
  return users[idx].wishlist;
}

export function getWishlist(userId) {
  const user = findById(userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  return user.wishlist || [];
}
