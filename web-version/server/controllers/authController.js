const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { verifyAuth, requireLecturer } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const rawEmail = (req.body.email || '').toString().trim().toLowerCase();
  const rawUsername = (req.body.username || '').toString().trim();
  const password = (req.body.password || '').toString();
  const identifier = rawEmail || rawUsername.toLowerCase();

  console.log('[AUTH_LOGIN] Login request received: identifier=%s', identifier);

  if (!identifier || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Email/username and password are required'
    });
  }

  const sql = `
    SELECT id, name, email, password_hash, role, is_active
    FROM users
    WHERE lower(email) = ?
       OR lower(name) = ?
    LIMIT 1
  `;

  db.get(sql, [identifier, identifier], async (err, user) => {
    if (err) {
      console.error('[AUTH_LOGIN] DB error:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }

    if (!user) {
      console.log('[AUTH_LOGIN] User not found: %s', identifier);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    if (!user.is_active) {
      console.log('[AUTH_LOGIN] User inactive: %s', identifier);
      return res.status(403).json({
        status: 'error',
        message: 'Account is inactive'
      });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      console.log('[AUTH_LOGIN] Password mismatch for: %s', identifier);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    const tokenPayload = {
      userId: user.id,
      role: user.role,
      email: user.email
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    console.log('[AUTH_LOGIN] Login successful: %s (%s)', identifier, user.role);

    return res.json({
      status: 'success',
      token,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  });
});

// Middleware kept for backwards compatibility with existing route wiring
function verifyLecturer(req, res, next) {
  verifyAuth(req, res, (err) => {
    if (err) return next(err);
    requireLecturer(req, res, next);
  });
}

module.exports = { router, verifyLecturer };