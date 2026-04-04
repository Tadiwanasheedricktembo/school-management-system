const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const ATTENDANCE_FILE = path.join(__dirname, '..', 'data', 'attendance_records.csv');
let isWriting = false;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (ch === '\r') {
      continue;
    }
    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function hashRow(values) {
  return crypto.createHash('sha256').update(values.join('\u001f')).digest('hex').slice(0, 20);
}

function getDateKeyFromScanTime(scanTime) {
  if (!scanTime) return null;
  const d = new Date(scanTime);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function readAttendanceStore() {
  try {
    const raw = await fs.readFile(ATTENDANCE_FILE, 'utf8');
    let rows;
    try {
      rows = parseCsv(raw);
    } catch (err) {
      throw new Error('CSV parsing failed: corrupted file');
    }
    if (!rows.length) {
      return { headers: [], records: [], rawRows: [] };
    }

    const headers = rows[0];
    const dataRows = rows.slice(1).filter((r) => r.some((v) => String(v || '').trim() !== ''));
    const hashOccurrence = new Map();

    const records = dataRows.map((rowValues) => {
      if (rowValues.length !== headers.length) {
        console.warn('Skipping malformed row:', rowValues);
        return null;
      }
      const normalizedValues = headers.map((_, idx) => rowValues[idx] || '');
      const rowHash = hashRow(normalizedValues);
      const count = (hashOccurrence.get(rowHash) || 0) + 1;
      hashOccurrence.set(rowHash, count);
      const row_id = `${rowHash}-${count}`;

      const record = {};
      headers.forEach((header, idx) => {
        record[header] = normalizedValues[idx] || '';
      });
      record.row_id = row_id;
      return record;
    }).filter(r => r !== null);

    return { headers, records, rawRows: dataRows };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { headers: [], records: [], rawRows: [] };
    }
    throw err;
  }
}

async function writeAttendanceStore(headers, records) {
  if (isWriting) {
    throw new Error('Write in progress, try again');
  }
  isWriting = true;
  try {
    const lines = [];
    lines.push(headers.map(escapeCsvValue).join(','));
    records.forEach((record) => {
      const row = headers.map((h) => escapeCsvValue(record[h] || ''));
      lines.push(row.join(','));
    });
    const content = `${lines.join('\n')}\n`;
    await fs.writeFile(ATTENDANCE_FILE, content, 'utf8');
  } finally {
    isWriting = false;
  }
}

async function getAllAttendance() {
  const { records } = await readAttendanceStore();
  return records;
}

async function getAttendanceStats() {
  const { records } = await readAttendanceStore();
  const todayKey = new Date().toISOString().slice(0, 10);
  const attendanceToday = records.filter((r) => getDateKeyFromScanTime(r.scan_time) === todayKey).length;
  return {
    attendanceToday,
    totalAttendanceRecords: records.length
  };
}

async function deleteAttendanceByRowId(rowId) {
  const store = await readAttendanceStore();
  if (!store.headers.length) {
    return { deleted: false, reason: 'Attendance store is empty' };
  }

  const idx = store.records.findIndex((r) => r.row_id === rowId);
  if (idx === -1) {
    return { deleted: false, reason: 'Attendance record not found' };
  }

  const deletedRecord = { ...store.records[idx] };
  const remaining = store.records.filter((_, i) => i !== idx).map((r) => {
    const clean = {};
    store.headers.forEach((h) => {
      clean[h] = r[h] || '';
    });
    return clean;
  });

  await writeAttendanceStore(store.headers, remaining);
  return { deleted: true, deletedRecord };
}

module.exports = {
  getAllAttendance,
  getAttendanceStats,
  deleteAttendanceByRowId
};
