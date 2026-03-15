const express = require('express');
const cors = require('cors');
const path = require('path');

// Import database configuration
require('./config/database');

// Import routes
const qrRoutes = require('./routes/qrRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const SessionController = require('./controllers/sessionController');
const { router: authRoutes, verifyLecturer } = require('./controllers/authController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// increase payload limits to allow selfie data (~5mb)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/attendance', (req, res, next) => {
  // Protect attendance routes except mark (public for students)
  if (req.method === 'POST' && req.path === '/mark') {
    return next();
  }
  verifyLecturer(req, res, next);
}, attendanceRoutes);
app.use('/api/session', (req, res, next) => {
  // Protect session routes except list and health
  if (req.method === 'GET' && (req.path === '/list' || req.path === '/health')) {
    return next();
  }
  verifyLecturer(req, res, next);
}, sessionRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);

  // Periodically close any sessions that have reached their expiry time
  SessionController.startExpiryWatcher();
});

module.exports = app;