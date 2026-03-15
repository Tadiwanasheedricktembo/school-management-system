# QR-Based Attendance System Backend

A Node.js/Express backend for a QR-based attendance system: dynamic QR tokens (30s expiry), session management, and CSV attendance recording with optional location and selfie.

## Existing Features

- **Lecturer authentication** – JWT-based login (`/api/auth/login`); protected routes require `Authorization: Bearer <token>`.
- **Session management** – Create sessions (course, class, lecturer, note), 10-minute attendance window, manual end or auto-close when expired. Sessions stored in `data/sessions.json`.
- **Session expiry** – Server closes expired sessions on list and via a periodic watcher; attendance is rejected once a session is closed or past its window.
- **Dynamic QR tokens** – UUID tokens, 30s TTL, stored in SQLite `qr_tokens`; QR image returned as data URL. Only generated for open sessions.
- **Token validation** – Mark attendance checks token exists, not expired, and linked session is still active and open.
- **Mark attendance** – Public `POST /api/attendance/mark`. Requires `roll_number` and `token`; optional `device_id`, `latitude`, `longitude`, `selfie` (or `selfie_metadata` / `selfie_path`). Accepts alternate field names: `student_id`/`studentId`/`rollNumber`, `qr_token`/`qrToken`, `deviceId`, `lat`/`lng`/`lon`.
- **Duplicate prevention** – One attendance per (roll_number, session_id) and per (device_id, session_id) when device_id is provided.
- **Attendance storage** – Records appended to `data/attendance_records.csv` (roll_number, session_id, token, scan_time, status, device_id, latitude, longitude, selfie).
- **Get attendance** – Per-session records: `GET /api/attendance/session/:session_id`. All records: `GET /api/attendance/records`. Both protected.
- **Export** – `GET /api/attendance/download` returns full CSV (selfie column as HAS_SELFIE/NO_SELFIE). Protected.
- **CORS** – Enabled for web and mobile.
- **Large payloads** – JSON/urlencoded body limit 5MB for selfie data.

## Tech Stack

- **Node.js** – Runtime
- **Express.js** – Web framework
- **SQLite** – Tokens (and schema for students/sessions/attendance; app uses file-based sessions + CSV for attendance)
- **JWT** – Lecturer auth
- **UUID** – Token generation
- **QRCode** – QR image generation
- **CORS** – Cross-origin requests

## Project Structure

```
server/
├── server.js                 # Entry point, route mounting, expiry watcher
├── config/
│   └── database.js           # SQLite connection and table init
├── data/
│   ├── sessions.json         # Session list (created at runtime)
│   └── attendance_records.csv # Attendance records (created at runtime)
├── models/
│   └── Token.js              # QR token create/find/expiry (SQLite)
├── controllers/
│   ├── authController.js     # Login, JWT, verifyLecturer middleware
│   ├── sessionController.js  # Create/end/list sessions (file-based)
│   ├── qrController.js       # QR generation (token + image)
│   └── attendanceController.js # Mark, get, download attendance (CSV)
├── routes/
│   ├── qrRoutes.js           # GET /api/qr/generate
│   ├── attendanceRoutes.js   # Mark, records, download, session/:id
│   └── sessionRoutes.js      # Create, end, list
└── services/
    └── tokenService.js       # Generate and validate tokens
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

Default port: **3000**.

## API Endpoints

### Health (public)
- **GET** `/api/health` – Server status and timestamp.

### Auth
- **POST** `/api/auth/login`  
  Body: `{ "username", "password" }`.  
  Returns JWT for lecturer. Use header: `Authorization: Bearer <token>` on protected routes.

### Session (protected except list)
- **POST** `/api/session/create` – Create session. Body: `course_name`, `class_name`, `lecturer_name`, `note`. Returns `session_id`, `label`, `expiry_time`, etc.
- **POST** `/api/session/end` – Close session. Body: `session_id`.
- **GET** `/api/session/list` – **Public.** List all sessions (expired ones auto-closed). Returns `sessions[]` with `session_id`, `created_at`, `expiry_time`, `is_closed`, `label`, etc.

### QR (protected)
- **GET** `/api/qr/generate?session_id=<id>` – New 30s token and QR data URL for an open session.

### Attendance
- **POST** `/api/attendance/mark` – **Public.** Mark attendance.  
  Body (required): `roll_number`, `token`.  
  Optional: `device_id`, `latitude`, `longitude`, `selfie` (or `selfie_metadata` / `selfie_path`).  
  Alternate names accepted: `student_id`/`studentId`/`rollNumber`, `qr_token`/`qrToken`, `deviceId`, `lat`/`lng`/`lon`.

- **GET** `/api/attendance/session/:session_id` – **Protected.** Records for one session. Response: `{ status, data: [...] }`.
- **GET** `/api/attendance/records` – **Protected.** All records. Response: `{ status, records: [...] }`.
- **GET** `/api/attendance/download` – **Protected.** Full CSV file download.

## Data Storage

- **Sessions** – `data/sessions.json` (created/updated by session controller).
- **Attendance** – `data/attendance_records.csv` (append per mark; columns: roll_number, session_id, token, scan_time, status, device_id, latitude, longitude, selfie).
- **QR tokens** – SQLite `qr_tokens` (token, session_id, expires_at). Database file: `attendance.db`.

## Security

- **Lecturer routes** – Require `Authorization: Bearer <jwt>` (session create/end, QR generate, attendance records/download/session). Only `/api/attendance/mark` and `/api/session/list` are public.
- **Token expiry** – QR tokens valid 30 seconds.
- **Session window** – Attendance allowed only while session is open and within its attendance window (e.g. 10 minutes from create). Expired sessions are closed by the server.
- **Duplicate checks** – Same roll + session and same device + session cannot mark twice.

## Usage Workflow

1. Lecturer logs in → receives JWT.
2. Lecturer creates a session → gets `session_id`.
3. Dashboard calls `GET /api/qr/generate?session_id=<id>` (with Bearer token) and displays the QR.
4. Students scan QR, app sends `POST /api/attendance/mark` with extracted token and roll number (and optional device_id, location, selfie).
5. Server validates token and session, checks duplicates, appends to CSV.
6. Lecturer can fetch live attendance per session, download full CSV, and end the session.

## Development

- SQLite DB and `data/` files are created on first use.
- Use `npm run dev` for auto-restart on file changes.

## License

This project is part of a personal QR-based attendance system and is not affiliated with any institution.

**Created by**  
TEMBO TADIWA E  
Email: tadiwanasheedricktembo@gmail.com
