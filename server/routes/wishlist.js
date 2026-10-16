/**
 * routes/wishlist.js — Wishlist API (SQLite-backed, protected routes)
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import {
  getUserWishlist,
  addToWishlist,
  removeFromWishlist,
  setUserWishlist
} from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'haggle_super_secret_key_123';

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
router.get('/', authenticateToken, async (req, res) => {
  try {
    const wishlist = await getUserWishlist(req.user.id);
    res.json({ wishlist });
  } catch (err) {
    console.error('Error fetching wishlist:', err);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

// Save user wishlist (full sync)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { wishlist } = req.body;
    if (!Array.isArray(wishlist)) {
      return res.status(400).json({ error: 'Invalid wishlist data, array expected' });
    }

    const updated = await setUserWishlist(req.user.id, wishlist);
    res.json({ success: true, wishlist: updated });
  } catch (err) {
    console.error('Error updating wishlist:', err);
    res.status(500).json({ error: 'Failed to update wishlist' });
  }
});

// Add single product to user wishlist
router.post('/add', authenticateToken, async (req, res) => {
  try {
    const { product } = req.body;
    if (!product || (!product.id && !product.productId)) {
      return res.status(400).json({ error: 'Invalid product data' });
    }

    const updated = await addToWishlist(req.user.id, product);
    res.json({ success: true, wishlist: updated });
  } catch (err) {
    console.error('Error adding to wishlist:', err);
    res.status(500).json({ error: 'Failed to add item to wishlist' });
  }
});

// Remove single product from user wishlist
router.delete('/remove/:id', authenticateToken, async (req, res) => {
  try {
    const productId = req.params.id;
    if (!productId) {
      return res.status(400).json({ error: 'Product ID required' });
    }

    const updated = await removeFromWishlist(req.user.id, productId);
    res.json({ success: true, wishlist: updated });
  } catch (err) {
    console.error('Error removing from wishlist:', err);
    res.status(500).json({ error: 'Failed to remove item from wishlist' });
  }
});

export default router;