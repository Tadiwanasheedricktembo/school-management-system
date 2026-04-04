const { v4: uuidv4 } = require('uuid');
const Token = require('../models/Token');

/** Lazy require — never import sessionController at module top (avoids circular init with sessionController → tokenService). */
function loadSessionController() {
  return require('../controllers/sessionController');
}

class TokenService {
  // Generate a new token for a session
  static generateToken(session_id, callback) {
    console.log('[TOKEN_SERVICE] generateToken invoked; typeof generateToken:', typeof TokenService.generateToken, 'session_id:', session_id);

    const token = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 1000); // 10 seconds from now (longer than 5s refresh)
    const expires_at = expiresAt.toISOString();

    const tokenData = {
      token,
      session_id,
      expires_at
    };

    Token.create(tokenData, (err, result) => {
      if (err) {
        console.error('[TOKEN_SERVICE] Error generating token:', err);
        return callback(err);
      }

      if (!result || result.token == null || result.token === '') {
        console.error('[TOKEN_SERVICE] Token.create returned no token string:', result);
        return callback(new Error('Token storage returned no token data'));
      }

      const out = {
        token: result.token,
        token_uuid: result.token_uuid || result.token,
        id: result.id,
        session_id: result.session_id,
        expires_at: result.expires_at
      };

      console.log('TOKEN DATA RETURNED:', out);
      console.log(`[TOKEN_GENERATED] Token: ${out.token}`);
      console.log(`  Session ID: ${session_id}`);
      console.log(`  Generated at: ${now.toISOString()}`);
      console.log(`  Expires at: ${expires_at}`);
      console.log(`  TTL: 10 seconds`);
      callback(null, out);
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

        // Ensure session is still active (server time is source of truth)
        const SessionController = loadSessionController();
        SessionController.getSessionById(tokenRow.session_id, (err, session) => {
          if (err) {
            return callback(err);
          }

          if (!session) {
            console.log(`[TOKEN_INVALID] Session not found for token: ${token}`);
            return callback(null, { valid: false, reason: 'Invalid session' });
          }

          if (session.is_closed) {
            const reason = SessionController.isExpired(session)
              ? 'Session has expired and is now closed'
              : 'Session closed';
            console.log(`[TOKEN_INVALID] ${reason} for token: ${token}`);
            return callback(null, { valid: false, reason });
          }

          console.log(`  ✅ VALID`);
          callback(null, { valid: true, session_id: tokenRow.session_id });
        });
      });
    });
  }
}

console.log('[TOKEN_SERVICE] module initialized; TokenService.generateToken:', typeof TokenService.generateToken);

module.exports = TokenService;