const db = require('./config/database');

// Seed data for testing
function seedDatabase() {
  console.log('Seeding database with test data...');

  // Insert a test session for today
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const sessionData = {
    course_code: 'TEST101',
    session_date: today,
    start_time: '08:00:00',
    end_time: '18:00:00' // Wide window for testing
  };

  const sql = `INSERT OR IGNORE INTO sessions (course_code, session_date, start_time, end_time) VALUES (?, ?, ?, ?)`;
  db.run(sql, [sessionData.course_code, sessionData.session_date, sessionData.start_time, sessionData.end_time], function(err) {
    if (err) {
      console.error('Error seeding session:', err.message);
    } else {
      console.log(`Test session inserted with ID: ${this.lastID}`);
    }
  });

  // Insert a test student
  const studentData = {
    student_id: '12345',
    name: 'Test Student',
    device_id: 'test-device-123'
  };

  const studentSql = `INSERT OR IGNORE INTO students (student_id, name, device_id) VALUES (?, ?, ?)`;
  db.run(studentSql, [studentData.student_id, studentData.name, studentData.device_id], function(err) {
    if (err) {
      console.error('Error seeding student:', err.message);
    } else {
      console.log(`Test student inserted with ID: ${this.lastID}`);
    }
  });

  console.log('Database seeding completed.');
}

// Run seeding
seedDatabase();

// Close database connection after a short delay
setTimeout(() => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
  });
}, 1000);