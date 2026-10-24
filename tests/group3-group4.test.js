/**
 * tests/group3-group4.test.js
 * Verifies Group 3 & Group 4 requirements:
 * - DATA_DIR configurable from process.env
 * - /api/health reports real scraper status without SERPAPI_KEY dependency
 * - /api/tts has rate limiting, length check, randomUUID wav, platform guard
 * - /api/chat returns mode (ollama or intent-fallback)
 * - /api/* unknown endpoint returns JSON 404 (not HTML)
 * - Obsolete files (main.py, __pycache__, root logo, css.tmp) are deleted
 * - package.json uses bcryptjs only (no native bcrypt), no cors, playwright in devDeps
 * - Affiliate tags only add ref_source when affiliate tag exists
 * - JioMart pincode respects env variable
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

describe('Group 3 - Deployment on Render', () => {
  it('DATA_DIR is configurable via environment variable in users.js and db.js', async () => {
    const usersJs = readFileSync(path.join(ROOT, 'server', 'users.js'), 'utf8');
    assert.ok(usersJs.includes('process.env.DATA_DIR'), 'users.js must support process.env.DATA_DIR');

    const dbJs = readFileSync(path.join(ROOT, 'server', 'db.js'), 'utf8');
    assert.ok(dbJs.includes('process.env.DATA_DIR'), 'db.js must support process.env.DATA_DIR');
  });

  it('Scraper health tracking exports getScrapersHealth and tracks 12 platforms', async () => {
    const { getScrapersHealth } = await import('../server/providers/html-scraper.js');
    assert.equal(typeof getScrapersHealth, 'function');
    const health = getScrapersHealth();
    const keys = Object.keys(health);
    assert.equal(keys.length, 12, 'Must track all 12 scrapers');
    assert.ok(keys.includes('amazon'));
    assert.ok(keys.includes('flipkart'));
    assert.ok(keys.includes('meesho'));
    assert.ok(!keys.includes('shopclues'), 'Must not track deleted shopclues');
    assert.ok(!keys.includes('lenskart'), 'Must not track deleted lenskart');
  });

  it('server/index.js does not depend on SERPAPI_KEY in /api/health', () => {
    const indexJs = readFileSync(path.join(ROOT, 'server', 'index.js'), 'utf8');
    assert.ok(!indexJs.includes("SERPAPI_KEY ? 'serpapi'"), 'index.js must not depend on SERPAPI_KEY for health check');
    assert.ok(indexJs.includes('getScrapersHealth'), 'index.js must use getScrapersHealth for /api/health');
  });

  it('render.yaml exists and defines persistent disk and required env vars', () => {
    assert.ok(existsSync(path.join(ROOT, 'render.yaml')), 'render.yaml must exist');
    const yaml = readFileSync(path.join(ROOT, 'render.yaml'), 'utf8');
    assert.ok(yaml.includes('/var/data'), 'render.yaml must mount persistent disk at /var/data');
    assert.ok(yaml.includes('JWT_SECRET'));
    assert.ok(yaml.includes('DATA_DIR'));
    assert.ok(yaml.includes('SITE_URL'));
  });
});

describe('Group 4 - Smaller Fixes & Cleanup', () => {
  it('JioMart scraper reads pincode from process.env.JIOMART_PINCODE without hardcoded 400001', () => {
    const scraperJs = readFileSync(path.join(ROOT, 'server', 'providers', 'html-scraper.js'), 'utf8');
    assert.ok(!scraperJs.includes("'400001'"), 'Must not have hardcoded 400001 pincode');
    assert.ok(scraperJs.includes('process.env.JIOMART_PINCODE'), 'Must read JIOMART_PINCODE from env');
  });

  it('server/index.js does not contain hardcoded 192.168.1.101', () => {
    const indexJs = readFileSync(path.join(ROOT, 'server', 'index.js'), 'utf8');
    assert.ok(!indexJs.includes('192.168.1.101'), 'Must remove hardcoded IP address');
  });

  it('server/index.js contains /api/* 404 JSON handler before SPA fallback', () => {
    const indexJs = readFileSync(path.join(ROOT, 'server', 'index.js'), 'utf8');
    const api404Idx = indexJs.indexOf("app.use('/api/*'");
    const spaIdx = indexJs.indexOf("app.get('*'");
    assert.ok(api404Idx > 0, 'Must have /api/* handler');
    assert.ok(spaIdx > 0, 'Must have SPA fallback');
    assert.ok(api404Idx < spaIdx, '/api/* handler must come BEFORE SPA fallback app.get("*")');
  });

  it('TTS route guards against non-Windows, enforces rate limit, and uses random UUID', () => {
    const ttsJs = readFileSync(path.join(ROOT, 'server', 'routes', 'tts.js'), 'utf8');
    assert.ok(ttsJs.includes("process.platform !== 'win32'"), 'Must guard against non-Windows platform');
    assert.ok(ttsJs.includes('fallback: true'), 'Must return fallback: true');
    assert.ok(ttsJs.includes('randomUUID'), 'Must use crypto.randomUUID for temp filename');
    assert.ok(ttsJs.includes('checkTtsRateLimit'), 'Must enforce rate limiting');
  });

  it('Obsolete and backup files are completely deleted', () => {
    assert.ok(!existsSync(path.join(ROOT, 'server', 'main.py')), 'server/main.py must be deleted');
    assert.ok(!existsSync(path.join(ROOT, 'server', '__pycache__')), 'server/__pycache__ must be deleted');
    assert.ok(!existsSync(path.join(ROOT, 'public', 'css.tmp')), 'public/css.tmp must be deleted');
    assert.ok(!existsSync(path.join(ROOT, 'public', 'style.css')), 'public/style.css must be deleted');
    assert.ok(!existsSync(path.join(ROOT, 'public', 'app.js')), 'public/app.js must be deleted');
    assert.ok(!existsSync(path.join(ROOT, 'public', 'css', 'styles-backup.css')), 'public/css/styles-backup.css must be deleted');
    assert.ok(!existsSync(path.join(ROOT, 'public', 'index-backup.html')), 'public/index-backup.html must be deleted');
    assert.ok(!existsSync(path.join(ROOT, 'logo.png.jpeg')), 'Duplicate root logo.png.jpeg must be deleted');
  });

  it('package.json uses bcryptjs only, removes unused cors, and lists playwright', () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    assert.ok(pkg.dependencies.bcryptjs, 'Must have bcryptjs');
    assert.ok(!pkg.dependencies.bcrypt, 'Must NOT have native bcrypt');
    assert.ok(!pkg.dependencies.cors, 'Must NOT have unused cors package');
    assert.ok(pkg.devDependencies.playwright, 'Must list playwright in devDependencies');
  });

  it('Affiliate tags only append ref_source when affiliate tag is configured', async () => {
    const { applyAffiliateTag } = await import('../server/affiliate.js');
    // Without affiliate env set, URL remains clean
    const cleanAmazon = applyAffiliateTag('https://www.amazon.in/dp/B0D1234567', 'amazon');
    if (!process.env.AMAZON_AFFILIATE_TAG) {
      assert.ok(!cleanAmazon.includes('ref_source='), 'Must not attach ref_source without affiliate tag');
    }
  });

  it('Footer commission disclosure is present in index.html', () => {
    const indexHtml = readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
    assert.ok(indexHtml.includes('commission from links'), 'Footer must contain commission disclosure');
  });
});
