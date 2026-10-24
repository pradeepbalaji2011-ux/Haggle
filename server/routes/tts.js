/**
 * server/routes/tts.js — Text-to-Speech via Piper (local, offline, Windows only)
 *
 * POST /api/tts
 * Body: { text: string }
 * Response: audio/wav binary
 *
 * Requires: Piper TTS installed at tools/piper/piper.exe
 * Voice model: tools/piper/en_US-jenny-medium.onnx
 */

import express from 'express';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

function getConfig() {
  try {
    const cfgPath = path.join(__dirname, '../../chatbot-config.json');
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch {
    return {
      piper: {
        exePath: './tools/piper/piper.exe',
        modelPath: './tools/piper/en_US-amy-medium.onnx',
        enabled: true
      }
    };
  }
}

const ttsRateMap = new Map();
function checkTtsRateLimit(ip) {
  const now = Date.now();
  const window = 60 * 1000;
  const times = (ttsRateMap.get(ip) || []).filter(t => now - t < window);
  times.push(now);
  ttsRateMap.set(ip, times);
  return times.length <= 20;
}

router.post('/', async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkTtsRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many TTS requests. Please wait.' });
  }

  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  const safeText = text.slice(0, 500).replace(/[<>]/g, '');

  // Piper TTS is Windows-only; on cloud deployments return fallback immediately
  if (process.platform !== 'win32') {
    return res.status(503).json({ error: 'Piper TTS not available on this server', fallback: true });
  }

  const config = getConfig();
  const piperExe = path.resolve(__dirname, '../../', config.piper?.exePath || './tools/piper/piper.exe');
  const piperModel = path.resolve(__dirname, '../../', config.piper?.modelPath || './tools/piper/en_US-amy-medium.onnx');

  // Check if Piper is available
  if (!config.piper?.enabled || !fs.existsSync(piperExe) || !fs.existsSync(piperModel)) {
    return res.status(503).json({
      error: 'Piper TTS not available',
      message: 'Use browser speechSynthesis as fallback',
      fallback: true
    });
  }

  const tmpFile = path.join(tmpdir(), `haggle-tts-${randomUUID()}.wav`);

  try {
    await new Promise((resolve, reject) => {
      const proc = spawn(piperExe, [
        '--model', piperModel,
        '--output_file', tmpFile
      ]);

      proc.stdin.write(safeText);
      proc.stdin.end();

      let stderr = '';
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`Piper exited ${code}: ${stderr}`));
      });
      proc.on('error', reject);

      // Timeout after 10 seconds
      setTimeout(() => {
        proc.kill();
        reject(new Error('Piper TTS timed out'));
      }, 10000);
    });

    const audio = fs.readFileSync(tmpFile);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', audio.length);
    res.send(audio);
  } catch (err) {
    console.error('[tts] Piper error:', err.message);
    res.status(500).json({ error: 'TTS generation failed', fallback: true });
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
});

export default router;
