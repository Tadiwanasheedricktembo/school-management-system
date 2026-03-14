const db = require('../config/database');

class Session {
  // Create a new session
  static create(sessionData, callback) {
    const { course_code, session_date, start_time, end_time, is_closed = 0 } = sessionData;
    const sql = `INSERT INTO sessions (course_code, session_date, start_time, end_time, is_closed) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [course_code, session_date, start_time, end_time, is_closed], function(err) {
      if (err) {
        return callback(err);
      }
      callback(null, { id: this.lastID, ...sessionData });
    });
  }

  // Find session by ID
  static findById(id, callback) {
    const sql = `SELECT *, is_closed FROM sessions WHERE id = ?`;
    db.get(sql, [id], (err, row) => {
      if (err) {
        return callback(err);
      }
      callback(null, row);
    });
  }

  // Get all sessions
  static getAll(callback) {
    const sql = `SELECT *, is_closed FROM sessions ORDER BY created_at DESC`;
    db.all(sql, [], (err, rows) => {
      if (err) {
        return callback(err);
      }
      callback(null, rows);
    });
  }

  // Check if current time is within session time window
  static isWithinTimeWindow(session, callback) {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS

    // Check if session date matches today and time is within range
    const isValidDate = session.session_date === currentDate;
    const isValidTime = currentTime >= session.start_time && currentTime <= session.end_time;

    callback(null, isValidDate && isValidTime);
  }
}

module.exports = Session;