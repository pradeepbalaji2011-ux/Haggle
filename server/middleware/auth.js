/**
 * auth.js — JWT authentication middleware
 * Reads the Authorization: Bearer <token> header.
 * Attaches req.user = { id, email, name } on success.
 */

import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../auth.js';

export function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    const secret = process.env.JWT_SECRET || JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    req.user = { id: decoded.id, email: decoded.email, name: decoded.name };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
}
