const express = require('express');
const AdminController = require('../controllers/adminController');

const router = express.Router();

router.get('/dashboard/stats', AdminController.getDashboardStats);

router.get('/lecturers', AdminController.getLecturers);
router.post('/lecturers', AdminController.createLecturer);
router.put('/lecturers/:id', AdminController.updateLecturer);
router.patch('/lecturers/:id/status', AdminController.updateLecturerStatus);

router.get('/courses', AdminController.getCourses);
router.post('/courses', AdminController.createCourse);
router.put('/courses/:id', AdminController.updateCourse);
router.post('/lecturers/:id/assign-course', AdminController.assignCourse);

router.get('/sessions', AdminController.getSessions);
router.get('/attendance', AdminController.getAttendance);
router.delete('/attendance/:id', AdminController.deleteAttendance);

router.get('/audit-logs', AdminController.getAuditLogs);

module.exports = router;
