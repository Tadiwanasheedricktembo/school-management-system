const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const Token = require('../models/Token');

const TOKEN_SERVICE_PATH = require.resolve('../services/tokenService');

let _tokenServiceLogged = false;

/** Resolves tokenService after sessionController loads; reloads if circular-init left an incomplete export. */
function getTokenService() {
  let ts = require('../services/tokenService');
  if (typeof ts.generateToken !== 'function') {
    console.warn('[SESSION_GET] TokenService.generateToken missing; clearing module cache and reloading');
    delete require.cache[TOKEN_SERVICE_PATH];
    ts = require('../services/tokenService');
  }
  if (!_tokenServiceLogged) {
    console.log('[SESSION_GET] TokenService OK; generateToken:', typeof ts.generateToken);
    _tokenServiceLogged = true;
  }
  return ts;
}

const SESSIONS_FILE = path.join(__dirname, '..', 'data', 'sessions.json');
const DATA_DIR = path.join(__dirname, '..', 'data');

function getAuthUserId(req) {
  if (!req.user) return NaN;
  const raw = req.user.userId != null ? req.user.userId : req.user.id;
  return Number(raw);
}

class SessionController {
  // Ensure data directory exists
  static ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      console.log(`[SESSION_SETUP] Creating directory: ${DATA_DIR}`);
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  // Read sessions from file
  static readSessions(callback) {
    fs.readFile(SESSIONS_FILE, 'utf8', (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // File doesn't exist yet, return empty array
          return callback(null, []);
        }
        return callback(err);
      }

      try {
        const sessions = JSON.parse(data);
        callback(null, Array.isArray(sessions) ? sessions : []);
      } catch (parseErr) {
        console.error('[SESSION_READ] Error parsing sessions.json:', parseErr);
        callback(parseErr);
      }
    });
  }

  // Write sessions to file
  static writeSessions(sessions, callback) {
    const jsonData = JSON.stringify(sessions, null, 2);
    fs.writeFile(SESSIONS_FILE, jsonData, 'utf8', callback);
  }

  // Helpers --------------------------------------------------------------
  static getWindowMinutes(session) {
    const n = Number(session.attendance_window_minutes);
    if (!Number.isFinite(n) || n <= 0) {
      return 10;
    }
    return n;
  }

  /**
   * Single source of truth: expiry = created_at + attendance_window_minutes (server time).
   * Do NOT trust stored expiry_time alone — bad/migrated JSON could mark sessions expired instantly.
   */
  static computeExpiryTime(session) {
    const windowMs = SessionController.getWindowMinutes(session) * 60 * 1000;
    const createdAt = session.created_at ? new Date(session.created_at) : new Date();
    if (Number.isNaN(createdAt.getTime())) {
      console.warn('[SESSION_EXPIRY] Invalid created_at; using server now + window', {
        session_id: session.session_id,
        created_at: session.created_at
      });
      const now = new Date();
      return new Date(now.getTime() + windowMs);
    }
    return new Date(createdAt.getTime() + windowMs);
  }

  static isExpired(session) {
    const expiryTime = SessionController.computeExpiryTime(session);
    const now = new Date();
    const expired = now > expiryTime;
    return expired;
  }

  static normalizeSession(session) {
    // ensure defaults for backwards compatibility
    session.attendance_window_minutes = SessionController.getWindowMinutes(session);
    session.is_closed = !!session.is_closed;
    session.course_name = session.course_name || '';
    session.class_name = session.class_name || '';
    session.lecturer_name = session.lecturer_name || '';
    session.note = session.note || '';

    // Always sync stored expiry to computed value (fixes corrupt/stale expiry_time in file)
    session.expiry_time = SessionController.computeExpiryTime(session).toISOString();

    // compute label if missing
    if (!session.label) {
      if (session.course_name && session.class_name) {
        session.label = `${session.course_name} - ${session.class_name}`;
      } else if (session.course_name) {
        session.label = session.course_name;
      } else if (session.class_name) {
        session.label = session.class_name;
      } else if (session.lecturer_name) {
        session.label = session.lecturer_name;
      } else if (session.note) {
        session.label = session.note;
      } else {
        session.label = `Session ${session.session_id}`;
      }
    }

    // derive status and remaining time
    session.status = session.is_closed ? 'closed' : 'active';
    const expiryTime = SessionController.computeExpiryTime(session);
    const now = new Date();
    const remainingMs = session.is_closed ? 0 : Math.max(0, expiryTime.getTime() - now.getTime());
    session.remaining_seconds = Math.round(remainingMs / 1000);

    return session;
  }

  static closeSession(session) {
    if (session.is_closed) {
      return;
    }

    session.is_closed = true;
    session.closed_at = new Date().toISOString();

    // keep expiry_time consistent for audit/debugging
    if (!session.expiry_time) {
      session.expiry_time = SessionController.computeExpiryTime(session).toISOString();
    }

    session.status = 'closed';
    session.remaining_seconds = 0;
  }

  // Close expired sessions in the data store (called periodically or on-demand)
  static closeExpiredSessions(callback) {
    SessionController.readSessions((err, sessions) => {
      if (err) {
        return callback(err);
      }

      let changed = false;
      const now = new Date();
      sessions.forEach((session) => {
        SessionController.normalizeSession(session);
        if (!session.is_closed && SessionController.isExpired(session)) {
          const computed = SessionController.computeExpiryTime(session);
          console.log('[SESSION_EXPIRE] Auto-closing expired session', session.session_id, {
            created_at: session.created_at,
            expiry_time_stored: session.expiry_time,
            computed_expiry: computed.toISOString(),
            now: now.toISOString(),
            window_minutes: SessionController.getWindowMinutes(session)
          });
          SessionController.closeSession(session);
          changed = true;
        }
      });

      if (!changed) {
        return callback(null, sessions);
      }

      SessionController.writeSessions(sessions, (writeErr) => {
        if (writeErr) {
          return callback(writeErr);
        }
        callback(null, sessions);
      });
    });
  }

  // Start a periodic job to close expired sessions (works even without frontend requests)
  static startExpiryWatcher(intervalMs = 30 * 1000) {
    if (SessionController._expiryWatcher) {
      return;
    }

    console.log('[SESSION_WATCHER] Started; interval_ms:', intervalMs, 'server_now:', new Date().toISOString());
    SessionController._expiryWatcher = setInterval(() => {
      SessionController.closeExpiredSessions((err) => {
        if (err) {
          console.error('[SESSION_WATCHER] Error closing expired sessions:', err);
        }
      });
    }, intervalMs);
  }

  // Get session by ID
  static getSessionById(sessionId, callback) {
    SessionController.readSessions((err, sessions) => {
      if (err) {
        return callback(err);
      }

      const idNum = Number(sessionId);
      const session = sessions.find(s => s.session_id === idNum);
      if (!session) {
        return callback(null, null);
      }

      // normalize session fields and compute derived values
      SessionController.normalizeSession(session);

      // If session is expired but still marked active, close it now and persist
      if (!session.is_closed && SessionController.isExpired(session)) {
        const computed = SessionController.computeExpiryTime(session);
        console.log('[SESSION_EXPIRE] Session expired on read; closing now', session.session_id, {
          created_at: session.created_at,
          computed_expiry: computed.toISOString(),
          now: new Date().toISOString()
        });
        SessionController.closeSession(session);
        SessionController.writeSessions(sessions, (writeErr) => {
          if (writeErr) {
            return callback(writeErr);
          }
          return callback(null, session);
        });
        return;
      }

      callback(null, session);
    });
  }

  /** Shared: DB token or generate + QR data URL. */
  static async _resolveQrStrings(lookupId) {
    const tokenSvc = getTokenService();
    if (typeof tokenSvc.generateToken !== 'function') {
      throw new Error('generateToken missing');
    }

    const existingRow = await new Promise((resolve, reject) => {
      Token.findLatestValidForSession(lookupId, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    let tokenStr = '';
    let tokenExpiresAt = null;

    if (existingRow && existingRow.token) {
      tokenStr = String(existingRow.token).trim();
      tokenExpiresAt = existingRow.expires_at;
      console.log('[RESOLVE_QR] ✓ Using existing valid DB token; row id:', existingRow.id, 'token length:', tokenStr.length, 'expires_at:', tokenExpiresAt);
    } else {
      console.log('[RESOLVE_QR] No valid DB token found; generating new token for session:', lookupId);
      const tokenData = await new Promise((resolve, reject) => {
        console.log('[RESOLVE_QR] → Calling tokenService.generateToken for session id:', lookupId);
        tokenSvc.generateToken(lookupId, (err, data) => {
          if (err) {
            console.error('[RESOLVE_QR] ✗ generateToken callback error:', err.message);
            reject(err);
          } else {
            console.log('[RESOLVE_QR] ← generateToken returned:', data);
            resolve(data);
          }
        });
      });

      if (!tokenData || !tokenData.token || String(tokenData.token).trim() === '') {
        console.error('[RESOLVE_QR] ✗ tokenData invalid', tokenData);
        throw new Error('token service returned invalid token data');
      }

      tokenStr = String(tokenData.token).trim();
      tokenExpiresAt = tokenData.expires_at || null;
      console.log('[RESOLVE_QR] ✓ New token generated; token length:', tokenStr.length, 'expires_at:', tokenExpiresAt);
    }

    if (!tokenStr || String(tokenStr).trim() === '') {
      console.error('[RESOLVE_QR] ✗ CRITICAL: Final tokenStr is empty!');
      throw new Error('empty token string');
    }

    console.log('[RESOLVE_QR] → Generating QR code from token (length:', tokenStr.length + ')');
    const qrCodeUrl = await QRCode.toDataURL(tokenStr);
    console.log('[RESOLVE_QR] ✓ QR code generated successfully; data URL length:', qrCodeUrl.length);

    return { tokenStr, qrCodeUrl, tokenExpiresAt };
  }

  /** POST /api/session/:id/refresh — ALWAYS generate fresh token (unlike GET which reuses valid ones). */
  static async refreshSessionQR(req, res) {
    const { id } = req.params;
    const lookupId = Number(id);
    
    console.log('[SESSION_REFRESH] Refresh QR requested for session:', id);
    
    if (Number.isNaN(lookupId)) {
      console.warn('[SESSION_REFRESH] Invalid session ID:', id);
      return res.status(400).json({ status: 'error', message: 'Invalid session ID' });
    }

    try {
      const sessions = await new Promise((resolve, reject) => {
        SessionController.readSessions((err, sessions) => (err ? reject(err) : resolve(sessions)));
      });

      const session = sessions.find((s) => {
        const existingId = Number(s.session_id ?? s.id ?? s.sessionId);
        return !Number.isNaN(existingId) && existingId === lookupId;
      });

      if (!session) {
        console.warn('[SESSION_REFRESH] Session not found:', id);
        return res.status(404).json({ status: 'error', message: 'Session not found' });
      }

      SessionController.normalizeSession(session);

      const sessionLecturerId = Number(session.lecturer_id);
      const userId = getAuthUserId(req);
      if (req.user.role === 'lecturer' && sessionLecturerId !== userId) {
        console.log('[SESSION_REFRESH] Access denied for session:', id);
        return res.status(403).json({ status: 'error', message: 'Access denied' });
      }

      // CRITICAL: For refresh, ALWAYS generate a NEW token, don't reuse existing ones
      console.log('[SESSION_REFRESH] Force-generating fresh token (not reusing DB token)');
      const tokenSvc = getTokenService();
      
      if (typeof tokenSvc.generateToken !== 'function') {
        console.error('[SESSION_REFRESH] TokenService.generateToken not available');
        return res.status(500).json({ status: 'error', message: 'Token service unavailable' });
      }

      const tokenData = await new Promise((resolve, reject) => {
        console.log('[SESSION_REFRESH] → Calling tokenService.generateToken for session:', lookupId);
        tokenSvc.generateToken(lookupId, (err, data) => {
          if (err) {
            console.error('[SESSION_REFRESH] generateToken error:', err.message);
            reject(err);
          } else {
            console.log('[SESSION_REFRESH] ← generateToken returned:', data);
            resolve(data);
          }
        });
      });

      if (!tokenData || !tokenData.token || String(tokenData.token).trim() === '') {
        console.error('[SESSION_REFRESH] Generated token is empty:', tokenData);
        return res.status(500).json({ status: 'error', message: 'Failed to generate token' });
      }

      const tokenStr = String(tokenData.token).trim();

      // Generate QR code from fresh token
      console.log('[SESSION_REFRESH] Generating QR code from fresh token');
      const qrCodeUrl = await QRCode.toDataURL(tokenStr);

      if (!qrCodeUrl || String(qrCodeUrl).trim() === '') {
        console.error('[SESSION_REFRESH] QR code generation failed');
        return res.status(500).json({ status: 'error', message: 'Failed to generate QR code' });
      }

      const tokenExpiresAt = tokenData.expires_at || new Date(Date.now() + 30 * 1000).toISOString();
      const responsePayload = {
        qr_url: qrCodeUrl,
        token_uuid: tokenStr,
        token: tokenStr,
        token_expires_at: tokenExpiresAt,
        server_time: new Date().toISOString()
      };

      console.log('[SESSION_REFRESH] ✓ REFRESH RESPONSE for session:', id);
      console.log('[SESSION_REFRESH] New token:', tokenStr.substring(0, 20) + '...');
      console.log('[SESSION_REFRESH] New QR URL length:', qrCodeUrl.length);

      res.json(responsePayload);
    } catch (err) {
      console.error('[SESSION_REFRESH] Unexpected error:', err.message);
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  // Get session details with QR
  static async getSession(req, res) {
    const { id } = req.params;
    const lookupId = Number(id);

    console.log('[SESSION_GET] Request for session:', id, 'by user:', getAuthUserId(req));

    if (Number.isNaN(lookupId)) {
      console.warn('[SESSION_GET] Invalid session ID requested:', id);
      return res.status(400).json({ status: 'error', message: 'Invalid session ID' });
    }

    try {
      const sessions = await new Promise((resolve, reject) => {
        SessionController.readSessions((err, sessions) => {
          if (err) reject(err);
          else resolve(sessions);
        });
      });

      console.log('[SESSION_GET] Loaded sessions count:', sessions.length);
      const sessionIds = sessions.map(s => s.session_id ?? s.id ?? s.sessionId);
      console.log('[SESSION_GET] Available session IDs:', sessionIds);

      const session = sessions.find((s) => {
        const existingId = Number(s.session_id ?? s.id ?? s.sessionId);
        return !Number.isNaN(existingId) && existingId === lookupId;
      });

      console.log('[SESSION_GET] Lookup id:', lookupId, 'Found session:', !!session);

      if (!session) {
        console.log('[SESSION_GET] Session not found:', id);
        return res.status(404).json({ status: 'error', message: 'Session not found' });
      }

      SessionController.normalizeSession(session);
      console.log('[SESSION_GET] Session times (server)', {
        session_id: session.session_id,
        created_at: session.created_at,
        expiry_time: session.expiry_time,
        now: new Date().toISOString(),
        is_closed: session.is_closed,
        remaining_seconds: session.remaining_seconds
      });

      const sessionLecturerId = Number(session.lecturer_id);
      const userId = getAuthUserId(req);
      if (req.user.role === 'lecturer' && sessionLecturerId !== userId) {
        console.log('[SESSION_GET] Access denied for session:', id, 'session lecturer:', sessionLecturerId, 'user:', userId);
        return res.status(403).json({ status: 'error', message: 'Access denied' });
      }

      console.log('[SESSION_GET] Resolving QR token for session:', lookupId);

      let tokenStr;
      let qrCodeUrl;
      let tokenExpiresAt;
      try {
        ({ tokenStr, qrCodeUrl, tokenExpiresAt } = await SessionController._resolveQrStrings(lookupId));
      } catch (e) {
        console.error('[SESSION_GET] QR resolve failed:', e.message);
        return res.status(500).json({ status: 'error', message: 'Token service unavailable' });
      }

      const expires_at = SessionController.computeExpiryTime(session);

      // CRITICAL VALIDATION: tokenStr must not be empty
      if (!tokenStr || String(tokenStr).trim() === '') {
        console.error('[SESSION_GET] ✗ CRITICAL: tokenStr is empty or falsy after _resolveQrStrings', { tokenStr });
        return res.status(500).json({ status: 'error', message: 'Failed to generate session token' });
      }

      if (!qrCodeUrl || String(qrCodeUrl).trim() === '') {
        console.error('[SESSION_GET] ✗ CRITICAL: qrCodeUrl is empty or falsy', { qrCodeUrl });
        return res.status(500).json({ status: 'error', message: 'Failed to generate QR code' });
      }

      console.log('[SESSION_GET] Session data prepared for:', id);

      const responsePayload = {
        session_id: session.session_id,
        course_name: session.course_name,
        class_name: session.class_name,
        lecturer_name: session.lecturer_name,
        created_at: session.created_at,
        duration_minutes: session.attendance_window_minutes,
        expires_at: expires_at.toISOString(),
        server_time: new Date().toISOString(),
        token_expires_at: tokenExpiresAt || new Date(Date.now() + 30 * 1000).toISOString(),
        is_closed: session.is_closed,
        remaining_seconds: session.remaining_seconds,
        status: session.is_closed ? 'ended' : 'active',
        qr_url: qrCodeUrl,
        token_uuid: tokenStr,
        token: tokenStr
      };

      console.log('[SESSION_GET] ✓ RETURNING SESSION RESPONSE for session:', id);
      console.log('[SESSION_GET] Response keys:', Object.keys(responsePayload));
      console.log('[SESSION_GET] is_closed:', session.is_closed, 'remaining_seconds:', session.remaining_seconds);
      console.log('[SESSION_GET] token_uuid value:', String(tokenStr).substring(0, 20) + '...');
      console.log('[SESSION_GET] qr_url length:', qrCodeUrl ? qrCodeUrl.length : 0);

      res.json(responsePayload);
    } catch (err) {
      console.error('[SESSION_GET] Error:', err);
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  }

  // Create a new session
  static createSession(req, res) {
    console.log('[SESSION_CREATE] Creating new session');

    SessionController.ensureDataDir();

    SessionController.readSessions((err, sessions) => {
      if (err) {
        console.error('[SESSION_CREATE] Error reading sessions:', err);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to read sessions data'
        });
      }

      // Validate required fields (backend defense)
      const course_name = (req.body.course_name || '').toString().trim();
      const class_name = (req.body.class_name || '').toString().trim();
      const lecturer_name = (req.body.lecturer_name || '').toString().trim();
      const note = (req.body.note || '').toString().trim();
      const class_latitude = req.body.class_latitude ? parseFloat(req.body.class_latitude) : null;
      const class_longitude = req.body.class_longitude ? parseFloat(req.body.class_longitude) : null;
      const allowed_radius_meters = req.body.allowed_radius_meters ? parseFloat(req.body.allowed_radius_meters) : 100;

      const missing = [];
      if (!course_name) missing.push('Course Name');
      if (!class_name) missing.push('Class Name');
      if (!lecturer_name) missing.push('Lecturer Name');

      if (missing.length) {
        return res.status(400).json({
          status: 'error',
          message: `Missing required fields: ${missing.join(', ')}`
        });
      }

      // Find the highest session_id and increment
      const maxSessionId = sessions.length > 0
        ? Math.max(...sessions.map(s => s.session_id))
        : 0;

      const newSessionId = maxSessionId + 1;
      const now = new Date();
      const newSession = {
        session_id: newSessionId,
        created_at: now.toISOString(),
        attendance_window_minutes: 10,
        is_closed: false,
        course_name,
        class_name,
        lecturer_name,
        lecturer_id: getAuthUserId(req),
        note,
        class_latitude,
        class_longitude,
        allowed_radius_meters
      };

      // store expiry time explicitly (same rule as computeExpiryTime: created_at + window)
      newSession.expiry_time = SessionController.computeExpiryTime(newSession).toISOString();

      console.log('[SESSION_CREATE] Clock (server)', {
        server_now: now.toISOString(),
        created_at: newSession.created_at,
        expiry_time: newSession.expiry_time,
        attendance_window_minutes: newSession.attendance_window_minutes
      });

      // derive a display label immediately
      if (newSession.course_name && newSession.class_name) {
        newSession.label = `${newSession.course_name} - ${newSession.class_name}`;
      } else if (newSession.course_name) {
        newSession.label = newSession.course_name;
      } else if (newSession.class_name) {
        newSession.label = newSession.class_name;
      } else if (newSession.lecturer_name) {
        newSession.label = newSession.lecturer_name;
      } else if (newSession.note) {
        newSession.label = newSession.note;
      } else {
        newSession.label = `Session ${newSessionId}`;
      }

      // Add new session to array
      sessions.push(newSession);

      console.log('[SESSION_CREATE] New session object to persist:', newSession);
      console.log('[SESSION_CREATE] Total sessions before write:', sessions.length);

      // Save back to file
      SessionController.writeSessions(sessions, (writeErr) => {
        if (writeErr) {
          console.error('[SESSION_CREATE] Error writing sessions:', writeErr);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to save session data'
          });
        }

        // Immediately verify persistence before sending response
        SessionController.readSessions((readErr, persistedSessions) => {
          if (readErr) {
            console.error('[SESSION_CREATE] Error re-reading sessions after write:', readErr);
            return res.status(500).json({ status: 'error', message: 'Failed to verify session persistence' });
          }

          const persistedIds = persistedSessions.map(s => s.session_id || s.id || s.sessionId);
          console.log('[SESSION_CREATE] Sessions loaded after write:', persistedSessions.length, persistedIds);

          const persisted = persistedSessions.find(s => Number(s.session_id) === newSessionId || Number(s.id) === newSessionId || Number(s.sessionId) === newSessionId);
          if (!persisted) {
            console.error('[SESSION_CREATE] ERROR: just-created session not found in persisted data', newSessionId);
            return res.status(500).json({ status: 'error', message: 'Session failed to persist' });
          }

          console.log(`[SESSION_CREATE] Created session ${newSessionId} persisted successfully`);
          console.log(`  Created at: ${newSession.created_at}`);
          console.log(`  Attendance window: ${newSession.attendance_window_minutes} minutes`);
          console.log(`  Expires at: ${newSession.expiry_time}`);

          res.json({
            status: 'success',
            session_id: newSessionId,
            label: newSession.label,
            course_name: newSession.course_name,
            class_name: newSession.class_name,
            lecturer_name: newSession.lecturer_name,
            note: newSession.note,
            expiry_time: newSession.expiry_time,
            status: 'active'
          });
        });
      });
    });
  }

  // GET /api/session/list
  static listSessions(req, res) {
    console.log('[SESSION_LIST] Reading sessions from', SESSIONS_FILE);
    SessionController.ensureDataDir();

    // Always close expired sessions before returning data (server time is source of truth)
    SessionController.closeExpiredSessions((err, sessions) => {
      if (err) {
        console.error('[SESSION_LIST] Error reading sessions file:', err);
        return res.status(500).json({ status: 'error', message: 'Failed to read sessions data' });
      }

      const safeSessions = sessions.map(s => {
        const normalized = SessionController.normalizeSession(s);
        return {
          session_id: normalized.session_id,
          created_at: normalized.created_at,
          expiry_time: normalized.expiry_time,
          attendance_window_minutes: normalized.attendance_window_minutes,
          is_closed: normalized.is_closed,
          status: normalized.status,
          remaining_seconds: normalized.remaining_seconds,
          course_name: normalized.course_name,
          class_name: normalized.class_name,
          lecturer_name: normalized.lecturer_name,
          note: normalized.note,
          label: normalized.label
        };
      });

      console.log('[SESSION_LIST] Found', safeSessions.length, 'sessions');
      return res.json({ status: 'success', sessions: safeSessions });
    });
  }

  // POST /api/session/end
  static endSession(req, res) {
    const { session_id } = req.body;
    console.log('[SESSION_END] Request to end session', session_id);
    if (session_id === undefined || session_id === null) {
      return res.status(400).json({ status: 'error', message: 'Session ID is required' });
    }

    const idNum = Number(session_id);
    SessionController.readSessions((err, sessions) => {
      if (err) {
        console.error('[SESSION_END] Error reading sessions:', err);
        return res.status(500).json({ status: 'error', message: 'Internal server error' });
      }

      const session = sessions.find(s => s.session_id === idNum);
      if (!session) {
        return res.status(400).json({ status: 'error', message: 'Invalid session' });
      }

      SessionController.normalizeSession(session);

      if (session.is_closed) {
        return res.status(400).json({ status: 'error', message: 'Session already closed' });
      }

      SessionController.closeSession(session);
      SessionController.writeSessions(sessions, (writeErr) => {
        if (writeErr) {
          console.error('[SESSION_END] Error writing sessions:', writeErr);
          return res.status(500).json({ status: 'error', message: 'Failed to update session' });
        }
        console.log('[SESSION_END] Session', session_id, 'marked closed');
        return res.json({ status: 'success' });
      });
    });
  }
}

module.exports = SessionController;