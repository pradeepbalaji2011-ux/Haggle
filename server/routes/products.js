import { Router } from 'express';
import { searchShopping } from '../providers/serpapi.js';

const router = Router();
const cache = new Map();
const ttlSeconds = () => Math.max(30, Number(process.env.CACHE_TTL_SECONDS || 300));

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 160);
  if (!q) return res.status(400).json({ error: 'Enter a product name to search.' });
  if (!process.env.SERPAPI_KEY || process.env.SERPAPI_KEY === 'put_your_api_key_here') {
    return res.status(503).json({ error: 'Live product search is not configured yet. Add your SerpApi key to .env and restart Haggle.' });
  }
  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < ttlSeconds() * 1000) {
    return res.json({ ...cached.data, cached: true, updatedAt: new Date(cached.time).toISOString() });
  }
  try {
    const data = await searchShopping(q);
    cache.set(key, { data, time: Date.now() });
    res.json({ ...data, cached: false, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Product provider error:', err.message);
    res.status(502).json({ error: err.publicMessage || 'The product provider could not return results. Please try again later.' });
  }
});

export default router;
