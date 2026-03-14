const db = require('../config/database');

class Student {
  // Create a new student
  static create(studentData, callback) {
    const { student_id, name, device_id } = studentData;
    const sql = `INSERT INTO students (student_id, name, device_id) VALUES (?, ?, ?)`;
    db.run(sql, [student_id, name, device_id], function(err) {
      if (err) {
        return callback(err);
      }
      callback(null, { id: this.lastID, ...studentData });
    });
  }

  // Find student by student_id
  static findByStudentId(student_id, callback) {
    const sql = `SELECT * FROM students WHERE student_id = ?`;
    db.get(sql, [student_id], (err, row) => {
      if (err) {
        return callback(err);
      }
      callback(null, row);
    });
  }

  // Get all students
  static getAll(callback) {
    const sql = `SELECT * FROM students ORDER BY created_at DESC`;
    db.all(sql, [], (err, rows) => {
      if (err) {
        return callback(err);
      }
      callback(null, rows);
    });
  }
}

module.exports = Student;