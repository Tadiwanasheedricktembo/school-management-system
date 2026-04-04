const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'Authorization required'
    });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid token'
    });
  }
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({
    status: 'error',
    message: 'Admin access required'
  });
}

function requireLecturer(req, res, next) {
  if (req.user && (req.user.role === 'lecturer' || req.user.role === 'admin')) {
    return next();
  }
  return res.status(403).json({
    status: 'error',
    message: 'Lecturer access required'
  });
}

module.exports = {
  verifyAuth,
  requireAdmin,
  requireLecturer
};
