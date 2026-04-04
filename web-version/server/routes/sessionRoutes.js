const express = require('express');
const SessionController = require('../controllers/sessionController');

const router = express.Router();

// Static paths MUST be registered before /:id or Express matches "list" as :id
router.get('/list', SessionController.listSessions);

// POST /api/session/create
router.post('/create', SessionController.createSession);

// POST /api/session/end (body: { session_id })
router.post('/end', SessionController.endSession);

// Param routes must be before GET /:id so paths like /5/end are not captured as id only
router.post('/:id/end', (req, res) => {
  req.body = { ...(req.body || {}), session_id: req.params.id };
  SessionController.endSession(req, res);
});

router.post('/:id/refresh', SessionController.refreshSessionQR);

// GET /api/session/:id
router.get('/:id', SessionController.getSession);

module.exports = router;