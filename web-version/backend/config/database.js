const mongoose = require('mongoose');
const { Pool } = require('pg');

// MongoDB connection (placeholder)
const connectMongoDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system';
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // Don't exit process, just log the error
  }
};

// PostgreSQL connection (placeholder)
const connectPostgreSQL = async () => {
  try {
    const pool = new Pool({
      user: process.env.PG_USER || 'postgres',
      host: process.env.PG_HOST || 'localhost',
      database: process.env.PG_DATABASE || 'attendance_system',
      password: process.env.PG_PASSWORD || 'password',
      port: process.env.PG_PORT || 5432,
    });

    await pool.connect();
    console.log('PostgreSQL connected successfully');
    return pool;
  } catch (error) {
    console.error('PostgreSQL connection error:', error);
    return null;
  }
};

// Export connection functions
module.exports = {
  connectMongoDB,
  connectPostgreSQL
};