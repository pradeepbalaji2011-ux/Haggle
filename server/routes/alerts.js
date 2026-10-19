/**
 * server/routes/alerts.js — Price Alerts API
 *
 * Allows authenticated users to view, set, and delete price alerts.
 */

import express from 'express';
import { requireAuth } from '../auth.js';
import { getPriceAlerts, setPriceAlert, removePriceAlert } from '../users.js';

const router = express.Router();

// GET /api/alerts — retrieve user's price alerts
router.get('/', requireAuth, async (req, res) => {
  try {
    const alerts = await getPriceAlerts(req.userId);
    res.json({ success: true, alerts });
  } catch (err) {
    console.error('Error fetching price alerts:', err);
    res.status(500).json({ error: 'Failed to retrieve price alerts' });
  }
});

// POST /api/alerts or /api/alerts/add — set or update target price alert
const handleSetAlert = async (req, res) => {
  try {
    const alertData = req.body || {};
    if (!alertData.productId && !alertData.id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }
    if (!alertData.targetPrice || Number(alertData.targetPrice) <= 0) {
      return res.status(400).json({ error: 'A valid target price greater than 0 is required' });
    }

    const updated = await setPriceAlert(req.userId, alertData);
    res.json({ success: true, alerts: updated });
  } catch (err) {
    console.error('Error setting price alert:', err);
    res.status(400).json({ error: err.message || 'Failed to set price alert' });
  }
};

router.post('/', requireAuth, handleSetAlert);
router.post('/add', requireAuth, handleSetAlert);

// DELETE /api/alerts/:id or /api/alerts/remove/:id — remove price alert
const handleRemoveAlert = async (req, res) => {
  try {
    const productId = req.params.id;
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const updated = await removePriceAlert(req.userId, productId);
    res.json({ success: true, alerts: updated });
  } catch (err) {
    console.error('Error removing price alert:', err);
    res.status(500).json({ error: 'Failed to remove price alert' });
  }
};

router.delete('/:id', requireAuth, handleRemoveAlert);
router.delete('/remove/:id', requireAuth, handleRemoveAlert);

export default router;
