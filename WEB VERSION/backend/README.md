# Backend API

Node.js/Express backend for the QR-based attendance system.

## Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file (optional):
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration.

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Or start the production server:
   ```bash
   npm start
   ```

The backend will run on `http://localhost:5000`.

## API Endpoints

### Health Check
- **GET** `/api/health`
- Response: `{ "status": "Backend running" }`

## Project Structure

```
backend/
├── config/
│   └── database.js          # Database connection placeholders
├── controllers/
│   └── baseController.js    # Base controller with helper methods
├── models/
│   └── baseModel.js         # Base model with validation helpers
├── routes/
│   └── health.js            # Health check route
├── server.js                # Main Express server
├── package.json             # Dependencies and scripts
└── .env.example             # Environment variables template
```

## Database Setup

The backend is prepared for both MongoDB and PostgreSQL connections. Choose one and configure the environment variables in `.env`.

### MongoDB
- Install MongoDB locally or use a cloud service
- Set `MONGODB_URI` in `.env`

### PostgreSQL
- Install PostgreSQL locally
- Set `PG_*` variables in `.env`

## Development

- Use `npm run dev` for development with auto-restart
- Add new routes in the `routes/` directory
- Add controllers in the `controllers/` directory
- Add models in the `models/` directory

## CORS

CORS is enabled to allow the frontend to communicate with the backend.