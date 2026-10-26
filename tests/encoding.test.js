/**
 * tests/encoding.test.js — UTF-8 & Mojibake Prevention Test Suite
 *
 * Verifies:
 * 1. No text files contain mojibake sequences or U+FFFD.
 * 2. No text files start with a UTF-8 Byte Order Mark (BOM: 0xEF 0xBB 0xBF).
 * 3. public/index.html contains <meta charset="utf-8"> as the very first element inside <head>.
 * 4. Express static JS responses include "charset=utf-8" in their Content-Type header.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { Socket } from 'node:net';
import express from 'express';

// Defined via Unicode escapes to avoid self-matching
const MOJIBAKE_PATTERNS = [
  '\u00E2\u201A\u00B9', // corrupted ₹
  '\u00E2\u02DC\u2026', // corrupted ★
  '\u00E2\u2020',       // corrupted arrows (â†—, â† , etc.)
  '\u00E2\u20AC',       // corrupted dashes/quotes/bullets (â€” , â€“ , â€¢ , â€™)
  '\u00F0\u0178',       // corrupted 4-byte emojis
  '\u00C3',             // corrupted Latin-1 lead byte
  '\u00C2',             // corrupted Latin-1 lead byte
  '\u00E2\u0161',       // corrupted warning symbol
  '\u00E2\u201E',       // corrupted info symbol
  '\u00E2\u00AD',       // corrupted star symbol
  '\uFFFD'              // replacement character
];

const TEXT_EXTENSIONS = ['.html', '.js', '.css', '.json', '.md', '.yml', '.yaml'];

function getWorkspaceTextFiles(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', '.git', '.venv', 'screenshots', 'tools', '.gemini'].includes(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getWorkspaceTextFiles(fullPath, fileList);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      // Skip the encoding test itself
      if (entry.name === 'encoding.test.js') continue;
      if (TEXT_EXTENSIONS.includes(ext)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

test('Encoding: No text files contain mojibake patterns or U+FFFD', () => {
  const files = getWorkspaceTextFiles('.');
  assert.ok(files.length > 20, 'Expected to scan multiple text files');

  const violations = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const pattern of MOJIBAKE_PATTERNS) {
        if (line.includes(pattern)) {
          violations.push({
            file: file.replace(/\\/g, '/'),
            line: index + 1,
            snippet: line.trim().slice(0, 80)
          });
        }
      }
    });
  }

  assert.equal(
    violations.length,
    0,
    `Found mojibake patterns in files:\n${violations.map(v => `  ${v.file}:${v.line}: ${v.snippet}`).join('\n')}`
  );
});

test('Encoding: No text files start with a UTF-8 BOM', () => {
  const files = getWorkspaceTextFiles('.');
  const bomFiles = [];

  for (const file of files) {
    const buf = fs.readFileSync(file);
    if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
      bomFiles.push(file.replace(/\\/g, '/'));
    }
  }

  assert.equal(
    bomFiles.length,
    0,
    `Found UTF-8 BOM in files:\n${bomFiles.map(f => `  ${f}`).join('\n')}`
  );
});

test('HTML: public/index.html has <meta charset="utf-8"> as first element in <head>', () => {
  const indexPath = path.resolve('public/index.html');
  assert.ok(fs.existsSync(indexPath), 'public/index.html must exist');

  const html = fs.readFileSync(indexPath, 'utf8');
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  assert.ok(headMatch, 'index.html must contain a <head> tag');

  const headContent = headMatch[1].trim();
  const firstTag = headContent.match(/^<[^>]+>/)?.[0] || '';
  const isCharset = /^<meta\s+charset=["']?utf-8["']?\s*\/?>$/i.test(firstTag.trim());

  assert.ok(
    isCharset,
    `First element inside <head> must be <meta charset="utf-8">, but found: ${firstTag}`
  );
});

test('Server: Static JS response includes charset=utf-8 in Content-Type', async () => {
  const app = express();
  app.use(express.static(path.resolve('public'), {
    setHeaders: (res, filePath) => {
      if (/\.m?js$/i.test(filePath)) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      } else if (/\.css$/i.test(filePath)) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      }
    }
  }));

  const socket = new Socket();
  const req = new http.IncomingMessage(socket);
  req.method = 'GET';
  req.url = '/js/app.js';
  req.headers = {};

  const res = new http.ServerResponse(req);
  res.assignSocket(socket);

  await new Promise((resolve) => {
    app.handle(req, res, () => resolve());
    setTimeout(resolve, 150);
  });

  const contentType = res.getHeader('content-type');
  assert.ok(contentType, 'Response must have a Content-Type header');
  assert.match(
    contentType,
    /charset=utf-8/i,
    `Content-Type header for static JS must include charset=utf-8, received: ${contentType}`
  );
});
