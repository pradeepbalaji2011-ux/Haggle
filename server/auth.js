/**
 * server/auth.js — Authentication, Password Hashing, Rate Limiting & Sessions
 *
 * Implements:
 * 1. Email normalization (trim whitespace/autofill, lowercase). Never touches password.
 * 2. Password hashing via bcrypt with constant-time verification.
 * 3. Rate limiting: 5 failed attempts per 15 minutes.
 * 4. Specific, actionable errors: "Email not registered", "Wrong password".
 * 5. Secure token sessions & /api/me single source of truth for header & profile.
 * 6. Welcome email on register/login (via mailer.js — never crashes server).
 * 7. Forgot password with OTP: forgot-password / verify-otp / reset-password.
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import {
  normalizeEmail,
  getAllUsers,
  getUserByEmail,
  getUserById,
  createNewUser,
  updateProfile,
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
  markWelcomeEmailSent,
  storeOtpForUser,
  incrementOtpAttempts,
  storeResetToken,
  applyPasswordReset
} from './users.js';
import {
  sendMail,
  verifyMailerConnection,
  getTransporter,
  getWelcomeEmailHtml,
  getOtpEmailHtml,
  getPasswordChangedEmailHtml
} from './mailer.js';

const router = express.Router();

const SITE_URL = process.env.SITE_URL || 'https://haggle-2mki.onrender.com';

export const JWT_SECRET = process.env.JWT_SECRET || 'haggle_super_secret_key_12345';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('[SECURITY NOTICE] Running with default JWT secret. Set JWT_SECRET in your Render dashboard environment variables to secure user sessions.');
}

const TOKEN_EXPIRY = '7d';

// ─── Rate Limiters ─────────────────────────────────────────────────────────────

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

// OTP / forgot-password endpoint rate limiter: 5 reqs per 15 minutes per IP
const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait 15 minutes and try again.' }
});

// ─── Session Helpers ───────────────────────────────────────────────────────────

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

// ─── Auth Routes ───────────────────────────────────────────────────────────────

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

    // Send welcome email asynchronously — never blocks response
    const userName = name && typeof name === 'string' && name.trim() ? name.trim() : cleanEmail.split('@')[0];
    sendMail(cleanEmail, `Welcome to Haggle, ${userName}!`, getWelcomeEmailHtml(userName, SITE_URL))
      .then(sent => { if (sent) markWelcomeEmailSent(cleanEmail); })
      .catch(() => {}); // already handled inside sendMail

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

    // If welcome email was never sent, send it now (catch-up on existing users who signed up before this feature)
    if (!user.welcomeEmailSent) {
      const userName = user.name || cleanEmail.split('@')[0];
      sendMail(cleanEmail, `Welcome to Haggle, ${userName}!`, getWelcomeEmailHtml(userName, SITE_URL))
        .then(sent => { if (sent) markWelcomeEmailSent(cleanEmail); })
        .catch(() => {});
    }

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

    // If the password was changed, email a security confirmation (fire-and-forget)
    if (updates.passwordHash) {
      sendMail(updatedUser.email, 'Your Haggle password was changed', getPasswordChangedEmailHtml()).catch(() => {});
    }
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

// ─── Forgot Password / OTP Flow ────────────────────────────────────────────────

// In-memory OTP cooldown tracker (email → timestamp of last OTP send)
const otpCooldowns = new Map();
const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds

/**
 * POST /api/auth/forgot-password
 * Generates a 6-digit OTP, stores its hash + expiry, emails it.
 * Always returns the same generic message (no email enumeration).
 */
router.post('/forgot-password', otpRateLimiter, async (req, res) => {
  // Always respond with the same message to prevent email enumeration
  const GENERIC_RESPONSE = { success: true, message: 'If this email is registered, an OTP has been sent.' };

  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.json(GENERIC_RESPONSE);
    }

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.json(GENERIC_RESPONSE);
    }

    // Check cooldown (60 seconds between resend requests)
    const lastSent = otpCooldowns.get(cleanEmail);
    const now = Date.now();
    if (lastSent && now - lastSent < OTP_COOLDOWN_MS) {
      const waitSecs = Math.ceil((OTP_COOLDOWN_MS - (now - lastSent)) / 1000);
      return res.status(429).json({ error: `Please wait ${waitSecs} seconds before requesting another OTP.` });
    }

    const user = await getUserByEmail(cleanEmail);
    if (!user) {
      // Still return generic response — don't reveal if email exists
      return res.json(GENERIC_RESPONSE);
    }

    // Generate a random 6-digit OTP
    const otp = String(crypto.randomInt(100000, 999999));

    // Hash the OTP — never store plaintext
    const otpHash = await bcrypt.hash(otp, 8); // lower rounds = faster for OTP
    const expiresAt = new Date(now + 10 * 60 * 1000).toISOString(); // 10 minutes

    storeOtpForUser(cleanEmail, otpHash, expiresAt);
    otpCooldowns.set(cleanEmail, now);

    // Send OTP email (fire-and-forget)
    sendMail(cleanEmail, 'Your Haggle password reset code', getOtpEmailHtml(otp))
      .catch(() => {});

    return res.json(GENERIC_RESPONSE);
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.json({ success: true, message: 'If this email is registered, an OTP has been sent.' });
  }
});

/**
 * POST /api/auth/verify-otp
 * Validates OTP against hash + expiry. Returns a short-lived single-use reset token.
 */
router.post('/verify-otp', otpRateLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    const cleanEmail = normalizeEmail(email);
    const user = await getUserByEmail(cleanEmail);

    if (!user || !user.otpHash || !user.otpExpiry) {
      return res.status(400).json({ error: 'No OTP request found. Please request a new OTP.' });
    }

    // Check expiry
    if (Date.now() > new Date(user.otpExpiry).getTime()) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Check attempt limit (max 5)
    if ((user.otpAttempts || 0) >= 5) {
      return res.status(400).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }

    // Verify OTP
    const isValid = await bcrypt.compare(String(otp).trim(), user.otpHash);
    if (!isValid) {
      const attempts = incrementOtpAttempts(cleanEmail);
      const remaining = Math.max(0, 5 - attempts);
      return res.status(400).json({
        error: remaining > 0
          ? `Invalid OTP. ${remaining} attempt(s) remaining.`
          : 'Too many failed attempts. Please request a new OTP.'
      });
    }

    // OTP valid — generate a single-use reset token (random 48-char hex)
    const resetToken = crypto.randomBytes(24).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    storeResetToken(cleanEmail, resetToken, resetTokenExpiry);

    return res.json({ success: true, resetToken });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ error: 'Network problem, try again.' });
  }
});

/**
 * POST /api/auth/reset-password
 * Accepts a valid reset token + new password, updates password, sends confirmation email.
 */
router.post('/reset-password', otpRateLimiter, async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body || {};

    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required.' });
    }

    // Validate password
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'Password must contain at least one letter and one number.' });
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const email = applyPasswordReset(resetToken, passwordHash);

    if (!email) {
      return res.status(400).json({ error: 'Invalid or expired reset token. Please request a new OTP.' });
    }

    res.json({ success: true, message: 'Password updated successfully. Please log in with your new password.' });

    // Send confirmation email (fire-and-forget)
    sendMail(email, 'Your Haggle password was changed', getPasswordChangedEmailHtml()).catch(() => {});

  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Network problem, try again.' });
  }
});

/**
 * GET /api/auth/diagnostic-email
 * Live diagnostic route to check SMTP status and test-send
 */
router.get('/diagnostic-email', async (req, res) => {
  const to = req.query.to || (process.env.EMAIL_USER || 'haggledeals26@gmail.com').trim();
  try {
    const sent = await sendMail(
      to,
      '🎉 Haggle Live Email Test (HTTPS Webhook)',
      getWelcomeEmailHtml('Shopper', SITE_URL)
    );
    if (sent) {
      return res.json({ ok: true, channel: 'https_webhook', deliveredTo: to });
    } else {
      return res.status(500).json({ ok: false, error: 'Email delivery failed across all channels' });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
