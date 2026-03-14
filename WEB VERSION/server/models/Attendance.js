const db = require('../config/database');

class Attendance {
  // Create a new attendance record
  static create(attendanceData, callback) {
    const { student_id, session_id, status = 'present' } = attendanceData;
    const sql = `INSERT INTO attendance (student_id, session_id, status) VALUES (?, ?, ?)`;
    db.run(sql, [student_id, session_id, status], function(err) {
      if (err) {
        return callback(err);
      }
      callback(null, { id: this.lastID, ...attendanceData });
    });
  }

  // Check if attendance already exists for student and session
  static exists(student_id, session_id, callback) {
    const sql = `SELECT id FROM attendance WHERE student_id = ? AND session_id = ?`;
    db.get(sql, [student_id, session_id], (err, row) => {
      if (err) {
        return callback(err);
      }
      callback(null, !!row);
    });
  }

  // Get attendance records for a session
  static getBySession(session_id, callback) {
    const sql = `SELECT a.*, s.name as student_name 
                 FROM attendance a 
                 JOIN students s ON a.student_id = s.student_id 
                 WHERE a.session_id = ? 
                 ORDER BY a.scan_time DESC`;
    db.all(sql, [session_id], (err, rows) => {
      if (err) {
        return callback(err);
      }
      callback(null, rows);
    });
  }

  // Get attendance records for a student
  static getByStudent(student_id, callback) {
    const sql = `SELECT a.*, sess.course_code, sess.session_date 
                 FROM attendance a 
                 JOIN sessions sess ON a.session_id = sess.id 
                 WHERE a.student_id = ? 
                 ORDER BY a.scan_time DESC`;
    db.all(sql, [student_id], (err, rows) => {
      if (err) {
        return callback(err);
      }
      callback(null, rows);
    });
  }
}

module.exports = Attendance;