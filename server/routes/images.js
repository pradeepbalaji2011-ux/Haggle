/**
 * server/routes/images.js — Image Acceleration Proxy with Persistent Cache
 *
 * WHY THIS EXISTS
 * Retailer product images (Amazon/Flipkart/Meesho/Myntra CDNs...) are:
 *   1. Hotlink-protected — they 403 when a browser loads them from another site
 *      (this is the #1 cause of "missing product images").
 *   2. Slow / unreliable from the client's network (huge, unoptimised CDNs).
 *   3. Re-fetched from scratch on every page render.
 *
 * This proxy fetches images ONCE server-side (spoofing the retailer Referer so
 * hotlink protection passes), caches them to disk + memory, and serves them to
 * the browser from the same origin with aggressive immutable caching. Result:
 * images that previously failed or took seconds now load instantly and never
 * break.
 *
 * SECURITY (SSRF-hardened):
 *   - Only https:// URLs, no explicit non-443 ports
 *   - Rejects IP-literal hosts, localhost, .local/.internal, cloud metadata
 *   - DNS-resolves the hostname and rejects private/reserved ranges
 *   - Follows max 2 redirects, re-validating every hop
 *   - Content-Type must be image/*, response capped at 5 MB, 8s timeout
 *
 * Endpoints:
 *   GET /api/img?u=<encoded-url>   → cached image bytes (ETag / 304 aware)
 */

import express from 'express';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '../../data');
const CACHE_DIR = path.join(DATA_DIR, 'img-cache');

const router = express.Router();

// ─── Tunables ──────────────────────────────────────────────────────────────────
const MAX_BYTES = 5 * 1024 * 1024;          // 5 MB hard cap per image
const FETCH_TIMEOUT_MS = 8000;              // 8s remote fetch timeout
const MAX_REDIRECTS = 2;
const MEM_CACHE_MAX = 400;                  // hot-image memory LRU
const DISK_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // evict disk entries after 30d
const SEND_MAX_AGE = 'public, max-age=2592000, immutable'; // 30d browser cache

// ─── Memory cache (LRU by insertion-order eviction) ────────────────────────────
/** @type {Map<string, {buf: Buffer, contentType: string, etag: string, fetchedAt: number}>} */
const memCache = new Map();
/** @type {Map<string, Promise<object|null>>} */
const inflight = new Map();

function memGet(key) {
  const hit = memCache.get(key);
  if (!hit) return null;
  // Refresh LRU position
  memCache.delete(key);
  memCache.set(key, hit);
  return hit;
}

function memSet(key, value) {
  if (memCache.size >= MEM_CACHE_MAX) {
    const oldestKey = memCache.keys().next().value;
    if (oldestKey !== undefined) memCache.delete(oldestKey);
  }
  memCache.set(key, value);
}

// ─── SSRF Guards ───────────────────────────────────────────────────────────────

/**
 * Validates that a URL is a safe public https image URL.
 * Returns { ok: true, url: URL } or { ok: false, reason: string }.
 */
function validateUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (url.protocol !== 'https:') return { ok: false, reason: 'protocol' };
  if (url.username || url.password) return { ok: false, reason: 'credentials' };
  if (url.port && url.port !== '443') return { ok: false, reason: 'port' };

  const host = url.hostname.toLowerCase().replace(/\.$/, '');

  // Reject IP literals outright — retail CDNs always use domain names
  if (net.isIP(host)) return { ok: false, reason: 'ip-literal' };

  // Reject obvious internal hosts
  if (
    host === 'localhost' || host.endsWith('.localhost') ||
    host.endsWith('.local') || host.endsWith('.internal') ||
    host.endsWith('.lan') || host.endsWith('.home') ||
    host === 'metadata.google.internal' || !host.includes('.')
  ) {
    return { ok: false, reason: 'internal-host' };
  }

  return { ok: true, url };
}

/**
 * Resolves hostname and ensures it is NOT a private/reserved IP.
 * Defends against DNS rebinding to internal ranges.
 */
async function isPublicDnsHost(hostname) {
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!records || records.length === 0) return false;
    for (const rec of records) {
      const ip = rec.address;
      if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        if (a === 10 || a === 127 || a === 0) return false;                       // private / loopback / this-network
        if (a === 169 && b === 254) return false;                                 // link-local (cloud metadata)
        if (a === 172 && b >= 16 && b <= 31) return false;                        // private
        if (a === 192 && b === 168) return false;                                 // private
        if (a === 100 && b >= 64 && b <= 127) return false;                       // CGNAT
        if (a >= 224) return false;                                               // multicast / reserved
      } else if (net.isIPv6(ip)) {
        const low = ip.toLowerCase();
        if (low === '::1' || low === '::') return false;                          // loopback / unspecified
        if (low.startsWith('fe80') || low.startsWith('fc') || low.startsWith('fd')) return false; // link-local / ULA
        if (low.startsWith('::ffff:')) {
          // IPv4-mapped — re-check the embedded IPv4
          const v4 = low.split(':').pop();
          if (net.isIPv4(v4)) {
            const [a, b] = v4.split('.').map(Number);
            if (a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
          }
        }
      }
    }
    return true;
  } catch {
    return false; // DNS failure → treat as unsafe
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function cacheKeyFor(url) {
  return crypto.createHash('sha256').update(url).digest('hex');
}

function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  const head = buf.slice(0, 200).toString('utf8').toLowerCase();
  if (head.includes('<svg')) return 'image/svg+xml';
  return null;
}

/** Fetch with hard timeout, returns the Response */
async function timedFetch(url, refererOrigin, redirectMode) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'GET',
      redirect: redirectMode,
      signal: controller.signal,
      headers: {
        // Spoof the retailer's own site as referer so hotlink protection passes
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
        ...(refererOrigin ? { 'Referer': refererOrigin } : {})
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Downloads the image following up to MAX_REDIRECTS hops,
 * re-validating SSRF safety on every redirect.
 */
async function fetchImageWithRedirects(rawUrl, depth = 0) {
  const check = validateUrl(rawUrl);
  if (!check.ok) throw new Error(`blocked:${check.reason}`);

  if (!(await isPublicDnsHost(check.url.hostname))) throw new Error('blocked:private-dns');

  const res = await timedFetch(check.url.toString(), check.url.origin + '/', depth === MAX_REDIRECTS ? 'error' : 'manual');

  if ([301, 302, 303, 307, 308].includes(res.status)) {
    if (depth >= MAX_REDIRECTS) throw new Error('too-many-redirects');
    const loc = res.headers.get('location');
    if (!loc) throw new Error('redirect-no-location');
    res.body?.cancel?.().catch(() => {});
    const nextUrl = new URL(loc, check.url).toString();
    return fetchImageWithRedirects(nextUrl, depth + 1);
  }

  if (!res.ok) throw new Error(`upstream-${res.status}`);

  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const arrayBuf = await res.arrayBuffer();
  if (arrayBuf.byteLength === 0) throw new Error('empty-body');
  if (arrayBuf.byteLength > MAX_BYTES) throw new Error('too-large');

  const buf = Buffer.from(arrayBuf);
  const effectiveType = contentType.startsWith('image/') ? contentType : sniffImageType(buf);
  if (!effectiveType || !effectiveType.startsWith('image/')) throw new Error('not-an-image');

  return { buf, contentType: effectiveType };
}

// ─── Disk cache ────────────────────────────────────────────────────────────────

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    try { mkdirSync(CACHE_DIR, { recursive: true }); } catch { /* best effort */ }
  }
}

function readDiskCache(key) {
  ensureCacheDir();
  try {
    const file = path.join(CACHE_DIR, key);
    const metaFile = `${file}.meta.json`;
    if (!existsSync(file) || !existsSync(metaFile)) return null;

    const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
    if (!meta || !meta.contentType || !meta.fetchedAt) return null;

    // Evict stale disk entries lazily
    if (Date.now() - meta.fetchedAt > DISK_MAX_AGE_MS) {
      try { unlinkSync(file); unlinkSync(metaFile); } catch {}
      return null;
    }

    const buf = readFileSync(file);
    return { buf, contentType: meta.contentType, fetchedAt: meta.fetchedAt };
  } catch {
    return null;
  }
}

function writeDiskCache(key, buf, contentType) {
  ensureCacheDir();
  const file = path.join(CACHE_DIR, key);
  const metaFile = `${file}.meta.json`;
  const tmpFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tmpFile, buf);
    try { renameSync(tmpFile, file); } catch {
      // Windows lock fallback
      try { writeFileSync(file, buf); unlinkSync(tmpFile); } catch {}
    }
    writeFileSync(metaFile, JSON.stringify({ contentType, fetchedAt: Date.now() }), 'utf8');
  } catch (err) {
    try { if (existsSync(tmpFile)) unlinkSync(tmpFile); } catch {}
    console.warn('[img-proxy] disk cache write failed:', err.message);
  }
}

// ─── Public entry (shared with other server modules) ──────────────────────────

/**
 * Resolves an image for a URL through the cache layers.
 * Returns { buf, contentType, etag } or null on total failure.
 */
export async function resolveImage(rawUrl) {
  const key = cacheKeyFor(rawUrl);

  // 1. Memory
  const memHit = memGet(key);
  if (memHit) return memHit;

  // 2. Disk
  const diskHit = readDiskCache(key);
  if (diskHit) {
    const entry = {
      ...diskHit,
      etag: crypto.createHash('sha1').update(diskHit.buf).digest('hex').slice(0, 20)
    };
    memSet(key, entry);
    return entry;
  }

  // 3. Remote fetch — dedupe concurrent requests for the same URL
  const existing = inflight.get(key);
  if (existing) return existing;

  const job = (async () => {
    try {
      const { buf, contentType } = await fetchImageWithRedirects(rawUrl);
      const entry = {
        buf,
        contentType,
        fetchedAt: Date.now(),
        etag: crypto.createHash('sha1').update(buf).digest('hex').slice(0, 20)
      };
      writeDiskCache(key, buf, contentType);
      memSet(key, entry);
      return entry;
    } catch (err) {
      console.warn(`[img-proxy] failed ${rawUrl.slice(0, 120)} → ${err.message}`);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, job);
  return job;
}

// ─── Placeholder ───────────────────────────────────────────────────────────────

const PLACEHOLDER_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">` +
  `<rect width="400" height="400" fill="#1a1a20"/>` +
  `<circle cx="200" cy="165" r="52" fill="none" stroke="#3f3f46" stroke-width="10"/>` +
  `<circle cx="200" cy="165" r="18" fill="#3f3f46"/>` +
  `<path d="M110 285 Q200 215 290 285" fill="none" stroke="#3f3f46" stroke-width="12" stroke-linecap="round"/>` +
  `<text x="200" y="340" text-anchor="middle" fill="#52525b" font-family="sans-serif" font-size="20" font-weight="700">Haggle</text>` +
  `</svg>`,
  'utf8'
);

// ─── Routes ────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const rawUrl = String(req.query.u || '').trim();

  if (!rawUrl) {
    return sendPlaceholder(res, 'missing-url');
  }

  const check = validateUrl(rawUrl);
  if (!check.ok) {
    return sendPlaceholder(res, check.reason);
  }

  try {
    const entry = await resolveImage(rawUrl);
    if (!entry) return sendPlaceholder(res, 'fetch-failed');

    res.setHeader('Content-Type', entry.contentType);
    res.setHeader('Cache-Control', SEND_MAX_AGE);
    res.setHeader('ETag', `"${entry.etag}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Timing-Allow-Origin', '*');

    // Conditional request support
    if (req.headers['if-none-match'] === `"${entry.etag}"`) {
      return res.status(304).end();
    }

    return res.status(200).send(entry.buf);
  } catch (err) {
    console.error('[img-proxy] unexpected error:', err.message);
    return sendPlaceholder(res, 'error');
  }
});

function sendPlaceholder(res, reason) {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-store'); // failures must never be cached
  res.setHeader('X-Haggle-Img-Status', reason);
  return res.status(200).send(PLACEHOLDER_SVG);
}

export default router;
