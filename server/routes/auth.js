import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  findUserByEmail,
  findUserById,
  createUser,
  getUserWishlist,
  updateUserProfile,
  updateUserPassword
} from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'haggle_super_secret_key_123';

// Register Route
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const existingUser = await findUserByEmail(trimmedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const displayName = (name && name.trim()) || trimmedEmail.split('@')[0];

    const newUser = await createUser({
      name: displayName,
      email: trimmedEmail,
      password: hashedPassword
    });

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: newUser.id, name: newUser.name, email: newUser.email } });
  } catch (err) {
    if (err.code === 'EMAIL_TAKEN' || err.message === 'EMAIL_TAKEN') {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Current User Profile Route
router.get(['/me', '/profile'], async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    try {
      const user = await findUserById(decoded.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const wishlist = await getUserWishlist(decoded.id);

      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.created_at
        },
        wishlistCount: wishlist.length,
        wishlist
      });
    } catch (dbErr) {
      console.error('Failed to retrieve user profile:', dbErr);
      res.status(500).json({ error: 'Failed to retrieve user profile' });
    }
  });
});

// Update User Profile (Name or Password)
router.put('/profile', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    try {
      const { name, currentPassword, newPassword } = req.body;
      const user = await findUserById(decoded.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      // If user wants to change password
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'Current password is required to set a new password.' });
        }
        if (newPassword.length < 6) {
          return res.status(400).json({ error: 'New password must be at least 6 characters.' });
        }

        const fullUser = await findUserByEmail(user.email);
        const match = await bcrypt.compare(currentPassword, fullUser.password);
        if (!match) {
          return res.status(400).json({ error: 'Current password is incorrect.' });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await updateUserPassword(decoded.id, hashed);
      }

      // If user wants to update name
      let updatedUser = user;
      if (name && name.trim() && name.trim() !== user.name) {
        updatedUser = await updateUserProfile(decoded.id, { name: name.trim() });
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          createdAt: updatedUser.created_at
        }
      });
    } catch (dbErr) {
      console.error('Failed to update profile:', dbErr);
      res.status(500).json({ error: 'Failed to update user profile' });
    }
  });
});

export default router;