import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import productsRouter from './routes/products.js';
import authRouter, { handleMeEndpoint } from './auth.js';
import wishlistRouter from './routes/wishlist.js';
import alertsRouter from './routes/alerts.js';
import chatRouter from './routes/chat.js';
import ttsRouter from './routes/tts.js';
import imagesRouter from './routes/images.js';
import { getFeaturedProducts } from './featured.js';
import { getScrapersHealth } from './providers/html-scraper.js';
import { ensureDataDirectory } from './users.js';
import { startTrendingUpdater } from './chatbot/trending-updater.js';
import { startPriceScheduler } from './chatbot/scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json());

// Ensure all responses default to charset=utf-8
app.use((_req, res, next) => {
  res.charset = 'utf-8';
  next();
});

// Baseline security headers on every response (user-data hardening)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

// API Routes
app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/tts', ttsRouter);

// Fast image acceleration proxy (disk-cached, hotlink-protected sources bypassed)
app.use('/api/img', imagesRouter);

// Global /api/me single source of truth for header & profile
app.get('/api/me', handleMeEndpoint);

// Global /api/featured for home page live shuffling products
app.get('/api/featured', async (_req, res) => {
  try {
    const data = await getFeaturedProducts();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Could not load featured products' });
  }
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  const scrapers = getScrapersHealth();
  const entries = Object.entries(scrapers);
  const blocked = entries.filter(([_, s]) => s.status === 'blocked').map(([id]) => id);
  const responding = entries.filter(([_, s]) => s.status === 'ok').map(([id]) => id);

  res.json({
    ok: true,
    engine: 'haggle-modular',
    provider: 'html-scraper',
    emailConfigured: !!process.env.EMAIL_PASS,
    scrapers,
    notice: blocked.length > 0
      ? `Some stores are temporarily unavailable (${blocked.join(', ')}). Responding stores: ${responding.join(', ') || 'none'}`
      : null
  });
});

// Return JSON 404 for unknown API routes (must be before SPA catch-all)
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Never fall through to the SPA shell for sensitive/internal paths — return hard 404
app.get(/^\/(data|server|node_modules|\.env|\.git)(\/|$)/i, (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Static files & frontend SPA fallback
app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, filePath) => {
    if (/\.m?js$/i.test(filePath)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1h so updates roll out fast
    } else if (/\.css$/i.test(filePath)) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else if (/\.html$/i.test(filePath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache'); // always fresh entry HTML
    } else if (/\.json$/i.test(filePath)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    } else if (/\.(png|jpe?g|gif|svg|webp|ico|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // static logos/fonts 7d
    }
  }
}));
app.get('*', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const port = Number(process.env.PORT || 3000);

async function startServer() {
  try {
    ensureDataDirectory();
    console.log('✓ Haggle database and storage initialized.');

    // Start background trending & price tracker scheduler
    startTrendingUpdater();
    startPriceScheduler();

    app.listen(port, '0.0.0.0', () => {
      console.log(`Haggle running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Failed to initialize Haggle server:', err);
    process.exit(1);
  }
}

startServer();
