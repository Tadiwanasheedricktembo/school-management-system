const fs = require('fs');
const path = require('path');
const TokenService = require('../services/tokenService');
const SessionController = require('./sessionController');

const ATTENDANCE_FILE = path.join(__dirname, '..', 'data', 'attendance_records.csv');
const DATA_DIR = path.join(__dirname, '..', 'data');

class AttendanceController {
  static csvSafe(value) {
    if (value === null || value === undefined) return '';
    // This backend uses a simple comma-split CSV parser. Keep it stable by stripping commas/newlines.
    return String(value).replace(/[\r\n]+/g, ' ').replace(/,/g, ' ').trim();
  }

  static getHeaderIndexes(headerLine) {
    const headers = (headerLine || '').trim().split(',');
    const idx = {};
    headers.forEach((h, i) => {
      idx[h] = i;
    });
    return { headers, idx };
  }

  // Ensure data directory and CSV file exist
  static ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) {
      console.log(`[CSV_SETUP] Creating directory: ${DATA_DIR}`);
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(ATTENDANCE_FILE)) {
      console.log(`[CSV_SETUP] Creating CSV file: ${ATTENDANCE_FILE}`);
      // include all possible columns up front
      fs.writeFileSync(
        ATTENDANCE_FILE,
        'roll_number,student_name,session_id,token,scan_time,status,device_id,latitude,longitude,selfie\n',
        'utf8'
      );
    } else {
      // ensure header contains all optional columns
      const content = fs.readFileSync(ATTENDANCE_FILE, 'utf8');
      const lines = content.split('\n');
      const header = lines[0];
      const required = ['student_name', 'device_id', 'latitude', 'longitude', 'selfie'];
      const headers = header.split(',');
      const missing = required.filter((col) => !headers.includes(col));
      if (missing.length > 0) {
        console.log(`[CSV_UPDATE] Adding missing columns: ${missing.join(', ')}`);
        const newHeader = headers.concat(missing).join(',');
        lines[0] = newHeader;
        // add empty placeholders for the new columns on each existing record
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            // append a comma for each missing column
            lines[i] += ','.repeat(missing.length);
          }
        }
        fs.writeFileSync(ATTENDANCE_FILE, lines.join('\n'), 'utf8');
      }
    }
  }

  // Check if roll_number and session_id already exist in CSV
  static checkDuplicate(roll_number, session_id, callback) {
    fs.readFile(ATTENDANCE_FILE, 'utf8', (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // File doesn't exist yet, no duplicates
          return callback(null, false);
        }
        return callback(err);
      }

      const allLines = data.split('\n');
      const { idx } = AttendanceController.getHeaderIndexes(allLines[0]);
      const rollIdx = idx.roll_number ?? 0;
      const sessionIdx = idx.session_id ?? 1;
      const lines = allLines.slice(1); // Skip header
      const isDuplicate = lines.some(line => {
        if (!line.trim()) return false;
        const parts = line.split(',');
        const roll = parts[rollIdx] ?? '';
        const session = parts[sessionIdx] ?? '';
        return roll === roll_number && session === session_id.toString();
      });

      callback(null, isDuplicate);
    });
  }

  // Check if device_id has already been used for this session
  static checkDeviceDuplicate(device_id, session_id, callback) {
    // if no device_id provided, skip duplicate check
    if (!device_id) {
      return callback(null, false);
    }
    fs.readFile(ATTENDANCE_FILE, 'utf8', (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // File doesn't exist yet, no duplicates
          return callback(null, false);
        }
        return callback(err);
      }

      const allLines = data.split('\n');
      const { idx } = AttendanceController.getHeaderIndexes(allLines[0]);
      const sessionIdx = idx.session_id ?? 1;
      const deviceIdx = idx.device_id ?? 5;
      const lines = allLines.slice(1); // Skip header
      const isDuplicate = lines.some(line => {
        if (!line.trim()) return false;
        const parts = line.split(',');
        const session = parts[sessionIdx] ?? '';
        const device = parts[deviceIdx] ?? '';
        return device === device_id && session === session_id.toString();
      });

      callback(null, isDuplicate);
    });
  }

  // Append attendance record to CSV
  static appendToCSV(roll_number, student_name, session_id, token, device_id, latitude, longitude, selfie, callback) {
    const scanTime = new Date().toISOString();
    const status = 'present';
    // ensure values are strings and fallback to empty
    const roll = AttendanceController.csvSafe(roll_number);
    const name = AttendanceController.csvSafe(student_name);
    const sess = AttendanceController.csvSafe(session_id);
    const tok = AttendanceController.csvSafe(token);
    const dev = AttendanceController.csvSafe(device_id);
    const lat = AttendanceController.csvSafe(latitude);
    const lon = AttendanceController.csvSafe(longitude);
    const sf = AttendanceController.csvSafe(selfie);

    const csvLine = `${roll},${name},${sess},${tok},${scanTime},${status},${dev},${lat},${lon},${sf}\n`;

    fs.appendFile(ATTENDANCE_FILE, csvLine, 'utf8', (err) => {
      if (err) {
        return callback(err);
      }
      callback(null, {
        roll_number: roll,
        student_name: name,
        session_id: sess,
        token: tok,
        scanTime,
        status,
        device_id: dev,
        latitude: lat,
        longitude: lon,
        selfie: sf
      });
    });
  }

  // Mark attendance endpoint
  static markAttendance(req, res) {
    console.log('[ATTENDANCE_BODY_RAW]', JSON.stringify(req.body, null, 2));

    const rawBody = req.body || {};
    const roll_number =
      rawBody.roll_number ||
      rawBody.student_id ||
      rawBody.studentId ||
      rawBody.rollNumber ||
      null;
    const student_name =
      rawBody.student_name ||
      rawBody.studentName ||
      null;
    const token =
      rawBody.token ||
      rawBody.qr_token ||
      rawBody.qrToken ||
      null;
    const device_id =
      rawBody.device_id ||
      rawBody.deviceId ||
      null;
    const latitude =
      rawBody.latitude ||
      rawBody.lat ||
      null;
    const longitude =
      rawBody.longitude ||
      rawBody.lng ||
      rawBody.lon ||
      null;
    const selfie = rawBody.selfie;
    const selfie_path = rawBody.selfie_path;
    const selfie_metadata = rawBody.selfie_metadata;

    // Normalize selfie fields: prioritize 'selfie', then 'selfie_metadata', then 'selfie_path'
    const selfieValue = selfie || selfie_metadata || selfie_path || '';

    console.log(
      `[ATTENDANCE_REQUEST] Roll Number: ${roll_number}, Token: ${token}, Device ID: ${device_id}, ` +
        `Latitude: ${latitude}, Longitude: ${longitude}, Selfie: ${selfieValue ? '[provided]' : '[none]'} `
    );

    // required identity fields: roll_number is required; student_name is optional for backward compatibility
    if (!roll_number || !token) {
      console.warn(
        '[ATTENDANCE_VALIDATION] Missing required fields. ' +
          `Derived roll_number=${roll_number}, token=${token}. ` +
          `Incoming keys=${Object.keys(rawBody).join(', ')}`
      );
      return res.status(400).json({
        status: 'error',
        message: 'Roll number and token are required'
      });
    }

    if (student_name !== null && student_name !== undefined) {
      if (typeof student_name !== 'string' || !student_name.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'studentName must be a non-empty string when provided'
        });
      }
    }

    if (latitude && longitude) {
      console.log(`[ATTENDANCE_OPTIONAL] Location received: ${latitude}, ${longitude}`);
    }

    if (selfieValue) {
      console.log(`[ATTENDANCE_OPTIONAL] Selfie data received`);
    }

    // Ensure data file exists
    AttendanceController.ensureDataFile();

    // Step 1: Validate the token
    TokenService.validateToken(token, (err, validationResult) => {
      if (err) {
        console.error('Error validating token:', err);
        return res.status(500).json({
          status: 'error',
          message: 'Internal server error'
        });
      }

      if (!validationResult.valid) {
        const reason = validationResult.reason;
        console.log(`[ATTENDANCE_FAILED] Token validation failed: ${reason}`);
        return res.status(400).json({
          status: 'error',
          message: reason
        });
      }

      const session_id = validationResult.session_id;
      console.log(`[ATTENDANCE_TOKEN_VALID] Session ID linked to token: ${session_id}`);

      // Step 1.5: Check session attendance window
      SessionController.getSessionById(session_id, (err, session) => {
        if (err) {
          console.error('Error getting session:', err);
          return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
          });
        }

        if (!session) {
          console.log(`[ATTENDANCE_FAILED] Session ${session_id} not found`);
          return res.status(400).json({
            status: 'error',
            message: 'Invalid session'
          });
        }

        const now = new Date();
        const sessionCreated = new Date(session.created_at);
        const windowCloseTime = new Date(sessionCreated.getTime() + session.attendance_window_minutes * 60 * 1000);

        console.log(`[ATTENDANCE_WINDOW_CHECK] Current time: ${now.toISOString()}`);
        console.log(`  Session created: ${session.created_at}`);
        console.log(`  Window closes: ${windowCloseTime.toISOString()}`);
        console.log(`  Window duration: ${session.attendance_window_minutes} minutes`);

        // check if session is closed (manual or because it expired)
        const sessionExpired = SessionController.isExpired(session);
        if (session.is_closed) {
          const reason = sessionExpired ? 'Session has expired and is now closed' : 'Session closed';
          console.log(`[ATTENDANCE_REJECTED] ${reason} for session ${session_id}`);
          return res.status(400).json({
            status: 'error',
            message: reason
          });
        }

        if (now > windowCloseTime) {
          // If the window has passed but the session was not yet marked closed, ensure we persist the closure.
          SessionController.closeExpiredSessions((err) => {
            if (err) {
              console.error('[ATTENDANCE_ERROR] Failed to close expired session:', err);
            }

            console.log(`[ATTENDANCE_REJECTED] Attendance window closed for session ${session_id}`);
            return res.status(400).json({
              status: 'error',
              message: 'Session has expired and is now closed'
            });
          });
          return;
        }

        console.log(`[ATTENDANCE_WINDOW_VALID] Window still open for session ${session_id}`);

        // Step 2: Check for duplicate device_id in this session
        AttendanceController.checkDeviceDuplicate(device_id, session_id, (err, isDeviceDuplicate) => {
          if (err) {
            console.error('Error checking device duplicate:', err);
            return res.status(500).json({
              status: 'error',
              message: 'Internal server error'
            });
          }

          console.log(`[ATTENDANCE_DEVICE_CHECK] Device ${device_id}, Session ${session_id}, Device Used: ${isDeviceDuplicate}`);

          if (isDeviceDuplicate) {
            console.log(`[ATTENDANCE_FAILED] Device ${device_id} already used for session ${session_id}`);
            return res.status(400).json({
              status: 'error',
              message: 'This device has already marked attendance for this session'
            });
          }

          // Step 3: Check for duplicate roll_number in this session
          AttendanceController.checkDuplicate(roll_number, session_id, (err, isRollDuplicate) => {
            if (err) {
              console.error('Error checking roll duplicate:', err);
              return res.status(500).json({
                status: 'error',
                message: 'Internal server error'
              });
            }

            console.log(`[ATTENDANCE_ROLL_CHECK] Roll ${roll_number}, Session ${session_id}, Roll Used: ${isRollDuplicate}`);

            if (isRollDuplicate) {
              console.log(`[ATTENDANCE_FAILED] Attendance already recorded for roll ${roll_number} in session ${session_id}`);
              return res.status(400).json({
                status: 'error',
                message: 'Attendance already recorded'
              });
            }

            // Step 4: Append to CSV file (include optional extras)
            AttendanceController.appendToCSV(
              roll_number,
              student_name,
              session_id,
              token,
              device_id,
              latitude,
              longitude,
              selfieValue,
              (err, record) => {
                if (err) {
                  console.error('Error appending to CSV:', err);
                  console.log(`[CSV_ERROR] File path: ${ATTENDANCE_FILE}`);
                  return res.status(500).json({
                    status: 'error',
                    message: 'Failed to record attendance'
                  });
                }

                console.log(
                  `[ATTENDANCE_SUCCESS] Recorded to CSV: Roll ${roll_number}, Session ${session_id}, ` +
                    `Device ${record.device_id || 'N/A'}, Latitude ${record.latitude || 'N/A'}, ` +
                    `Longitude ${record.longitude || 'N/A'}, Selfie ${record.selfie ? 'yes' : 'no'}`
                );
                console.log(`  File: ${ATTENDANCE_FILE}`);
                console.log(`  Scan time: ${record.scanTime}`);

                res.json({
                  status: 'success',
                  message: 'Attendance recorded'
                });
              }
            );
          });
        });
      });
    });
  }

  // Get attendance records for a session from CSV
  static getSessionAttendance(req, res) {
    const { session_id } = req.params;

    if (!session_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Session ID is required'
      });
    }

    AttendanceController.ensureDataFile();

    fs.readFile(ATTENDANCE_FILE, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading attendance file:', err);
        return res.status(500).json({
          status: 'error',
          message: 'Internal server error'
        });
      }

      const allLines = data.split('\n');
      const { idx } = AttendanceController.getHeaderIndexes(allLines[0]);
      const lines = allLines.slice(1); // Skip header
      const records = lines
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split(',');
          const roll_number = parts[idx.roll_number ?? 0] || '';
          const student_name = parts[idx.student_name ?? 1] || '';
          const sess_id = parts[idx.session_id ?? 2] || '';
          const token = parts[idx.token ?? 3] || '';
          const scan_time = parts[idx.scan_time ?? 4] || '';
          const status = parts[idx.status ?? 5] || '';
          const device_id = parts[idx.device_id ?? 6] || '';
          const latitude = parts[idx.latitude ?? 7] || '';
          const longitude = parts[idx.longitude ?? 8] || '';
          const selfie = parts[idx.selfie ?? 9] || '';
          return { roll_number, student_name, session_id: sess_id, token, scan_time, status, device_id, latitude, longitude, selfie };
        })
        .filter(record => record.session_id === session_id);

      res.json({
        status: 'success',
        data: records
      });
    });
  }

  // Get all attendance records from CSV
  static getAllAttendance(req, res) {
    console.log(`[RECORDS_REQUEST] Fetching all attendance records`);
    console.log(`  File path: ${ATTENDANCE_FILE}`);

    AttendanceController.ensureDataFile();

    fs.readFile(ATTENDANCE_FILE, 'utf8', (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // File doesn't exist, return empty records
          console.log(`[RECORDS_FILE_MISSING] File not found: ${ATTENDANCE_FILE}`);
          return res.json({
            status: 'success',
            records: []
          });
        }

        console.error(`[RECORDS_FILE_ERROR] Error reading file: ${err.message}`);
        return res.status(500).json({
          status: 'error',
          message: 'Internal server error'
        });
      }

      const allLines = data.split('\n');
      const { idx } = AttendanceController.getHeaderIndexes(allLines[0]);
      const lines = allLines.slice(1); // Skip header
      const records = lines
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split(',');
          const roll_number = parts[idx.roll_number ?? 0] || '';
          const student_name = parts[idx.student_name ?? 1] || '';
          const session_id = parseInt(parts[idx.session_id ?? 2]);
          const token = parts[idx.token ?? 3] || '';
          const scan_time = parts[idx.scan_time ?? 4] || '';
          const status = parts[idx.status ?? 5] || '';
          const device_id = parts[idx.device_id ?? 6] || '';
          const latitude = parts[idx.latitude ?? 7] || '';
          const longitude = parts[idx.longitude ?? 8] || '';
          const selfie = parts[idx.selfie ?? 9] || '';
          return { roll_number, student_name, session_id, token, scan_time, status, device_id, latitude, longitude, selfie };
        });

      console.log(`[RECORDS_SUCCESS] Total records returned: ${records.length}`);

      res.json({
        status: 'success',
        records: records
      });
    });
  }

  // Download attendance records CSV
  static downloadAttendance(req, res) {
    console.log(`[DOWNLOAD_REQUEST] Attendance CSV download requested`);
    console.log(`  File path: ${ATTENDANCE_FILE}`);

    // Check if file exists
    fs.access(ATTENDANCE_FILE, fs.constants.F_OK, (err) => {
      if (err) {
        console.log(`[DOWNLOAD_FILE_MISSING] File not found: ${ATTENDANCE_FILE}`);
        return res.status(404).json({
          status: 'error',
          message: 'No attendance file found'
        });
      }

      // Read and modify the CSV to make it readable
      fs.readFile(ATTENDANCE_FILE, 'utf8', (err, data) => {
        if (err) {
          console.error(`[DOWNLOAD_ERROR] Error reading file: ${err.message}`);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to read attendance file'
          });
        }

        const lines = data.split('\n');
        if (lines.length > 0) {
          const headerCols = lines[0].split(',');
          const selfieIdx = headerCols.indexOf('selfie');
          if (selfieIdx !== -1) headerCols[selfieIdx] = 'selfie_available';
          lines[0] = headerCols.join(',');

          // Modify data lines
          for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
              const parts = lines[i].split(',');
              if (selfieIdx !== -1 && parts.length > selfieIdx) {
                parts[selfieIdx] = parts[selfieIdx] ? 'HAS_SELFIE' : 'NO_SELFIE';
              }
              lines[i] = parts.join(',');
            }
          }
        }

        const modifiedCSV = lines.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance_records.csv"');
        res.send(modifiedCSV);

        console.log(`[DOWNLOAD_SUCCESS] Modified attendance CSV downloaded successfully`);
      });
    });
  }
}

module.exports = AttendanceController;