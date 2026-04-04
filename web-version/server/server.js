const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');

// Import database configuration
require('./config/database');

// Import routes
const qrRoutes = require('./routes/qrRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const anomalyRoutes = require('./routes/anomalyRoutes');
const SessionController = require('./controllers/sessionController');
const { router: authRoutes, verifyLecturer } = require('./controllers/authController');
const { seedDefaultAdmin } = require('./scripts/seedAdmin');
const { verifyAuth, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
// If HOST is omitted, Node binds to all interfaces. Explicit 0.0.0.0 makes this unambiguous.
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors());
// increase payload limits to allow selfie data (~5mb)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Minimal request logging (helps confirm whether requests reach the server at all)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

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
app.use('/api/admin', verifyAuth, requireAdmin, adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Static file serving for website
console.log('Static website path:', path.join(__dirname, '..', 'website'));
app.use('/website', express.static(path.join(__dirname, '..', 'website')));

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
const server = app.listen(PORT, HOST, () => {
  const addr = server.address();
  const bind =
    typeof addr === 'string'
      ? addr
      : addr
        ? `${addr.address}:${addr.port}`
        : `${HOST}:${PORT}`;

  console.log(`Server is running at http://${bind}`);
  console.log(`Health check: http://${bind}/api/health`);

  const ifaces = os.networkInterfaces();
  const ipv4 = Object.entries(ifaces).flatMap(([name, infos]) =>
    (infos || [])
      .filter((i) => i && i.family === 'IPv4' && !i.internal)
      .map((i) => `${name}: ${i.address}`)
  );
  if (ipv4.length) {
    console.log('LAN IPv4 addresses:');
    ipv4.forEach((s) => console.log(`- ${s}`));
  }

  seedDefaultAdmin().catch((err) => {
    console.error('[SEED_ADMIN] Failed:', err.message);
  });

  // Periodically close any sessions that have reached their expiry time
  SessionController.startExpiryWatcher();
});

module.exports = app;