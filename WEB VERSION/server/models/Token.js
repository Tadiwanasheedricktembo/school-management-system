const db = require('../config/database');

class Token {
  // Create a new token
  static create(tokenData, callback) {
    const { token, session_id, expires_at } = tokenData;
    const sql = `INSERT INTO qr_tokens (token, session_id, expires_at) VALUES (?, ?, ?)`;
    db.run(sql, [token, session_id, expires_at], function(err) {
      if (err) {
        return callback(err);
      }
      callback(null, { id: this.lastID, ...tokenData });
    });
  }

  // Find token by token string
  static findByToken(token, callback) {
    const sql = `SELECT * FROM qr_tokens WHERE token = ?`;
    db.get(sql, [token], (err, row) => {
      if (err) {
        return callback(err);
      }
      callback(null, row);
    });
  }

  // Check if token is expired
  static isExpired(tokenRow, callback) {
    const now = new Date();
    const expiresAt = new Date(tokenRow.expires_at);
    
    // Ensure proper date parsing
    if (isNaN(expiresAt.getTime())) {
      console.error('Invalid expires_at format:', tokenRow.expires_at);
      return callback(null, true); // Treat as expired if date is invalid
    }
    
    const isExpired = now.getTime() > expiresAt.getTime();
    callback(null, isExpired);
  }

  // Clean up expired tokens (optional maintenance)
  static cleanupExpired(callback) {
    const sql = `DELETE FROM qr_tokens WHERE expires_at < datetime('now')`;
    db.run(sql, [], function(err) {
      if (err) {
        return callback(err);
      }
      callback(null, this.changes);
    });
  }
}

module.exports = Token;