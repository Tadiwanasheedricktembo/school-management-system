const bcrypt = require('bcryptjs');
const db = require('../config/database');

function usage() {
  console.log('Usage: node scripts/createLecturer.js "Name" "email@example.com" "password"');
}

async function run() {
  const [, , nameArg, emailArg, passwordArg] = process.argv;
  const name = (nameArg || '').trim();
  const email = (emailArg || '').trim().toLowerCase();
  const password = (passwordArg || '').trim();
  const rounds = Number(process.env.BCRYPT_ROUNDS) || 10;

  if (!name || !email || !password) {
    usage();
    process.exitCode = 1;
    return;
  }

  const ensureUsersTableSql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'lecturer')),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.run(ensureUsersTableSql, (tableErr) => {
    if (tableErr) {
      console.error('[CREATE_LECTURER] Failed to ensure users table:', tableErr.message);
      process.exitCode = 1;
      return;
    }

    db.get('SELECT id FROM users WHERE lower(email) = ? LIMIT 1', [email], async (checkErr, existing) => {
    if (checkErr) {
      console.error('[CREATE_LECTURER] Failed to read users:', checkErr.message);
      process.exitCode = 1;
      return;
    }

    if (existing) {
      console.error(`[CREATE_LECTURER] User already exists with email: ${email}`);
      process.exitCode = 1;
      return;
    }

    try {
      const passwordHash = await bcrypt.hash(password, rounds);
      const sql = `
        INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 'lecturer', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      db.run(sql, [name, email, passwordHash], function onInsert(err) {
        if (err) {
          console.error('[CREATE_LECTURER] Failed to insert user:', err.message);
          process.exitCode = 1;
          return;
        }

        console.log(`[CREATE_LECTURER] Lecturer created: ${email} (id=${this.lastID})`);
      });
    } catch (hashErr) {
      console.error('[CREATE_LECTURER] Failed to hash password:', hashErr.message);
      process.exitCode = 1;
    }
  });
  });
}

run();
