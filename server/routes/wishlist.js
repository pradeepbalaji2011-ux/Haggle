/**
 * routes/wishlist.js — Wishlist API (protected routes)
 *
 * GET    /api/wishlist           — Get current user's wishlist
 * POST   /api/wishlist/add       — Add product to wishlist
 * DELETE /api/wishlist/remove/:id — Remove product from wishlist
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { addToWishlist, removeFromWishlist, getWishlist } from '../db.js';

const router = Router();

// All wishlist routes require a valid JWT token
router.use(requireAuth);

// GET wishlist
router.get('/', (req, res) => {
  try {
    const list = getWishlist(req.user.id);
    res.json({ wishlist: list, count: list.length });
  } catch {
    res.status(500).json({ error: 'Could not load wishlist.' });
  }
});

// POST add to wishlist
router.post('/add', (req, res) => {
  try {
    const { product } = req.body || {};
    if (!product || !product.id) {
      return res.status(400).json({ error: 'A valid product is required.' });
    }

    // Only store essential fields — no large objects
    const safe = {
      id: String(product.id),
      productId: product.productId || null,
      name: product.name || 'Unknown product',
      brand: product.brand || null,
      image: product.image || null,
      price: product.price ?? null,
      currency: product.currency || 'INR',
      store: product.store || null,
      buyUrl: product.buyUrl || null,
      rating: product.rating ?? null,
      reviews: product.reviews ?? null
    };

    const list = addToWishlist(req.user.id, safe);
    res.json({ wishlist: list, count: list.length });
  } catch (err) {
    console.error('Wishlist add error:', err.message);
    res.status(500).json({ error: 'Could not add to wishlist.' });
  }
});

// DELETE remove from wishlist
router.delete('/remove/:productId', (req, res) => {
  try {
    const list = removeFromWishlist(req.user.id, req.params.productId);
    res.json({ wishlist: list, count: list.length });
  } catch {
    res.status(500).json({ error: 'Could not remove from wishlist.' });
  }
});

export default router;
