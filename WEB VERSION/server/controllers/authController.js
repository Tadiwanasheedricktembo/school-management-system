const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Simple hardcoded lecturer credentials (in production, use database)
const LECTURER_USERNAME = 'lecturer';
const LECTURER_PASSWORD = 'password123';
const JWT_SECRET = 'your-secret-key'; // Change this in production

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === LECTURER_USERNAME && password === LECTURER_PASSWORD) {
    // Generate a simple token (for demo purposes)
    const token = jwt.sign({ role: 'lecturer' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      status: 'success',
      token: token,
      message: 'Login successful'
    });
  } else {
    res.status(401).json({
      status: 'error',
      message: 'Invalid credentials'
    });
  }
});

// Middleware to verify lecturer auth
function verifyLecturer(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'Authorization required'
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer '
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role === 'lecturer') {
      req.user = decoded;
      next();
    } else {
      res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions'
      });
    }
  } catch (err) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid token'
    });
  }
}

module.exports = { router, verifyLecturer };