const bcrypt = require('bcryptjs');
const db = require('../config/database');

function toInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function seedDefaultAdmin() {
  const adminName = (process.env.ADMIN_NAME || 'System Admin').trim();
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
  const adminPassword = (process.env.ADMIN_PASSWORD || 'admin123').trim();
  const rounds = toInt(process.env.BCRYPT_ROUNDS, 10);

  if (!adminEmail || !adminPassword) {
    console.warn('[SEED_ADMIN] Skipped: missing ADMIN_EMAIL or ADMIN_PASSWORD.');
    return { seeded: false, reason: 'missing-env' };
  }

  return new Promise((resolve, reject) => {
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
        return reject(tableErr);
      }

      db.get('SELECT id FROM users WHERE lower(email) = ? LIMIT 1', [adminEmail], async (checkErr, existing) => {
      if (checkErr) {
        return reject(checkErr);
      }

      if (existing) {
        console.log(`[SEED_ADMIN] Admin already exists for ${adminEmail}`);
        return resolve({ seeded: false, reason: 'exists' });
      }

      try {
        const passwordHash = await bcrypt.hash(adminPassword, rounds);
        const insertSql = `
          INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
          VALUES (?, ?, ?, 'admin', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        db.run(insertSql, [adminName, adminEmail, passwordHash], function onInsert(insertErr) {
          if (insertErr) {
            return reject(insertErr);
          }
          console.log(`[SEED_ADMIN] Created default admin: ${adminEmail} (id=${this.lastID})`);
          return resolve({ seeded: true, userId: this.lastID });
        });
      } catch (hashErr) {
        return reject(hashErr);
      }
    });
    });
  });
}

module.exports = {
  seedDefaultAdmin
};
