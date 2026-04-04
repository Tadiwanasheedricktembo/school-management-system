const db = require('../config/database');

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      return resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function logAudit(actorUserId, action, targetType, targetId, details) {
  const detailsJson = details ? JSON.stringify(details) : null;
  const sql = `
    INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details)
    VALUES (?, ?, ?, ?, ?)
  `;
  return runAsync(sql, [actorUserId, action, targetType, targetId || null, detailsJson]);
}

module.exports = {
  logAudit
};
