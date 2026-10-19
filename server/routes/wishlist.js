/**
 * server/routes/wishlist.js — User Wishlist API
 *
 * Persists wishlist per user on the server so items follow them across devices.
 */

import express from 'express';
import { requireAuth } from '../auth.js';
import { getWishlist, addWishlistItem, removeWishlistItem } from '../users.js';

const router = express.Router();

// GET /api/wishlist — retrieve user's saved wishlist
router.get('/', requireAuth, async (req, res) => {
  try {
    const wishlist = await getWishlist(req.userId);
    res.json({ success: true, wishlist });
  } catch (err) {
    console.error('Error fetching wishlist:', err);
    res.status(500).json({ error: 'Failed to retrieve wishlist' });
  }
});

// POST /api/wishlist/add — add product to wishlist
router.post('/add', requireAuth, async (req, res) => {
  try {
    const { product } = req.body || {};
    if (!product || (!product.id && !product.productId)) {
      return res.status(400).json({ error: 'Valid product data is required' });
    }

    const updated = await addWishlistItem(req.userId, product);
    res.json({ success: true, wishlist: updated });
  } catch (err) {
    console.error('Error adding to wishlist:', err);
    res.status(500).json({ error: 'Failed to save item to wishlist' });
  }
});

// DELETE /api/wishlist/remove/:id — remove product from wishlist
router.delete('/remove/:id', requireAuth, async (req, res) => {
  try {
    const productId = req.params.id;
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const updated = await removeWishlistItem(req.userId, productId);
    res.json({ success: true, wishlist: updated });
  } catch (err) {
    console.error('Error removing from wishlist:', err);
    res.status(500).json({ error: 'Failed to remove item from wishlist' });
  }
});

export default router;