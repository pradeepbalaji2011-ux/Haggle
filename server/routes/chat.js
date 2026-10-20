/**
 * server/routes/chat.js — Haggle Assistant Chat API (Verified Real Data Pipeline)
 *
 * Implements:
 * 1. Multi-tier intent + entity extraction (NLU with conversation history context)
 * 2. 6-hour freshness verified data retrieval across all sectors (no guessing)
 * 3. Price history analytics (lowest, highest, average, trends, buy signals)
 * 4. Anti-hallucination Numerical Verification Gatekeeper with deterministic fallback
 * 5. SSE streaming of verified tokens + rich payload (cards, mini SVG chart, chips, spoken text)
 */

import express from 'express';
import { extractIntentAndEntities } from '../chatbot/nlu.js';
import { retrieveProductData, analyzePriceHistory } from '../chatbot/retrieval.js';
import { generateVerifiedResponse } from '../chatbot/generator.js';
import { getTrendingContext } from '../chatbot/trending-updater.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Load config with safe defaults
let config = {
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2:3b', timeoutMs: 12000, contextMessages: 10 },
  rateLimit: { maxMessageLength: 500, requestsPerMinutePerIp: 30 }
};

try {
  const cfgPath = path.join(__dirname, '../../chatbot-config.json');
  if (fs.existsSync(cfgPath)) {
    config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
} catch { /* use defaults */ }

// In-memory rate limiter
const rateLimitMap = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const window = 60 * 1000;
  if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
  const requests = rateLimitMap.get(ip).filter(t => now - t < window);
  requests.push(now);
  rateLimitMap.set(ip, requests);
  return requests.length <= (config.rateLimit?.requestsPerMinutePerIp || 30);
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of rateLimitMap.entries()) {
    const recent = times.filter(t => now - t < 60000);
    if (recent.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, recent);
  }
}, 5 * 60 * 1000);

router.post('/', async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { messages = [], stream = true } = req.body;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages must be an array' });
  }

  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || !lastMsg.content) {
    return res.status(400).json({ error: 'No message content' });
  }

  const userQuery = String(lastMsg.content).trim();
  if (userQuery.length > (config.rateLimit?.maxMessageLength || 500)) {
    return res.status(400).json({ error: 'Message too long (max 500 characters)' });
  }

  // 1. NLU: Extract Intent and Entities with conversation history
  const parsed = await extractIntentAndEntities(
    userQuery,
    messages.slice(0, -1),
    config.ollama?.baseUrl || 'http://localhost:11434',
    config.ollama?.model || 'llama3.2:3b'
  );

  const intent = parsed.intent;
  const entity = parsed.entity || {};
  const productName = entity.productName;

  // 2. Data Retrieval: Fetch real product data
  let retrievedData = { query: userQuery, products: [], source: 'none' };
  let historyStats = null;

  if (intent === 'trending') {
    // Trending query: inject trending items
    try {
      const trendingRaw = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/trending.json'), 'utf8'));
      const drops = (trendingRaw.biggestDrops || []).slice(0, 3);
      retrievedData = {
        query: 'trending',
        products: drops.map(d => ({
          name: d.name,
          price: d.price,
          store: d.store,
          originalPrice: d.oldPrice,
          discountPercent: d.dropPercent
        })),
        source: 'trending_db'
      };
    } catch {}
  } else if (productName) {
    // Product query: fetch primary product
    retrievedData = await retrieveProductData(productName);

    // If second product present in comparison query, fetch and combine
    if (entity.secondProduct && intent === 'compare_products') {
      const p2Data = await retrieveProductData(entity.secondProduct);
      if (p2Data.products && p2Data.products.length > 0) {
        retrievedData.products = [
          ...(retrievedData.products.slice(0, 1)),
          ...(p2Data.products.slice(0, 1))
        ];
      }
    }

    // If intent requires historical data or price trend
    if (['price_history', 'price_drop_trend', 'should_i_buy', 'best_deal'].includes(intent)) {
      const activePrice = retrievedData.products[0]?.price || null;
      historyStats = await analyzePriceHistory(productName, activePrice);
    }
  } else if (intent === 'category_browsing' || intent === 'best_deal') {
    // Browsing query without exact product (e.g. "running shoes", "smart tv")
    retrievedData = await retrieveProductData(userQuery);
  }

  // Filter by budget if specified
  if (entity.budgetMax && retrievedData.products.length > 0) {
    const underBudget = retrievedData.products.filter(p => p.price <= entity.budgetMax);
    if (underBudget.length > 0) {
      retrievedData.products = underBudget;
    }
  }

  // 3. Generate Verified Anti-Hallucination Response
  const generated = await generateVerifiedResponse({
    userMessage: userQuery,
    intent,
    entity,
    retrievedData,
    historyStats,
    history: messages,
    ollamaConfig: {
      baseUrl: config.ollama?.baseUrl || 'http://localhost:11434',
      model: config.ollama?.model || 'llama3.2:3b',
      timeoutMs: config.ollama?.timeoutMs || 12000
    }
  });

  // Non-streaming response support
  if (!stream) {
    return res.json({
      role: 'assistant',
      content: generated.text,
      spokenSummary: generated.spokenSummary,
      cards: generated.cards,
      miniChart: generated.miniChart,
      chips: generated.chips,
      source: generated.source,
      intent
    });
  }

  // 4. SSE Streaming Delivery
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Stream text word-by-word for natural reading pace
  const words = (generated.text || '').split(' ');
  for (let i = 0; i < words.length; i++) {
    const token = (i === 0 ? '' : ' ') + words[i];
    res.write(`data: ${JSON.stringify({ token })}\n\n`);
    // Micro delay to emulate live token typing
    if (words.length < 150) {
      await new Promise(r => setTimeout(r, 12));
    }
  }

  // Stream final event with rich payload
  res.write(`data: ${JSON.stringify({
    done: true,
    source: generated.source,
    cards: generated.cards || [],
    miniChart: generated.miniChart || null,
    chips: generated.chips || [],
    spokenSummary: generated.spokenSummary || ''
  })}\n\n`);

  res.end();
});

// Ollama & Assistant Health Check
router.get('/status', async (req, res) => {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${config.ollama.baseUrl}/api/tags`, { signal: controller.signal });
    const data = await response.json();
    const models = (data.models || []).map(m => m.name);
    res.json({
      online: true,
      ollamaOnline: true,
      models,
      configuredModel: config.ollama.model,
      engine: 'verified_anti_hallucination_v2'
    });
  } catch {
    res.json({
      online: true,
      ollamaOnline: false,
      models: [],
      configuredModel: config.ollama.model,
      fallback: 'deterministic_verified_catalog',
      engine: 'verified_anti_hallucination_v2'
    });
  }
});

export default router;
