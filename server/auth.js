/**
 * server/auth.js — Authentication, Password Hashing, Rate Limiting & Sessions
 *
 * Implements:
 * 1. Email normalization (trim whitespace/autofill, lowercase). Never touches password.
 * 2. Password hashing via bcrypt with constant-time verification.
 * 3. Rate limiting: 5 failed attempts per 15 minutes.
 * 4. Specific, actionable errors: "Email not registered", "Wrong password".
 * 5. Secure token sessions & /api/me single source of truth for header & profile.
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  normalizeEmail,
  getUserByEmail,
  getUserById,
  createNewUser,
  updateProfile,
  getWishlist,
  addWishlistItem,
  removeWishlistItem
} from './users.js';

const router = express.Router();

export const JWT_SECRET = process.env.JWT_SECRET || 'haggle_super_secret_key_12345';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'haggle_super_secret_key_12345')) {
  console.error('[SECURITY WARNING] Running with default JWT secret in production is prohibited.');
  throw new Error('FATAL: A strong, unique JWT_SECRET environment variable is required in production.');
}

const TOKEN_EXPIRY = '7d';

// Rate Limiter: Bounded in-memory store for failed login attempts
// Key: normalized email or IP, Value: { count: number, resetAt: number }
const loginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_TRACKED_ATTEMPTS = 2000;

export function checkLoginRateLimit(key) {
  const record = loginAttempts.get(key);
  const now = Date.now();

  if (record) {
    if (now < record.resetAt) {
      if (record.count >= MAX_FAILED_ATTEMPTS) {
        const remainingMinutes = Math.ceil((record.resetAt - now) / 60000);
        return {
          allowed: false,
          error: `Too many failed login attempts. Please wait ${remainingMinutes} minute(s) before trying again.`
        };
      }
    } else {
      // Window expired, reset
      loginAttempts.delete(key);
    }
  }

  return { allowed: true };
}

export function recordFailedLogin(key) {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (record && now < record.resetAt) {
    record.count++;
  } else {
    // If tracking cap reached, prune expired entries or oldest to prevent memory leaks
    if (loginAttempts.size >= MAX_TRACKED_ATTEMPTS) {
      for (const [k, v] of loginAttempts.entries()) {
        if (now >= v.resetAt) {
          loginAttempts.delete(k);
        }
      }
      if (loginAttempts.size >= MAX_TRACKED_ATTEMPTS) {
        const oldestKey = loginAttempts.keys().next().value;
        if (oldestKey !== undefined) loginAttempts.delete(oldestKey);
      }
    }
    loginAttempts.set(key, { count: 1, resetAt: now + LOCKOUT_WINDOW_MS });
  }
}

export function resetLoginAttempts(key) {
  loginAttempts.delete(key);
}

// Periodic cleanup of expired rate limits every 15 minutes
const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of loginAttempts.entries()) {
    if (now >= v.resetAt) {
      loginAttempts.delete(k);
    }
  }
}, 15 * 60 * 1000);
if (rateLimitCleanupTimer.unref) rateLimitCleanupTimer.unref();

/**
 * Extracts and verifies JWT from Authorization header or cookie
 */
export function verifySessionToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Express middleware to authenticate session
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Please log in to continue.' });
  }

  const decoded = verifySessionToken(token);
  if (!decoded || !decoded.id) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }

  req.userId = decoded.id;
  next();
}

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Please enter a password.' });
    }

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const existingUser = await getUserByEmail(cleanEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await createNewUser({
      name,
      email: cleanEmail,
      passwordHash
    });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Network problem, try again' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = normalizeEmail(email);
    const rateLimitKey = `${cleanEmail}|${ip}`;

    // 1. Check Rate Limiting
    const rateCheck = checkLoginRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: rateCheck.error });
    }

    // 2. Lookup user by normalized email
    const user = await getUserByEmail(cleanEmail);

    // 3. Constant-time password check (uses dummy hash if user does not exist to prevent timing attacks)
    const DUMMY_HASH = '$2a$10$7EqJtq98hPqEX7fNZaFWoOhiMbxC2/gIer3i2.f4Lh5gQ.Pquf6uG';
    const hashToCompare = user?.passwordHash || user?.password || DUMMY_HASH;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatch) {
      recordFailedLogin(rateLimitKey);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Reset rate limiter on successful authentication
    resetLoginAttempts(rateLimitKey);

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    const wishlist = await getWishlist(user.id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      },
      wishlist
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Network problem, try again' });
  }
});

/**
 * GET /api/me & GET /api/auth/me
 * Single source of truth for both header and profile page
 */
export async function handleMeEndpoint(req, res) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Session expired or not logged in' });
  }

  const decoded = verifySessionToken(token);
  if (!decoded || !decoded.id) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  try {
    const user = await getUserById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const wishlist = await getWishlist(user.id);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      },
      wishlistCount: wishlist.length,
      wishlist
    });
  } catch (err) {
    console.error('Me endpoint error:', err);
    res.status(500).json({ error: 'Network problem, try again' });
  }
}

router.get('/me', handleMeEndpoint);
router.get('/profile', handleMeEndpoint);

/**
 * PUT /api/auth/profile — Update name or password
 */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body || {};
    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updates = {};

    if (name && typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to set a new password.' });
      }
      const match = await bcrypt.compare(currentPassword, user.passwordHash || user.password || '');
      if (!match) {
        return res.status(400).json({ error: 'Wrong password' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }
      updates.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updatedUser = await updateProfile(req.userId, updates);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        createdAt: updatedUser.createdAt
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Network problem, try again' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (_req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
