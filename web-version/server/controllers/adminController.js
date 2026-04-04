const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { logAudit } = require('../utils/auditLogger');
const { getAllSessions } = require('../utils/sessionStore');
const {
  getAllAttendance,
  getAttendanceStats,
  deleteAttendanceByRowId
} = require('../utils/csvAttendanceStore');

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      return resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      return resolve(row || null);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      return resolve(rows || []);
    });
  });
}

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function normalize(value) {
  return (value || '').toString().trim().toLowerCase();
}

function parseActiveFlag(value) {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === 1 || value === '1') return 1;
  if (value === 0 || value === '0') return 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === 'active') return 1;
    if (v === 'false' || v === 'inactive') return 0;
  }
  return null;
}

class AdminController {
  static async getDashboardStats(req, res) {
    try {
      const [lecturerTotals, coursesTotal] = await Promise.all([
        getAsync(
          `
            SELECT
              SUM(CASE WHEN role = 'lecturer' THEN 1 ELSE 0 END) AS total_lecturers,
              SUM(CASE WHEN role = 'lecturer' AND is_active = 1 THEN 1 ELSE 0 END) AS active_lecturers
            FROM users
          `
        ),
        getAsync('SELECT COUNT(*) AS total_courses FROM courses')
      ]);

      const sessions = await getAllSessions();
      const attendanceStats = await getAttendanceStats();

      return res.json({
        status: 'success',
        data: {
          total_lecturers: Number(lecturerTotals?.total_lecturers || 0),
          active_lecturers: Number(lecturerTotals?.active_lecturers || 0),
          total_courses: Number(coursesTotal?.total_courses || 0),
          total_sessions: sessions.length,
          attendance_today: attendanceStats.attendanceToday,
          total_attendance_records: attendanceStats.totalAttendanceRecords
        }
      });
    } catch (err) {
      console.error('[ADMIN_DASHBOARD_STATS] Error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to load dashboard stats' });
    }
  }

  static async getLecturers(req, res) {
    try {
      const lecturers = await allAsync(
        `
          SELECT id, name, email, role, is_active, created_at, updated_at
          FROM users
          WHERE role = 'lecturer'
          ORDER BY id DESC
        `
      );

      const assignments = await allAsync(
        `
          SELECT lc.lecturer_id, c.id AS course_id, c.course_name, c.course_code, c.department
          FROM lecturer_courses lc
          JOIN courses c ON c.id = lc.course_id
          ORDER BY c.course_name ASC
        `
      );

      const byLecturer = new Map();
      assignments.forEach((a) => {
        const list = byLecturer.get(a.lecturer_id) || [];
        list.push({
          id: a.course_id,
          course_name: a.course_name,
          course_code: a.course_code,
          department: a.department
        });
        byLecturer.set(a.lecturer_id, list);
      });

      const data = lecturers.map((l) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        role: l.role,
        is_active: Number(l.is_active),
        assigned_courses: byLecturer.get(l.id) || []
      }));

      return res.json({ status: 'success', data });
    } catch (err) {
      console.error('[ADMIN_LECTURERS_LIST] Error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to load lecturers' });
    }
  }

  static async createLecturer(req, res) {
    try {
      const name = (req.body.name || '').toString().trim();
      const email = (req.body.email || '').toString().trim().toLowerCase();
      const password = (req.body.password || '').toString();
      const rounds = Number(process.env.BCRYPT_ROUNDS) || 10;

      console.log('[ADMIN_CREATE_LECTURER] Lecturer creation request received: name=%s, email=%s', name, email);

      if (!name || !email || !password) {
        return res.status(400).json({ status: 'error', message: 'name, email, and password are required' });
      }

      const existing = await getAsync('SELECT id FROM users WHERE lower(email) = ? LIMIT 1', [email]);
      if (existing) {
        return res.status(400).json({ status: 'error', message: 'A user with this email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, rounds);
      const insertResult = await runAsync(
        `
          INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
          VALUES (?, ?, ?, 'lecturer', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [name, email, passwordHash]
      );

      const created = await getAsync(
        'SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
        [insertResult.lastID]
      );

      console.log('[ADMIN_CREATE_LECTURER] Lecturer saved successfully: id=%s, email=%s', created.id, created.email);

      await logAudit(req.user.userId, 'CREATE_LECTURER', 'user', String(created.id), {
        lecturer: {
          id: created.id,
          name: created.name,
          email: created.email,
          role: created.role,
          is_active: created.is_active
        }
      });

      return res.status(201).json({
        status: 'success',
        data: {
          id: created.id,
          name: created.name,
          email: created.email,
          role: created.role,
          is_active: Number(created.is_active)
        }
      });
    } catch (err) {
      console.error('[ADMIN_CREATE_LECTURER] Error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to create lecturer' });
    }
  }

  static async updateLecturer(req, res) {
    try {
      const lecturerId = toInt(req.params.id);
      const name = (req.body.name || '').toString().trim();
      const email = (req.body.email || '').toString().trim().toLowerCase();

      if (!lecturerId) {
        return res.status(400).json({ status: 'error', message: 'Invalid lecturer id' });
      }
      if (!name || !email) {
        return res.status(400).json({ status: 'error', message: 'name and email are required' });
      }

      const lecturer = await getAsync('SELECT id, role FROM users WHERE id = ?', [lecturerId]);
      if (!lecturer) {
        return res.status(404).json({ status: 'error', message: 'Lecturer not found' });
      }
      if (lecturer.role !== 'lecturer') {
        return res.status(400).json({ status: 'error', message: 'Only lecturer accounts can be updated via this route' });
      }

      const duplicate = await getAsync(
        'SELECT id FROM users WHERE lower(email) = ? AND id != ? LIMIT 1',
        [email, lecturerId]
      );
      if (duplicate) {
        return res.status(400).json({ status: 'error', message: 'Another account already uses this email' });
      }

      await runAsync(
        `
          UPDATE users
          SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND role = 'lecturer'
        `,
        [name, email, lecturerId]
      );

      const updated = await getAsync(
        'SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
        [lecturerId]
      );

      await logAudit(req.user.userId, 'UPDATE_LECTURER', 'user', String(lecturerId), {
        lecturer: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          is_active: updated.is_active
        }
      });

      return res.json({
        status: 'success',
        data: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          is_active: Number(updated.is_active)
        }
      });
    } catch (err) {
      console.error('[ADMIN_UPDATE_LECTURER] Error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to update lecturer' });
    }
  }

  static async updateLecturerStatus(req, res) {
    try {
      const lecturerId = toInt(req.params.id);
      const isActive = parseActiveFlag(req.body.is_active);

      if (!lecturerId) {
        return res.status(400).json({ status: 'error', message: 'Invalid lecturer id' });
      }
      if (isActive === null) {
        return res.status(400).json({ status: 'error', message: 'is_active must be a boolean/0/1 value' });
      }

      const lecturer = await getAsync('SELECT id, role FROM users WHERE id = ?', [lecturerId]);
      if (!lecturer) {
        return res.status(404).json({ status: 'error', message: 'Lecturer not found' });
      }
      if (lecturer.role !== 'lecturer') {
        return res.status(400).json({ status: 'error', message: 'Only lecturer accounts can be updated via this route' });
      }

      await runAsync(
        `
          UPDATE users
          SET is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND role = 'lecturer'
        `,
        [isActive, lecturerId]
      );

      const updated = await getAsync(
        'SELECT id, name, email, role, is_active FROM users WHERE id = ?',
        [lecturerId]
      );

      await logAudit(req.user.userId, 'UPDATE_LECTURER_STATUS', 'user', String(lecturerId), {
        lecturer: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          is_active: updated.is_active
        }
      });

      return res.json({
        status: 'success',
        data: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          is_active: Number(updated.is_active)
        }
      });
    } catch (err) {
      console.error('[ADMIN_UPDATE_LECTURER_STATUS] Error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to update lecturer status' });
    }
  }

  static async getCourses(req, res) {
    try {
      const courses = await allAsync(
        `
          SELECT id, course_name, course_code, department, created_at, updated_at
          FROM courses
          ORDER BY id DESC
        `
      );
      return res.json({ status: 'success', data: courses });
    } catch (err) {
      console.error('[ADMIN_COURSES_LIST] Error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to load courses' });
    }
  }

  static async createCourse(req, res) {
    try {
      const courseName = (req.body.course_name || '').toString().trim();
      const courseCode = (req.body.course_code || '').toString().trim().toUpperCase();
      const department = (req.body.department || '').toString().trim();

      if (!courseName || !courseCode) {
        return res.status(400).json({ status: 'error', message: 'course_name and course_code are required' });
      }

      const result = await runAsync(
        `
          INSERT INTO courses (course_name, course_code, department, created_at, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [courseName, courseCode, department || null]
      );

      const created = await getAsync(
        'SELECT id, course_name, course_code, department, created_at, updated_at FROM courses WHERE id = ?',
        [result.lastID]
      );

      await logAudit(req.user.userId, 'CREATE_COURSE', 'course', String(created.id), {
        course: created
      });

      return res.status(201).json({ status: 'success', data: created });
    } catch (err) {
      if (String(err.message || '').includes('UNIQUE')) {
        return res.status(400).json({ status: 'error', message: 'course_code already exists' });
      }
      console.error('[ADMIN_CREATE_COURSE] Error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to create course' });
    }
  }

  static async updateCourse(req, res) {
    try {
      const courseId = toInt(req.params.id);
      const courseName = (req.body.course_name || '').toString().trim();
      const courseCode = (req.body.course_code || '').toString().trim().toUpperCase();
      const department = (req.body.department || '').toString().trim();

      if (!courseId) {
        return res.status(400).json({ status: 'error', message: 'Invalid course id' });
      }
      if (!courseName || !courseCode) {
        return res.status(400).json({ status: 'error', message: 'course_name and course_code are required' });
      }

      const course = await getAsync('SELECT id FROM courses WHERE id = ?', [courseId]);
      if (!course) {
        return res.status(404).json({ status: 'error', message: 'Course not found' });
      }

      await runAsync(
        `
          UPDATE courses
          SET course_name = ?, course_code = ?, department = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [courseName, courseCode, department || null, courseId]
      );

      const updated = await getAsync(
        'SELECT id, course_name, course_code, department, created_at, updated_at FROM courses WHERE id = ?',
        [courseId]
      );

      await logAudit(req.user.userId, 'UPDATE_COURSE', 'course', String(courseId), {
        course: updated
      });

      return res.json({ status: 'success', data: updated });
    } catch (err) {
      if (String(err.message || '').includes('UNIQUE')) {
        return res.status(400).json({ status: 'error', message: 'course_code already exists' });
      }
      console.error('[ADMIN_UPDATE_COURSE] Error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to update course' });
    }
  }

  static async assignCourse(req, res) {
    try {
      const lecturerId = toInt(req.params.id);
      const courseId = toInt(req.body.course_id);

      if (!lecturerId || !courseId) {
        return res.status(400).json({ status: 'error', message: 'Valid lecturer id and course_id are required' });
      }

      const lecturer = await getAsync(
        'SELECT id, name, email, role FROM users WHERE id = ?',
        [lecturerId]
      );
      if (!lecturer || lecturer.role !== 'lecturer') {
        return res.status(404).json({ status: 'error', message: 'Lecturer not found' });
      }

      const course = await getAsync(
        'SELECT id, course_name, course_code FROM courses WHERE id = ?',
        [courseId]
      );
      if (!course) {
        return res.status(404).json({ status: 'error', message: 'Course not found' });
      }

      await runAsync(
        `
          INSERT INTO lecturer_courses (lecturer_id, course_id, created_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `,
        [lecturerId, courseId]
      );

      await logAudit(req.user.userId, 'ASSIGN_COURSE', 'lecturer_course', `${lecturerId}:${courseId}`, {
        lecturer: { id: lecturer.id, name: lecturer.name, email: lecturer.email },
        course: { id: course.id, course_name: course.course_name, course_code: course.course_code }
      });

      return res.status(201).json({
        status: 'success',
        data: {
          lecturer_id: lecturerId,
          course_id: courseId
        }
      });
    } catch (err) {
      if (String(err.message || '').includes('UNIQUE')) {
        return res.status(400).json({ status: 'error', message: 'Course is already assigned to this lecturer' });
      }
      console.error('[ADMIN_ASSIGN_COURSE] Error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to assign course' });
    }
  }

  static async getSessions(req, res) {
    try {
      const sessions = await getAllSessions();
      return res.json({ status: 'success', data: sessions });
    } catch (err) {
      console.error('[ADMIN_SESSIONS] Error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to load sessions' });
    }
  }

  static async getAttendance(req, res) {
    try {
      const {
        lecturer_id: lecturerIdParam,
        session_id: sessionIdParam,
        date,
        roll_number: rollNumber,
        student_name: studentName
      } = req.query;
      const lecturerId = lecturerIdParam ? toInt(lecturerIdParam) : null;
      const sessionId = sessionIdParam ? String(sessionIdParam).trim() : '';
      const dateFilter = (date || '').toString().trim();
      const rollFilter = (rollNumber || '').toString().trim().toLowerCase();
      const studentFilter = (studentName || '').toString().trim().toLowerCase();
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));

      let records = await getAllAttendance();

      if (lecturerIdParam && !lecturerId) {
        return res.status(400).json({ status: 'error', message: 'Invalid lecturer_id filter' });
      }

      if (lecturerId) {
        const lecturer = await getAsync(
          'SELECT id, name FROM users WHERE id = ? AND role = ?',
          [lecturerId, 'lecturer']
        );
        if (!lecturer) {
          return res.status(404).json({ status: 'error', message: 'Lecturer not found' });
        }

        const sessions = await getAllSessions();
        const lecturerSessionIds = new Set(
          sessions
            .filter((s) => normalize(s.lecturer_name) === normalize(lecturer.name))
            .map((s) => String(s.session_id || s.id || ''))
        );

        records = records.filter((r) => lecturerSessionIds.has(String(r.session_id || '')));
      }

      if (sessionId) {
        records = records.filter((r) => String(r.session_id || '') === sessionId);
      }
      if (dateFilter) {
        records = records.filter((r) => {
          if (!r.scan_time) return false;
          const d = new Date(r.scan_time);
          if (Number.isNaN(d.getTime())) return false;
          return d.toISOString().slice(0, 10) === dateFilter;
        });
      }
      if (rollFilter) {
        records = records.filter((r) => String(r.roll_number || '').toLowerCase().includes(rollFilter));
      }
      if (studentFilter) {
        records = records.filter((r) => String(r.student_name || '').toLowerCase().includes(studentFilter));
      }

      const total = records.length;
      const start = (page - 1) * limit;
      const paginatedRecords = records.slice(start, start + limit);

      return res.json({
        status: 'success',
        data: paginatedRecords,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error('[ADMIN_ATTENDANCE] Error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to load attendance records' });
    }
  }

  static async deleteAttendance(req, res) {
    try {
      const rowId = (req.params.id || '').toString().trim();
      if (!rowId) {
        return res.status(400).json({ status: 'error', message: 'Attendance id is required' });
      }

      if (!/^[a-f0-9\-]+$/.test(rowId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid id format'
        });
      }

      const result = await deleteAttendanceByRowId(rowId);
      if (!result.deleted) {
        return res.status(404).json({ status: 'error', message: result.reason || 'Attendance record not found' });
      }

      await logAudit(req.user.userId, 'DELETE_ATTENDANCE', 'attendance', rowId, {
        deleted_record: result.deletedRecord
      });

      return res.json({
        status: 'success',
        data: {
          deleted_id: rowId,
          deleted_record: result.deletedRecord
        }
      });
    } catch (err) {
      console.error('[ADMIN_DELETE_ATTENDANCE] Error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to delete attendance record' });
    }
  }

  static async getAuditLogs(req, res) {
    try {
      const logs = await allAsync(
        `
          SELECT
            al.id,
            al.actor_user_id,
            u.name AS actor_name,
            u.email AS actor_email,
            al.action,
            al.target_type,
            al.target_id,
            al.details,
            al.created_at
          FROM audit_logs al
          LEFT JOIN users u ON u.id = al.actor_user_id
          ORDER BY al.id DESC
        `
      );

      const data = logs.map((row) => {
        let parsedDetails = null;
        if (row.details) {
          try {
            parsedDetails = JSON.parse(row.details);
          } catch (err) {
            parsedDetails = row.details;
          }
        }
        return {
          id: row.id,
          actor_user_id: row.actor_user_id,
          actor_name: row.actor_name,
          actor_email: row.actor_email,
          action: row.action,
          target_type: row.target_type,
          target_id: row.target_id,
          details: parsedDetails,
          created_at: row.created_at
        };
      });

      return res.json({ status: 'success', data });
    } catch (err) {
      console.error('[ADMIN_AUDIT_LOGS] Error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to load audit logs' });
    }
  }
}

module.exports = AdminController;
