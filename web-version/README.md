# QR-Based Attendance System

A full-stack web application for QR-based attendance tracking with dynamic tokens that expire every 30 seconds.

## Project Structure

```
/
├── backend/           # Node.js/Express API server
│   ├── config/        # Database configuration
│   ├── controllers/   # API controllers
│   ├── models/        # Data models
│   ├── routes/        # API routes
│   ├── server.js      # Main server file
│   └── package.json   # Backend dependencies
├── server/            # Alternative backend implementation (SQLite-based)
└── frontend/          # React/Vue/Angular frontend (to be added)
```

## Backend Setup

The project includes two backend implementations:

### Option 1: Express Backend (`/backend`)
- **Technology**: Node.js, Express, MongoDB/PostgreSQL
- **Port**: 5000
- **Features**: REST API, CORS enabled, database-ready

### Option 2: SQLite Backend (`/server`)
- **Technology**: Node.js, Express, SQLite
- **Port**: 3000
- **Features**: Complete attendance system with QR generation, session labels, lecturer authentication

## Quick Start

### Backend (Express + Database)
```bash
cd backend
npm install
npm run dev
```
Server runs on: `http://localhost:5000`

### Alternative Backend (SQLite)
```bash
cd server
npm install
npm start
```
Server runs on: `http://localhost:3000`

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