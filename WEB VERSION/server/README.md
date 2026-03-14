# QR-Based Attendance System Backend

A Node.js/Express backend server for a QR-based attendance system that generates dynamic QR tokens that expire every 30 seconds.

## Features

- **Dynamic QR Tokens**: Generates UUID-based tokens that expire after 30 seconds
- **Secure Attendance**: Prevents duplicate attendance and validates session time windows
- **REST API**: Clean REST endpoints for QR generation and attendance marking
- **SQLite Database**: Lightweight database for storing students, sessions, tokens, and attendance records
- **CORS Enabled**: Ready for integration with web and mobile applications

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQLite** - Database
- **UUID** - Token generation
- **QRCode** - QR code generation
- **CORS** - Cross-origin resource sharing

## Project Structure

```
server/
├── server.js              # Main application entry point
├── config/
│   └── database.js        # Database configuration and initialization
├── models/
│   ├── Student.js         # Student model
│   ├── Session.js         # Session model
│   ├── Token.js           # QR Token model
│   └── Attendance.js      # Attendance model
├── controllers/
│   ├── qrController.js    # QR generation logic
│   └── attendanceController.js  # Attendance marking logic
├── routes/
│   ├── qrRoutes.js        # QR-related routes
│   └── attendanceRoutes.js # Attendance-related routes
└── services/
    └── tokenService.js    # Token generation and validation service
```

## Installation

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

The server will start on port 3000 by default.

## API Endpoints

### Health Check
- **GET** `/api/health`
- Returns server status and timestamp

### QR Code Generation
- **GET** `/api/qr/generate?session_id={session_id}`
- Generates a new QR token for the specified session
- Returns token, expiration time, and QR code image

**Response:**
```json
{
  "status": "success",
  "token": "2fa81b1c-82b2-4e4f-...",
  "expires_in": 30,
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### Mark Attendance
- **POST** `/api/attendance/mark`
- Marks attendance for a student using a valid QR token. Only `roll_number` (previously `student_id`) and `token` are required; additional metadata may be supplied.

**Request Body:**
```json
{
  "roll_number": "STU001",
  "token": "2fa81b1c-82b2-4e4f-...",
  "device_id": "device-xyz",        // optional
  "latitude": 12.3456,               // optional
  "longitude": 65.4321,              // optional
  "selfie_path": "path/or/filename"// optional (or use selfie_metadata field)
}
```

**Success Response:**
```json
{
  "status": "success",
  "message": "Attendance recorded"
}
```

**Error Responses:**
```json
{
  "status": "error",
  "message": "Invalid QR"
}
```
```json
{
  "status": "error",
  "message": "QR expired"
}
```
```json
{
  "status": "error",
  "message": "Attendance already recorded"
}
```

### Get Session Attendance
- **GET** `/api/attendance/session/{session_id}`
- Retrieves all attendance records for a specific session

## Database Schema

### Students
```sql
CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  device_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Sessions
```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code TEXT NOT NULL,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### QR Tokens
```sql
CREATE TABLE qr_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  session_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions (id)
);
```

### Attendance
```sql
CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  session_id INTEGER NOT NULL,
  scan_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'present',
  FOREIGN KEY (student_id) REFERENCES students (student_id),
  FOREIGN KEY (session_id) REFERENCES sessions (id),
  UNIQUE(student_id, session_id)
);
```

## Security Features

1. **Token Expiration**: QR tokens expire after 30 seconds
2. **Duplicate Prevention**: Students cannot mark attendance twice for the same session
3. **Session Time Validation**: Attendance only allowed within session start and end times
4. **Unique Constraints**: Database-level constraints prevent duplicate records

## Usage Workflow

1. **Lecturer starts session** and gets session_id
2. **Website calls** `/api/qr/generate?session_id=123` every 30 seconds
3. **QR code displays** on lecturer's screen
4. **Student scans QR** with mobile app
5. **App extracts token** and sends POST to `/api/attendance/mark`
6. **Server validates** token and records attendance

## Future Enhancements

- GPS location validation
- Device ID validation
- User authentication
- Session management UI
- Student registration API
- Analytics and reporting

## Development

The server automatically creates the SQLite database file (`attendance.db`) and initializes all tables on startup.

For development, use `npm run dev` to enable auto-restart on file changes.

## License

This project is part of the QR-based attendance system implementation.Its part of my personal projects which i usually work on and is not affiliated to any institute


CREATED BY 
TEMBO TADIWA E
EMAIL: tadiwanasheedricktembo@gmail.com