const express = require('express');
const AttendanceController = require('../controllers/attendanceController');

const router = express.Router();

// POST /api/attendance/mark
router.post('/mark', AttendanceController.markAttendance);

// GET /api/attendance/records
router.get('/records', AttendanceController.getAllAttendance);

// GET /api/attendance/download
router.get('/download', AttendanceController.downloadAttendance);

// GET /api/attendance/session/:session_id
router.get('/session/:session_id', AttendanceController.getSessionAttendance);

module.exports = router;