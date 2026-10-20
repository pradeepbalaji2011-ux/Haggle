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
import { getFeaturedProducts } from './featured.js';
import { ensureDataDirectory } from './users.js';
import { startTrendingUpdater } from './chatbot/trending-updater.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json());

// API Routes
app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/tts', ttsRouter);

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
app.get('/api/health', (_req, res) => res.json({
  ok: true,
  engine: 'haggle-modular',
  provider: process.env.SERPAPI_KEY ? 'serpapi' : 'not-configured',
  emailConfigured: !!process.env.EMAIL_PASS
}));

// Static files & frontend SPA fallback
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

const port = Number(process.env.PORT || 3000);

async function startServer() {
  try {
    ensureDataDirectory();
    console.log('✓ Haggle database and storage initialized.');

    // Start background trending updater for chatbot context
    startTrendingUpdater();

    app.listen(port, '0.0.0.0', () => {
      console.log(`Haggle running at http://localhost:${port}`);
      console.log(`Local network URL: http://192.168.1.101:${port}`);
    });
  } catch (err) {
    console.error('Failed to initialize Haggle server:', err);
    process.exit(1);
  }
}

startServer();
