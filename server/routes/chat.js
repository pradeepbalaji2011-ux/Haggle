/**
 * server/routes/chat.js — Haggle Assistant Chat API
 *
 * POST /api/chat
 * Body: { messages: [{role, content}], stream: true }
 * Response: Server-Sent Events (text/event-stream) with streamed tokens
 *
 * Flow:
 * 1. Rate limit check (per-IP)
 * 2. Inject Haggle trending context into system prompt
 * 3. Try Ollama streaming (15s timeout)
 * 4. On timeout/error → fallback to intent matcher
 * 5. Never show raw errors to user
 */

import express from 'express';
import { matchIntent } from '../chatbot/intent-matcher.js';
import { getTrendingContext } from '../chatbot/trending-updater.js';
import { searchHaggleCatalog, formatProductContext } from '../chatbot/catalog-lookup.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Load config with safe defaults
let config = {
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2:3b', timeoutMs: 15000, contextMessages: 10 },
  rateLimit: { maxMessageLength: 500, requestsPerMinutePerIp: 20 }
};
try {
  const cfgPath = path.join(__dirname, '../../chatbot-config.json');
  config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
} catch { /* use defaults */ }

// Simple in-memory rate limiter
const rateLimitMap = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const window = 60 * 1000; // 1 minute
  if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
  const requests = rateLimitMap.get(ip).filter(t => now - t < window);
  requests.push(now);
  rateLimitMap.set(ip, requests);
  return requests.length <= (config.rateLimit?.requestsPerMinutePerIp || 20);
}

// Cleanup rate limit map every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of rateLimitMap.entries()) {
    const recent = times.filter(t => now - t < 60000);
    if (recent.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, recent);
  }
}, 5 * 60 * 1000);

const SYSTEM_PROMPT = `You are Haggle Assistant, a friendly and knowledgeable shopping guide for Indian shoppers. Your role is to help users find products, compare prices across Indian e-commerce platforms, understand price history and spot recent trends and deals.

Guidelines:
- Keep answers short, warm, and clear (2-4 sentences max unless user asks for details)
- All prices in Indian Rupees (₹)
- Use ONLY the data provided to you for specific prices and trends; if data is missing, say so honestly
- Never invent prices or availability
- Recommend Haggle search for real-time prices
- Be conversational and helpful like a knowledgeable friend, not a formal chatbot
- Support Indian context: mention festive sales (Diwali, Big Billion Day, etc.) when relevant`;

/**
 * Stream response from Ollama
 */
async function streamFromOllama(messages, res) {
  const ollamaUrl = `${config.ollama.baseUrl}/api/chat`;
  const timeoutMs = config.ollama.timeoutMs || 15000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollama.model || 'llama3.2:3b',
        messages,
        stream: true,
        options: { temperature: 0.7, num_predict: 400 }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    // Stream the response token by token
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const token = parsed?.message?.content || '';
          if (token) {
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          }
          if (parsed.done) {
            res.write(`data: ${JSON.stringify({ done: true, source: 'ollama' })}\n\n`);
            return true;
          }
        } catch { /* skip malformed lines */ }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, source: 'ollama' })}\n\n`);
    return true;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn('[chatbot] Ollama timeout after', timeoutMs, 'ms — using fallback');
    } else {
      console.warn('[chatbot] Ollama error:', err.message, '— using fallback');
    }
    return false;
  }
}

router.post('/', async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';

  // Rate limit check
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { messages = [], stream = true } = req.body;

  // Validate
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages must be an array' });
  }

  // Message length check
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || !lastMsg.content) {
    return res.status(400).json({ error: 'No message content' });
  }
  if (lastMsg.content.length > (config.rateLimit?.maxMessageLength || 500)) {
    return res.status(400).json({ error: 'Message too long (max 500 characters)' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Build messages with system prompt + Haggle context + matching product data
  const userMsg = lastMsg.content;
  const trendingCtx = getTrendingContext();
  const matchedProducts = searchHaggleCatalog(userMsg);
  const productCtx = formatProductContext(matchedProducts);

  const systemMessage = {
    role: 'system',
    content: `${SYSTEM_PROMPT}\n\n${trendingCtx}${productCtx}`
  };

  // Keep only last N messages to limit context size
  const maxCtx = config.ollama?.contextMessages || 10;
  const trimmedMessages = messages.slice(-maxCtx);
  const fullMessages = [systemMessage, ...trimmedMessages];

  // Try Ollama first
  const ollamaSuccess = await streamFromOllama(fullMessages, res);

  if (!ollamaSuccess) {
    // Fallback: intent matcher
    const userMsg = lastMsg.content;
    const fallbackResponse = matchIntent(userMsg);

    // Stream fallback word by word for natural feel
    const words = fallbackResponse.split(' ');
    for (let i = 0; i < words.length; i++) {
      const token = (i === 0 ? '' : ' ') + words[i];
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
      await new Promise(r => setTimeout(r, 20)); // 20ms per word
    }

    res.write(`data: ${JSON.stringify({ done: true, source: 'fallback' })}\n\n`);
  }

  res.end();
});

// Health check for Ollama status
router.get('/status', async (req, res) => {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${config.ollama.baseUrl}/api/tags`, { signal: controller.signal });
    const data = await response.json();
    const models = (data.models || []).map(m => m.name);
    res.json({ ollamaOnline: true, models, configuredModel: config.ollama.model });
  } catch {
    res.json({ ollamaOnline: false, models: [], configuredModel: config.ollama.model, fallback: 'intent-matcher' });
  }
});

export default router;
