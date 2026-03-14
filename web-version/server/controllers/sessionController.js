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

  // Get session by ID
  static getSessionById(sessionId, callback) {
    SessionController.readSessions((err, sessions) => {
      if (err) {
        return callback(err);
      }

      const idNum = Number(sessionId);
      const session = sessions.find(s => s.session_id === idNum);
      if (session) {
        // ensure defaults for backwards compatibility
        session.attendance_window_minutes = session.attendance_window_minutes || 10;
        session.is_closed = !!session.is_closed;
        session.course_name = session.course_name || '';
        session.class_name = session.class_name || '';
        session.lecturer_name = session.lecturer_name || '';
        session.note = session.note || '';
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

      // Find the highest session_id and increment
      const maxSessionId = sessions.length > 0
        ? Math.max(...sessions.map(s => s.session_id))
        : 0;

      const newSessionId = maxSessionId + 1;
      const now = new Date();
      // grab optional metadata from the request body
      const { course_name, class_name, lecturer_name, note } = req.body;
      const newSession = {
        session_id: newSessionId,
        created_at: now.toISOString(),
        attendance_window_minutes: 10,
        is_closed: false,
        course_name: course_name || '',
        class_name: class_name || '',
        lecturer_name: lecturer_name || '',
        note: note || ''
      };
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
        const windowCloseTime = new Date(now.getTime() + newSession.attendance_window_minutes * 60 * 1000).toISOString();
        console.log(`  Window closes at: ${windowCloseTime}`);
        res.json({
          status: 'success',
          session_id: newSessionId,
          label: newSession.label,
          course_name: newSession.course_name,
          class_name: newSession.class_name,
          lecturer_name: newSession.lecturer_name,
          note: newSession.note
        });
      });
    });
  }

  // GET /api/session/list
  static listSessions(req, res) {
    console.log('[SESSION_LIST] Reading sessions from', SESSIONS_FILE);
    SessionController.ensureDataDir();
    fs.readFile(SESSIONS_FILE, 'utf8', (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          console.log('[SESSION_LIST] sessions.json not found, returning empty list');
          return res.json({ status: 'success', sessions: [] });
        }
        console.error('[SESSION_LIST] Error reading sessions file:', err);
        return res.status(500).json({ status: 'error', message: 'Failed to read sessions data' });
      }
      try {
        let sessions = JSON.parse(data);
        if (!Array.isArray(sessions)) {
          sessions = [];
        }
        // normalize each session, include metadata and label
        const safeSessions = sessions.map(s => {
          const attendance_window_minutes = s.attendance_window_minutes || 10;
          const is_closed = !!s.is_closed;
          const course_name = s.course_name || '';
          const class_name = s.class_name || '';
          const lecturer_name = s.lecturer_name || '';
          const note = s.note || '';
          let label = s.label || '';
          if (!label) {
            if (course_name && class_name) {
              label = `${course_name} - ${class_name}`;
            } else if (course_name) {
              label = course_name;
            } else if (class_name) {
              label = class_name;
            } else if (lecturer_name) {
              label = lecturer_name;
            } else if (note) {
              label = note;
            } else {
              label = `Session ${s.session_id}`;
            }
          }
          return {
            session_id: s.session_id,
            created_at: s.created_at,
            attendance_window_minutes,
            is_closed,
            course_name,
            class_name,
            lecturer_name,
            note,
            label
          };
        });
        console.log('[SESSION_LIST] Found', safeSessions.length, 'sessions');
        return res.json({ status: 'success', sessions: safeSessions });
      } catch (parseErr) {
        console.error('[SESSION_LIST] Error parsing sessions.json:', parseErr);
        return res.status(500).json({ status: 'error', message: 'Failed to parse sessions data' });
      }
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

      if (session.is_closed) {
        return res.status(400).json({ status: 'error', message: 'Session already closed' });
      }

      session.is_closed = true;
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