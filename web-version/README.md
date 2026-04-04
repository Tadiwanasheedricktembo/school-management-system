# QR-Based Attendance System

A comprehensive web-based attendance tracking system using QR codes with role-based access control. Features dynamic QR tokens, session management, and secure authentication for admins and lecturers.

## System Overview

The system consists of:
- **Admin Panel**: Manage lecturers, courses, sessions, and view global attendance reports
- **Lecturer Dashboard**: Create sessions, generate QR codes, monitor attendance in real-time
- **Student Interface**: Scan QR codes to mark attendance with optional location and selfie verification
- **Backend API**: RESTful API with JWT authentication, SQLite database, and CORS support

## Project Structure

```
/
├── server/                    # Main backend (Node.js + Express + SQLite)
│   ├── config/
│   │   └── database.js        # SQLite database configuration
│   ├── controllers/
│   │   ├── adminController.js # Admin management (lecturers, courses, sessions)
│   │   ├── attendanceController.js # Attendance marking and records
│   │   ├── authController.js  # JWT authentication
│   │   ├── qrController.js    # QR token generation
│   │   └── sessionController.js # Session creation and management
│   ├── middleware/
│   │   └── auth.js            # Authentication middleware
│   ├── models/
│   │   ├── Attendance.js      # Attendance data model
│   │   ├── Session.js         # Session data model
│   │   └── Student.js         # Student data model
│   ├── routes/
│   │   ├── adminRoutes.js     # Admin-only routes
│   │   ├── attendanceRoutes.js # Attendance routes
│   │   ├── qrRoutes.js        # QR generation routes
│   │   └── sessionRoutes.js   # Session routes
│   ├── scripts/
│   │   ├── createLecturer.js  # CLI tool to create lecturers
│   │   ├── seedAdmin.js       # Seed default admin user
│   │   └── migrate_attendance_csv.js # Data migration scripts
│   ├── services/
│   │   └── tokenService.js    # Token generation and validation
│   ├── utils/
│   │   ├── auditLogger.js     # Audit logging
│   │   ├── csvAttendanceStore.js # CSV-based attendance storage
│   │   └── sessionStore.js    # Session data management
│   ├── data/
│   │   ├── attendance_records.csv # Attendance data storage
│   │   └── sessions.json       # Session data storage
│   ├── server.js              # Main server entry point
│   └── package.json           # Backend dependencies
├── website/                   # Frontend (Static HTML/CSS/JS)
│   ├── admin/
│   │   ├── index.html         # Admin dashboard
│   │   ├── script.js          # Admin panel logic
│   │   └── style.css          # Admin styling
│   ├── attendance.html        # Student attendance marking page
│   ├── qr.html                # QR code display page
│   ├── session.html           # Lecturer dashboard
│   └── (shared CSS/JS)        # Common styles and utilities
├── backend/                   # Legacy backend (deprecated)
└── README.md                  # This file
```

## Features

### Core Functionality
- ✅ **Dynamic QR Code Generation**: Time-limited QR tokens (30-second expiry)
- ✅ **Role-Based Access Control**: Separate admin and lecturer permissions
- ✅ **Session Management**: Create, monitor, and close attendance sessions
- ✅ **Real-Time Attendance Tracking**: Mark attendance with roll number validation
- ✅ **Duplicate Prevention**: Device and roll number tracking prevents duplicates
- ✅ **Location Tracking**: Optional GPS coordinates for attendance verification
- ✅ **Selfie Verification**: Optional photo capture for identity confirmation
- ✅ **CSV Export**: Download attendance reports with filtering
- ✅ **Audit Logging**: Track all administrative actions

### Admin Features
- Manage lecturers (add, edit, activate/deactivate)
- Manage courses and departments
- View global attendance statistics
- Access all sessions and attendance records
- Generate system-wide reports
- Monitor audit logs

### Lecturer Features
- Create and manage attendance sessions
- Generate QR codes for sessions
- View attendance records for their sessions only
- Download filtered attendance reports
- Real-time session monitoring

### Student Features
- Scan QR codes to mark attendance
- Optional location sharing
- Optional selfie upload
- Instant feedback on attendance status

## Technology Stack

- **Backend**: Node.js, Express.js, SQLite, JWT, bcrypt
- **Frontend**: Vanilla HTML/CSS/JavaScript (no frameworks)
- **Database**: SQLite with CSV fallback for attendance data
- **Authentication**: JWT tokens with role-based middleware
- **QR Generation**: Server-side QR code creation
- **File Storage**: Local file system for data persistence

## Quick Start

### Prerequisites
- Node.js (v14+)
- npm or yarn

### Installation & Setup

1. **Clone/Download the project**
   ```bash
   cd "your-project-directory"
   ```

2. **Install Backend Dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Seed Default Admin User**
   ```bash
   npm run seed-admin
   ```
   Default admin: `admin@example.com` / `admin123`

4. **Start the Server**
   ```bash
   npm start
   ```
   Server runs on: `http://localhost:3000`

5. **Access the Application**
   - **Admin Panel**: `http://localhost:3000/website/admin/index.html`
   - **Lecturer Dashboard**: `http://localhost:3000/website/session.html`
   - **Student Attendance**: `http://localhost:3000/website/attendance.html`
   - **QR Display**: `http://localhost:3000/website/qr.html`

## API Documentation

### Authentication
- `POST /api/auth/login` - User login (body: `{email, password}`) - Returns JWT token and user info

### Admin Routes (Require Admin Role)
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET/POST/PUT/PATCH/DELETE /api/admin/lecturers` - Lecturer management
- `GET/POST/PUT /api/admin/courses` - Course management
- `GET /api/admin/sessions` - All sessions
- `GET /api/admin/attendance` - All attendance records with filtering
- `DELETE /api/admin/attendance/:id` - Delete attendance record
- `GET /api/admin/audit-logs` - System audit logs

### Lecturer Routes (Require Lecturer/Admin Role)
- `POST /api/session/create` - Create new session
- `GET /api/session/list` - List sessions (public for display)
- `GET /api/attendance/records` - Attendance records (filtered by ownership)
- `GET /api/attendance/download` - Download CSV (filtered)
- `GET /api/attendance/session/:session_id` - Session-specific attendance

### Public Routes (No Authentication)
- `GET /api/health` - Server health check
- `GET /api/qr/generate?session_id=X` - Generate QR token
- `POST /api/attendance/mark` - Mark attendance (body: `{roll_number, token, ...}`)

## User Roles & Permissions

### Admin
- Full system access
- Manage users, courses, sessions
- View all attendance data
- Access audit logs
- Generate reports

### Lecturer
- Create and manage their sessions
- Generate QR codes
- View attendance for their sessions only
- Download filtered reports
- Cannot access admin functions or other lecturers' data

### Student
- Mark attendance by scanning QR codes
- No login required
- Optional location/selfie sharing

## Development

### Adding New Features
1. Update backend routes/controllers as needed
2. Modify frontend HTML/JS for UI changes
3. Test role-based access thoroughly
4. Update this README

### Database Schema
- **users**: id, name, email, password_hash, role, is_active, created_at, updated_at
- **courses**: id, course_name, course_code, department, created_at, updated_at
- **sessions.json**: session_id, lecturer_id, course_name, class_name, lecturer_name, created_at, attendance_window_minutes, is_closed, note
- **attendance_records.csv**: roll_number, student_name, session_id, token, scan_time, status, device_id, latitude, longitude, selfie

### Security Notes
- Passwords hashed with bcrypt
- JWT tokens with configurable expiry
- Role-based middleware protects sensitive routes
- Input validation on all endpoints
- CORS enabled for cross-origin requests

## Troubleshooting

### Common Issues
- **"Endpoint not found"**: Ensure correct API URLs and server is running
- **Login fails**: Check user credentials and role permissions
- **QR not working**: Verify session exists and token is valid
- **Attendance not marking**: Check token expiry and duplicate prevention

### Logs
Check server console for detailed error messages and audit trails.

## Contributing

1. Follow the existing code structure
2. Add proper error handling
3. Test role-based access
4. Update documentation

## License

This project is for educational purposes. Modify and use as needed.

## API Endpoints (SQLite Backend)

### Authentication
- `POST /api/auth/login` - Lecturer login (body: `{username, password}`) - Returns JWT token

### QR Generation
- `GET /api/qr/generate?session_id=123` - Generate QR token (public)

### Attendance (Public - No Auth Required)
- `POST /api/attendance/mark` - Mark attendance (body: `{roll_number, token}` plus optional `device_id`, `latitude`, `longitude`, `selfie_path` or `selfie_metadata`)
- `GET /api/attendance/records` - Get all attendance records
- `GET /api/attendance/download` - Download attendance CSV
- `GET /api/attendance/session/:session_id` - Get session attendance

### Session Management (Requires Lecturer Auth)
- `POST /api/session/create` - Create session (optional metadata: course_name, class_name, lecturer_name, note)
- `POST /api/session/end` - End a session manually (body: `{session_id}`)
- `GET /api/session/list` - List all sessions (public for dashboard)

## API Endpoints

### Express Backend
- `GET /api/health` - Health check

### SQLite Backend
- `GET /api/health` - Health check
- `GET /api/qr/generate?session_id=123` - Generate QR token
- `POST /api/attendance/mark` - Mark attendance (body: `{roll_number, token}` plus optional `device_id`, `latitude`, `longitude`, `selfie_path` or `selfie_metadata`)
- `POST /api/session/end` - End a session manually (body `{ session_id }`)
- `GET /api/attendance/session/:session_id` - Get session attendance

## Frontend Integration

The frontend can communicate with either backend:

- **Express Backend**: `http://localhost:5000/api/*`
- **SQLite Backend**: `http://localhost:3000/api/*`

## Development

1. Choose your preferred backend implementation
2. Start the backend server
3. Build your frontend to call the backend APIs
4. Enable CORS (already configured in both backends)

## Features

- ✅ Dynamic QR token generation (30-second expiry)
- ✅ Duplicate attendance prevention (roll number + device tracking)
- ✅ Device-based anti-cheating (one device = one attendance per session)
- ✅ Session time window validation
- ✅ Manual session closure support (lecturers can end sessions early)
- ✅ Session labels with optional metadata (course, class, lecturer, note)
- ✅ Lecturer authentication for session management (JWT-based)
- ✅ Public attendance marking (no auth required for students)
- ✅ RESTful API design
- ✅ CORS enabled for frontend integration
- ✅ SQLite database with CSV export
- ✅ Web-based lecturer interface (session.html)
- ✅ Web-based attendance interface (attendance.html)
- ✅ QR code display interface (qr.html)

## How the System Works (End-to-End)
1. **Lecturer logs in** on the web dashboard (`session.html`). Authentication uses JWT.
2. **Lecturer creates a session** (`POST /api/session/create`). The backend stores session metadata and defines the attendance window.
3. For the active session, the dashboard requests a **dynamic QR token** (`GET /api/qr/generate?session_id=<id>`). Tokens use a short expiry (approximately 30 seconds) and are only generated for open sessions.
4. **Students scan the QR** in the Android app and call `POST /api/attendance/mark` with:
   - `token` (from QR)
   - `roll_number` (identity)
   - optional details like `studentName`, `device_id`, `latitude`, `longitude`, and `selfie`
5. The backend validates the token/session, checks duplicates for the same `(roll_number, session_id)` (and optionally `(device_id, session_id)`), then appends the attendance entry to `server/data/attendance_records.csv`.
6. The lecturer dashboard shows **live attendance** via polling `GET /api/attendance/session/:session_id`.
7. The lecturer can view **history** and export CSV via `GET /api/attendance/records` and `GET /api/attendance/download`.

## Next Steps

1. Build additional frontend features (real-time updates, better UI)
2. Add user management system for lecturers
3. Implement session analytics and reporting
4. Add email/SMS notifications for attendance
5. Deploy to production environment






PERSONAL PROJECT
CREATED BY
TEMBO TADIWA E
Email: tadiwanasheedricktembo@gmail.com