const express = require('express');
const QRController = require('../controllers/qrController');

const router = express.Router();

// GET /api/qr/generate?session_id=123
router.get('/generate', QRController.generateQR);

module.exports = router;