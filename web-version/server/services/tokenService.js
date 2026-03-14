const { v4: uuidv4 } = require('uuid');
const Token = require('../models/Token');

class TokenService {
  // Generate a new token for a session
  static generateToken(session_id, callback) {
    const token = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 1000); // 30 seconds from now
    const expires_at = expiresAt.toISOString();

    const tokenData = {
      token,
      session_id,
      expires_at
    };

    Token.create(tokenData, (err, result) => {
      if (err) {
        console.error('Error generating token:', err);
        return callback(err);
      }
      
      console.log(`[TOKEN_GENERATED] Token: ${token}`);
      console.log(`  Session ID: ${session_id}`);
      console.log(`  Generated at: ${now.toISOString()}`);
      console.log(`  Expires at: ${expires_at}`);
      console.log(`  TTL: 30 seconds`);
      callback(null, result);
    });
  }

  // Validate a token
  static validateToken(token, callback) {
    Token.findByToken(token, (err, tokenRow) => {
      if (err) {
        return callback(err);
      }

      if (!tokenRow) {
        console.log(`[TOKEN_INVALID] Token not found: ${token}`);
        return callback(null, { valid: false, reason: 'Invalid QR' });
      }

      Token.isExpired(tokenRow, (err, expired) => {
        if (err) {
          return callback(err);
        }

        const now = new Date();
        const expiresAt = new Date(tokenRow.expires_at);
        const timeRemaining = Math.round((expiresAt - now) / 1000);

        console.log(`[TOKEN_VALIDATION] Token: ${token}`);
        console.log(`  Current server time: ${now.toISOString()}`);
        console.log(`  Token expires at: ${tokenRow.expires_at}`);
        console.log(`  Time remaining: ${timeRemaining} seconds`);

        if (expired) {
          console.log(`  ❌ EXPIRED (seconds overdue: ${Math.abs(timeRemaining)})`);
          return callback(null, { valid: false, reason: 'QR expired', session_id: tokenRow.session_id });
        }

        console.log(`  ✅ VALID`);
        callback(null, { valid: true, session_id: tokenRow.session_id });
      });
    });
  }
}

module.exports = TokenService;