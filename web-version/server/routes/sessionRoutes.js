const express = require('express');
const SessionController = require('../controllers/sessionController');

const router = express.Router();

// POST /api/session/create
router.post('/create', SessionController.createSession);

// POST /api/session/end
router.post('/end', SessionController.endSession);

// GET /api/session/list
router.get('/list', SessionController.listSessions);

module.exports = router;