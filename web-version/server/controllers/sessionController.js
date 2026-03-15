const fs = require('fs');
const path = require('path');

const SESSIONS_FILE = path.join(__dirname, '..', 'data', 'sessions.json');
const DATA_DIR = path.join(__dirname, '..', 'data');

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
    return Number(session.attendance_window_minutes) || 10;
  }

  static computeExpiryTime(session) {
    if (session.expiry_time) {
      return new Date(session.expiry_time);
    }

    const createdAt = session.created_at ? new Date(session.created_at) : new Date();
    const windowMs = SessionController.getWindowMinutes(session) * 60 * 1000;
    return new Date(createdAt.getTime() + windowMs);
  }

  static isExpired(session) {
    const expiryTime = SessionController.computeExpiryTime(session);
    return new Date() > expiryTime;
  }

  static normalizeSession(session) {
    // ensure defaults for backwards compatibility
    session.attendance_window_minutes = SessionController.getWindowMinutes(session);
    session.is_closed = !!session.is_closed;
    session.course_name = session.course_name || '';
    session.class_name = session.class_name || '';
    session.lecturer_name = session.lecturer_name || '';
    session.note = session.note || '';

    // ensure expiry_time is stored so expiry logic can rely on it
    if (!session.expiry_time) {
      session.expiry_time = SessionController.computeExpiryTime(session).toISOString();
    }

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
      sessions.forEach((session) => {
        SessionController.normalizeSession(session);
        if (!session.is_closed && SessionController.isExpired(session)) {
          console.log(`[SESSION_EXPIRE] Auto-closing expired session ${session.session_id}`);
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
        console.log(`[SESSION_EXPIRE] Session ${session.session_id} has expired; closing it now.`);
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
        note
      };

      // store expiry time explicitly so we can auto-close sessions
      newSession.expiry_time = SessionController.computeExpiryTime(newSession).toISOString();

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

      // Save back to file
      SessionController.writeSessions(sessions, (writeErr) => {
        if (writeErr) {
          console.error('[SESSION_CREATE] Error writing sessions:', writeErr);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to save session data'
          });
        }

        console.log(`[SESSION_CREATE] Created session ${newSessionId}`);
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