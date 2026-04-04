const fs = require('fs').promises;
const path = require('path');

const SESSIONS_FILE = path.join(__dirname, '..', 'data', 'sessions.json');

async function getAllSessions() {
  try {
    const raw = await fs.readFile(SESSIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

module.exports = {
  getAllSessions
};
