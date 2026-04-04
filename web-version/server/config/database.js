const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database path
const dbPath = path.join(__dirname, '..', 'attendance.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      device_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_code TEXT NOT NULL,
      session_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      is_closed INTEGER DEFAULT 0,
      course_name TEXT,
      class_name TEXT,
      lecturer_name TEXT,
      note TEXT,
      label TEXT,
      class_latitude REAL,
      class_longitude REAL,
      allowed_radius_meters REAL DEFAULT 100,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS qr_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      session_id INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions (id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      session_id INTEGER NOT NULL,
      scan_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'present',
      device_id TEXT,
      latitude REAL,
      longitude REAL,
      gps_accuracy REAL,
      distance_from_class_meters REAL,
      selfie TEXT,
      anomaly_flags TEXT,
      anomaly_score INTEGER DEFAULT 0,
      anomaly_severity TEXT DEFAULT 'none',
      anomaly_review_status TEXT DEFAULT 'pending',
      anomaly_notes TEXT,
      lecturer_id INTEGER,
      FOREIGN KEY (student_id) REFERENCES students (student_id),
      FOREIGN KEY (session_id) REFERENCES sessions (id),
      UNIQUE(student_id, session_id)
    )`,

    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'lecturer')),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (actor_user_id) REFERENCES users (id)
    )`,

    `CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_name TEXT NOT NULL,
      course_code TEXT NOT NULL UNIQUE,
      department TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS lecturer_courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lecturer_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(lecturer_id, course_id),
      FOREIGN KEY (lecturer_id) REFERENCES users (id),
      FOREIGN KEY (course_id) REFERENCES courses (id)
    )`
  ];

  tables.forEach((sql) => {
    db.run(sql, (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      }
    });
  });

  // Run migrations after table creation
  setTimeout(() => {
    runMigrations();
  }, 1000);
}

// Run database migrations for existing installations
function runMigrations() {
  console.log('[DB_MIGRATION] Checking for required migrations...');

  // Migration 1: Add location and anomaly fields to attendance table
  db.all("PRAGMA table_info(attendance)", (err, columns) => {
    if (err) {
      console.error('[DB_MIGRATION] Error checking attendance table:', err.message);
      return;
    }

    const columnNames = columns.map(col => col.name);
    const migrations = [];

    if (!columnNames.includes('device_id')) {
      migrations.push('ALTER TABLE attendance ADD COLUMN device_id TEXT');
    }
    if (!columnNames.includes('latitude')) {
      migrations.push('ALTER TABLE attendance ADD COLUMN latitude REAL');
    }
    if (!columnNames.includes('longitude')) {
      migrations.push('ALTER TABLE attendance ADD COLUMN longitude REAL');
    }
    if (!columnNames.includes('gps_accuracy')) {
      migrations.push('ALTER TABLE attendance ADD COLUMN gps_accuracy REAL');
    }
    if (!columnNames.includes('distance_from_class_meters')) {
      migrations.push('ALTER TABLE attendance ADD COLUMN distance_from_class_meters REAL');
    }
    if (!columnNames.includes('selfie')) {
      migrations.push('ALTER TABLE attendance ADD COLUMN selfie TEXT');
    }
    if (!columnNames.includes('anomaly_flags')) {
      migrations.push('ALTER TABLE attendance ADD COLUMN anomaly_flags TEXT');
    }
    if (!columnNames.includes('anomaly_score')) {
      migrations.push('ALTER TABLE attendance ADD COLUMN anomaly_score INTEGER DEFAULT 0');
    }
    if (!columnNames.includes('anomaly_severity')) {
      migrations.push('ALTER TABLE attendance ADD COLUMN anomaly_severity TEXT DEFAULT \'none\'');
    }
    if (!columnNames.includes('anomaly_review_status')) {
      migrations.push('ALTER TABLE attendance ADD COLUMN anomaly_review_status TEXT DEFAULT \'pending\'');
    }
    if (!columnNames.includes('anomaly_notes')) {
      migrations.push('ALTER TABLE attendance ADD COLUMN anomaly_notes TEXT');
    }
    if (!columnNames.includes('lecturer_id')) {
      migrations.push('ALTER TABLE attendance ADD COLUMN lecturer_id INTEGER');
    }

    // Run attendance table migrations
    migrations.forEach(sql => {
      db.run(sql, (err) => {
        if (err) {
          console.error('[DB_MIGRATION] Error running migration:', sql, err.message);
        } else {
          console.log('[DB_MIGRATION] Applied:', sql);
        }
      });
    });
  });

  // Migration 2: Add location fields to sessions table
  db.all("PRAGMA table_info(sessions)", (err, columns) => {
    if (err) {
      console.error('[DB_MIGRATION] Error checking sessions table:', err.message);
      return;
    }

    const columnNames = columns.map(col => col.name);
    const sessionMigrations = [];

    if (!columnNames.includes('class_latitude')) {
      sessionMigrations.push('ALTER TABLE sessions ADD COLUMN class_latitude REAL');
    }
    if (!columnNames.includes('class_longitude')) {
      sessionMigrations.push('ALTER TABLE sessions ADD COLUMN class_longitude REAL');
    }
    if (!columnNames.includes('allowed_radius_meters')) {
      sessionMigrations.push('ALTER TABLE sessions ADD COLUMN allowed_radius_meters REAL DEFAULT 100');
    }

    // Run session table migrations
    sessionMigrations.forEach(sql => {
      db.run(sql, (err) => {
        if (err) {
          console.error('[DB_MIGRATION] Error running session migration:', sql, err.message);
        } else {
          console.log('[DB_MIGRATION] Applied session migration:', sql);
        }
      });
    });
  });
}

module.exports = db;