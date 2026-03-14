const fs = require('fs');
const path = require('path');
const TokenService = require('../services/tokenService');
const SessionController = require('./sessionController');

const ATTENDANCE_FILE = path.join(__dirname, '..', 'data', 'attendance_records.csv');
const DATA_DIR = path.join(__dirname, '..', 'data');

class AttendanceController {
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
        'roll_number,session_id,token,scan_time,status,device_id,latitude,longitude,selfie\n',
        'utf8'
      );
    } else {
      // ensure header contains all optional columns
      const content = fs.readFileSync(ATTENDANCE_FILE, 'utf8');
      const lines = content.split('\n');
      const header = lines[0];
      const required = ['device_id', 'latitude', 'longitude', 'selfie'];
      const headers = header.split(',');
      const missing = required.filter(col => !headers.includes(col));
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

      const lines = data.split('\n').slice(1); // Skip header
      const isDuplicate = lines.some(line => {
        if (!line.trim()) return false;
        const [roll, session] = line.split(',');
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

      const lines = data.split('\n').slice(1); // Skip header
      const isDuplicate = lines.some(line => {
        if (!line.trim()) return false;
        const parts = line.split(',');
        // device_id is the 6th column (index 5)
        const session = parts[1];
        const device = parts[5];
        return device === device_id && session === session_id.toString();
      });

      callback(null, isDuplicate);
    });
  }

  // Append attendance record to CSV
  static appendToCSV(roll_number, session_id, token, device_id, latitude, longitude, selfie, callback) {
    const scanTime = new Date().toISOString();
    const status = 'present';
    // ensure values are strings and fallback to empty
    const dev = device_id || '';
    const lat = latitude || '';
    const lon = longitude || '';
    const sf = selfie || '';
    const csvLine = `${roll_number},${session_id},${token},${scanTime},${status},${dev},${lat},${lon},${sf}\n`;

    fs.appendFile(ATTENDANCE_FILE, csvLine, 'utf8', (err) => {
      if (err) {
        return callback(err);
      }
      callback(null, {
        roll_number,
        session_id,
        token,
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
    const {
      roll_number,
      token,
      device_id,
      latitude,
      longitude,
      selfie,
      selfie_path,
      selfie_metadata
    } = req.body;

    // Normalize selfie fields: prioritize 'selfie', then 'selfie_metadata', then 'selfie_path'
    const selfieValue = selfie || selfie_metadata || selfie_path || '';

    console.log(
      `[ATTENDANCE_REQUEST] Roll Number: ${roll_number}, Token: ${token}, Device ID: ${device_id}, ` +
        `Latitude: ${latitude}, Longitude: ${longitude}, Selfie: ${selfieValue ? '[provided]' : '[none]'} `
    );

    // only roll_number and token remain required
    if (!roll_number || !token) {
      return res.status(400).json({
        status: 'error',
        message: 'Roll number and token are required'
      });
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

        // check if session was manually closed
        if (session.is_closed) {
          console.log(`[ATTENDANCE_REJECTED] Session ${session_id} manually closed`);
          return res.status(400).json({
            status: 'error',
            message: 'Session closed'
          });
        }

        if (now > windowCloseTime) {
          console.log(`[ATTENDANCE_REJECTED] Attendance window closed for session ${session_id}`);
          return res.status(400).json({
            status: 'error',
            message: 'Attendance window closed'
          });
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

      const lines = data.split('\n').slice(1); // Skip header
      const records = lines
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split(',');
          const roll_number = parts[0];
          const sess_id = parts[1];
          const token = parts[2];
          const scan_time = parts[3];
          const status = parts[4];
          const device_id = parts[5] || '';
          const latitude = parts[6] || '';
          const longitude = parts[7] || '';
          const selfie = parts[8] || '';
          return { roll_number, session_id: sess_id, token, scan_time, status, device_id, latitude, longitude, selfie };
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

      const lines = data.split('\n').slice(1); // Skip header
      const records = lines
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split(',');
          const roll_number = parts[0];
          const session_id = parseInt(parts[1]);
          const token = parts[2];
          const scan_time = parts[3];
          const status = parts[4];
          const device_id = parts[5] || '';
          const latitude = parts[6] || '';
          const longitude = parts[7] || '';
          const selfie = parts[8] || '';
          return { roll_number, session_id, token, scan_time, status, device_id, latitude, longitude, selfie };
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
          // Modify header
          lines[0] = lines[0].replace(/selfie$/, 'selfie_available');
          // Modify data lines
          for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
              const parts = lines[i].split(',');
              if (parts.length >= 9) {
                // Selfie is the 9th column (index 8)
                parts[8] = parts[8] ? 'HAS_SELFIE' : 'NO_SELFIE';
                lines[i] = parts.join(',');
              }
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