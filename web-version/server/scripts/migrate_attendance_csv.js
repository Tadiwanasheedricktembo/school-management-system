const AttendanceController = require('../controllers/attendanceController');

// Ensure file exists and run migration/normalization if needed.
AttendanceController.ensureDataFile();

console.log('[MIGRATE_DONE] attendance_records.csv normalized');

