/**
 * routes/wishlist.js — Wishlist API (protected routes)
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, '../../data/users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'haggle_super_secret_key_123';

function getUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (e) { return []; }
}

function saveUsers(users) {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Get user wishlist
router.get('/', authenticateToken, (req, res) => {
  const users = getUsers();
  const user = users.find(u => u.id === req.user.id);
  res.json({ wishlist: user ? (user.wishlist || []) : [] });
});

// Save user wishlist (full array)
router.post('/', authenticateToken, (req, res) => {
  const { wishlist } = req.body;
  if (!Array.isArray(wishlist)) return res.status(400).json({ error: 'Invalid wishlist data' });

  const users = getUsers();
  const user = users.find(u => u.id === req.user.id);
  if (user) {
    user.wishlist = wishlist;
    saveUsers(users);
    return res.json({ success: true, wishlist: user.wishlist });
  }
  res.status(404).json({ error: 'User not found' });
});

// 👇 ADD THIS: Add single product to user wishlist
router.post('/add', authenticateToken, (req, res) => {
  const { product } = req.body;
  if (!product || !product.id) return res.status(400).json({ error: 'Invalid product data' });

  const users = getUsers();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!user.wishlist) user.wishlist = [];
  if (!user.wishlist.some(p => p.id === product.id)) {
    user.wishlist.push({ ...product, savedAt: new Date().toISOString() });
    saveUsers(users);
  }

  return res.json({ success: true, wishlist: user.wishlist });
});

// 👇 ADD THIS: Remove single product from user wishlist
router.delete('/remove/:id', authenticateToken, (req, res) => {
  const productId = req.params.id;

  const users = getUsers();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.wishlist = (user.wishlist || []).filter(p => p.id !== productId);
  saveUsers(users);

  return res.json({ success: true, wishlist: user.wishlist });
});

export default router;