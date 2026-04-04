const express = require('express');
const AnomalyController = require('../controllers/anomalyController');
const auth = require('../middleware/auth');

const router = express.Router();

// All anomaly routes require authentication
router.use(auth);

// GET /api/anomalies - Get anomalies with filtering
router.get('/', AnomalyController.getAnomalies);

// GET /api/anomalies/stats - Get anomaly statistics
router.get('/stats', AnomalyController.getAnomalyStats);

// GET /api/anomalies/session/:session_id - Get anomalies for a specific session
router.get('/session/:session_id', AnomalyController.getSessionAnomalies);

// PUT /api/anomalies/:id/review - Update anomaly review status
router.put('/:id/review', AnomalyController.updateAnomalyReview);

// POST /api/anomalies/bulk-review - Bulk update anomaly reviews
router.post('/bulk-review', AnomalyController.bulkUpdateAnomalyReviews);

module.exports = router;