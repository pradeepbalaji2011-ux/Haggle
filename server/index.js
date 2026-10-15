import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import productsRouter from './routes/products.js';
import authRouter from './routes/auth.js';
import wishlistRouter from './routes/wishlist.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.use(express.json());

// API Routes
app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/api/wishlist', wishlistRouter);

// Static files & frontend SPA fallback
app.use(express.static(path.join(__dirname, '../public')));
app.get('/api/health', (_req, res) => res.json({ ok: true, provider: process.env.SERPAPI_KEY ? 'serpapi' : 'not-configured' }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Haggle running at http://localhost:${port}`));