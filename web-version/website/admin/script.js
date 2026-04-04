// Configuration
const API_BASE = 'http://localhost:3000/api';
const TOKEN_KEY = 'admin_token';
const USER_KEY = 'admin_user';

// State
let currentPage = 'dashboard';
let currentUser = null;
let attendancePage = 1;
let attendanceLimit = 50;
let attendanceFilters = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupLoginForm();
  initializeEventListeners();
});

// Auth
function checkAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);

  if (!token) {
    showLogin();
    return;
  }

  currentUser = user ? JSON.parse(user) : null;

  if (currentUser && currentUser.role !== 'admin') {
    logout();
    return;
  }

  if (currentUser) {
    document.getElementById('user-name').textContent = currentUser.name || 'Admin';
    document.getElementById('user-email').textContent = currentUser.email || 'admin@example.com';
    console.log('[ADMIN] 👤 Dashboard auth initialization - current user:', {
      name: currentUser.name || 'Admin',
      email: currentUser.email || 'admin@example.com',
      role: currentUser.role || 'unknown'
    });
  }

  hideLogin();
  loadDashboard();
}

// Login UI
function showLogin() {
  const loginContainer = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');
  if (loginContainer) loginContainer.style.display = 'flex';
  if (appContainer) appContainer.style.display = 'none';
}

function hideLogin() {
  const loginContainer = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');
  if (loginContainer) loginContainer.style.display = 'none';
  if (appContainer) appContainer.style.display = 'flex';
}

function setupLoginForm() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  loginForm.addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const messageEl = document.getElementById('login-message');

  if (!email || !password) {
    showLoginError('Email and password are required');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showLoginError(data.message || 'Login failed');
      return;
    }

    // Check if user is admin
    if (data.user.role !== 'admin') {
      showLoginError('Access denied: Admins only');
      return;
    }

    // Store token and user
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));

    currentUser = data.user;

    console.log('[ADMIN] 🔐 Login success - stored keys:', {
      admin_token: data.token ? `${data.token.substring(0, 20)}...` : 'NULL',
      admin_user: data.user ? `${data.user.name} (${data.user.email})` : 'NULL'
    });

    // Update UI and show dashboard
    document.getElementById('user-name').textContent = data.user.name || 'Admin';
    document.getElementById('user-email').textContent = data.user.email || 'admin@example.com';

    // Clear login form
    document.getElementById('login-form').reset();
    
    // Show dashboard
    hideLogin();
    loadDashboard();
  } catch (error) {
    showLoginError('Login failed: ' + error.message);
  }
}

function showLoginError(message) {
  const messageEl = document.getElementById('login-message');
  if (messageEl) {
    messageEl.textContent = message;
    messageEl.className = 'login-message error';
  }
}

// Event Listeners
function initializeEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchPage(item.dataset.page);
    });
  });

  // Logout
  document.querySelector('.logout-btn').addEventListener('click', logout);

  // Modal
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) {
      closeModal();
    }
  });

  // Lecturers
  document.getElementById('add-lecturer-btn')?.addEventListener('click', () => openLecturerModal());

  // Courses
  document.getElementById('add-course-btn')?.addEventListener('click', () => openCourseModal());

  // Attendance
  document.getElementById('apply-filters')?.addEventListener('click', applyFilters);
  document.getElementById('prev-page')?.addEventListener('click', () => changePage(-1));
  document.getElementById('next-page')?.addEventListener('click', () => changePage(1));
}

// Navigation
function switchPage(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show selected page
  const pageEl = document.getElementById(page + '-page');
  if (pageEl) {
    pageEl.classList.add('active');
  }

  // Update nav
  document.querySelector(`[data-page="${page}"]`).classList.add('active');

  // Update title
  const titles = {
    dashboard: 'Dashboard',
    lecturers: 'Lecturers',
    courses: 'Courses',
    sessions: 'Sessions',
    attendance: 'Attendance Records',
    audit: 'Audit Logs'
  };
  document.getElementById('page-title').textContent = titles[page] || 'Dashboard';

  currentPage = page;

  // Load data
  switch (page) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'lecturers':
      loadLecturers();
      break;
    case 'courses':
      loadCourses();
      break;
    case 'sessions':
      loadSessions();
      break;
    case 'attendance':
      attendancePage = 1;
      loadAttendance();
      break;
    case 'audit':
      loadAuditLogs();
      break;
  }
}

// API Calls
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem(TOKEN_KEY)}`
  };

  try {
    const response = await fetch(url, {
      headers,
      ...options
    });

    if (response.status === 401) {
      logout();
      return null;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    showToast(error.message, 'error');
    return null;
  }
}

// Dashboard
async function loadDashboard() {
  const data = await apiCall('/admin/dashboard/stats');
  if (!data) return;

  document.getElementById('stat-total-lecturers').textContent = data.data.total_lecturers || 0;
  document.getElementById('stat-active-lecturers').textContent = data.data.active_lecturers || 0;
  document.getElementById('stat-total-courses').textContent = data.data.total_courses || 0;
  document.getElementById('stat-total-sessions').textContent = data.data.total_sessions || 0;
  document.getElementById('stat-attendance-today').textContent = data.data.attendance_today || 0;
  document.getElementById('stat-total-records').textContent = data.data.total_attendance_records || 0;
}

// Lecturers
async function loadLecturers() {
  const tbody = document.getElementById('lecturers-table');
  const emptyState = document.getElementById('lecturers-empty');
  const tableContainer = tbody.closest('.table-container');
  
  tbody.innerHTML = '<tr><td colspan="4" class="text-center"><div class="loading"></div></td></tr>';
  emptyState.style.display = 'none';

  const data = await apiCall('/admin/lecturers');
  if (!data) return;

  const lecturers = data.data || [];

  if (lecturers.length === 0) {
    tableContainer.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  tableContainer.style.display = 'block';
  emptyState.style.display = 'none';

  tbody.innerHTML = lecturers.map(lec => `
    <tr>
      <td>${escapeHtml(lec.name)}</td>
      <td>${escapeHtml(lec.email)}</td>
      <td>
        <span class="status-badge ${lec.is_active ? 'status-active' : 'status-inactive'}">
          ${lec.is_active ? '● Active' : '● Inactive'}
        </span>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="editLecturer(${lec.id})">Edit</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleLecturerStatus(${lec.id}, ${lec.is_active})">
            ${lec.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openLecturerModal() {
  document.getElementById('modal-title').textContent = 'Add Lecturer';
  document.getElementById('modal-form').innerHTML = `
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="lecturer-name" placeholder="Full name" required>
    </div>
    <div class="form-group">
      <label>Email</label>
      <input type="email" id="lecturer-email" placeholder="Email address" required>
    </div>
    <div class="form-group">
      <label>Password</label>
      <input type="password" id="lecturer-password" placeholder="Password" required>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-primary">Create</button>
    </div>
  `;

  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('lecturer-name').value.trim();
    const email = document.getElementById('lecturer-email').value.trim();
    const password = document.getElementById('lecturer-password').value;

    if (!name || !email || !password) {
      showToast('All fields are required', 'error');
      return;
    }

    const result = await apiCall('/admin/lecturers', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });

    if (result) {
      showToast('Lecturer created successfully', 'success');
      closeModal();
      loadLecturers();
    }
  };

  document.getElementById('modal-overlay').classList.add('active');
}

function editLecturer(id) {
  document.getElementById('modal-title').textContent = 'Edit Lecturer';
  document.getElementById('modal-form').innerHTML = `
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="lecturer-name" placeholder="Full name" required>
    </div>
    <div class="form-group">
      <label>Email</label>
      <input type="email" id="lecturer-email" placeholder="Email address" required>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-primary">Save</button>
    </div>
  `;

  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('lecturer-name').value.trim();
    const email = document.getElementById('lecturer-email').value.trim();

    if (!name || !email) {
      showToast('All fields are required', 'error');
      return;
    }

    const result = await apiCall(`/admin/lecturers/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, email })
    });

    if (result) {
      showToast('Lecturer updated successfully', 'success');
      closeModal();
      loadLecturers();
    }
  };

  document.getElementById('modal-overlay').classList.add('active');
}

async function toggleLecturerStatus(id, currentStatus) {
  const result = await apiCall(`/admin/lecturers/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: !currentStatus })
  });

  if (result) {
    showToast(currentStatus ? 'Lecturer deactivated' : 'Lecturer activated', 'success');
    loadLecturers();
  }
}

// Courses
async function loadCourses() {
  const tbody = document.getElementById('courses-table');
  const emptyState = document.getElementById('courses-empty');
  const tableContainer = tbody.closest('.table-container');
  
  tbody.innerHTML = '<tr><td colspan="4" class="text-center"><div class="loading"></div></td></tr>';
  emptyState.style.display = 'none';

  const data = await apiCall('/admin/courses');
  if (!data) return;

  const courses = data.data || [];

  if (courses.length === 0) {
    tableContainer.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  tableContainer.style.display = 'block';
  emptyState.style.display = 'none';

  tbody.innerHTML = courses.map(course => `
    <tr>
      <td>${escapeHtml(course.course_name)}</td>
      <td><strong>${escapeHtml(course.course_code)}</strong></td>
      <td>${escapeHtml(course.department || '-')}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="editCourse(${course.id})">Edit</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openCourseModal() {
  document.getElementById('modal-title').textContent = 'Add Course';
  document.getElementById('modal-form').innerHTML = `
    <div class="form-group">
      <label>Course Name</label>
      <input type="text" id="course-name" placeholder="e.g., Introduction to Python" required>
    </div>
    <div class="form-group">
      <label>Course Code</label>
      <input type="text" id="course-code" placeholder="e.g., CS101" required>
    </div>
    <div class="form-group">
      <label>Department</label>
      <input type="text" id="course-dept" placeholder="e.g., Computer Science">
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-primary">Create</button>
    </div>
  `;

  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const course_name = document.getElementById('course-name').value.trim();
    const course_code = document.getElementById('course-code').value.trim();
    const department = document.getElementById('course-dept').value.trim();

    if (!course_name || !course_code) {
      showToast('Course name and code are required', 'error');
      return;
    }

    const result = await apiCall('/admin/courses', {
      method: 'POST',
      body: JSON.stringify({ course_name, course_code, department })
    });

    if (result) {
      showToast('Course created successfully', 'success');
      closeModal();
      loadCourses();
    }
  };

  document.getElementById('modal-overlay').classList.add('active');
}

function editCourse(id) {
  document.getElementById('modal-title').textContent = 'Edit Course';
  document.getElementById('modal-form').innerHTML = `
    <div class="form-group">
      <label>Course Name</label>
      <input type="text" id="course-name" placeholder="e.g., Introduction to Python" required>
    </div>
    <div class="form-group">
      <label>Course Code</label>
      <input type="text" id="course-code" placeholder="e.g., CS101" required>
    </div>
    <div class="form-group">
      <label>Department</label>
      <input type="text" id="course-dept" placeholder="e.g., Computer Science">
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-primary">Save</button>
    </div>
  `;

  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const course_name = document.getElementById('course-name').value.trim();
    const course_code = document.getElementById('course-code').value.trim();
    const department = document.getElementById('course-dept').value.trim();

    if (!course_name || !course_code) {
      showToast('Course name and code are required', 'error');
      return;
    }

    const result = await apiCall(`/admin/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ course_name, course_code, department })
    });

    if (result) {
      showToast('Course updated successfully', 'success');
      closeModal();
      loadCourses();
    }
  };

  document.getElementById('modal-overlay').classList.add('active');
}

// Sessions
async function loadSessions() {
  const tbody = document.getElementById('sessions-table');
  const emptyState = document.getElementById('sessions-empty');
  const tableContainer = tbody.closest('.table-container');
  
  tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="loading"></div></td></tr>';
  emptyState.style.display = 'none';

  const data = await apiCall('/admin/sessions');
  if (!data) return;

  const sessions = data.data || [];

  if (sessions.length === 0) {
    tableContainer.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  tableContainer.style.display = 'block';
  emptyState.style.display = 'none';

  tbody.innerHTML = sessions.map(session => `
    <tr>
      <td><strong>${session.session_id}</strong></td>
      <td>${escapeHtml(session.lecturer_name || '-')}</td>
      <td>${escapeHtml(session.course_name || '-')}</td>
      <td>${formatDateTime(session.created_at)}</td>
      <td>
        <span class="status-badge ${session.is_closed ? 'status-inactive' : 'status-active'}">
          ${session.is_closed ? 'Closed' : 'Active'}
        </span>
      </td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewQR(${session.session_id})">View QR</button>
      </td>
    </tr>
  `).join('');
}

function viewQR(sessionId) {
  window.open(`/website/qr.html?session_id=${sessionId}`, '_blank');
}

// Attendance
async function loadAttendance() {
  const tbody = document.getElementById('attendance-table');
  const emptyState = document.getElementById('attendance-empty');
  const tableContainer = tbody.closest('.table-container');
  const paginationContainer = document.querySelector('.pagination-controls');
  
  tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="loading"></div></td></tr>';
  emptyState.style.display = 'none';

  // Build query params
  const params = new URLSearchParams({
    page: attendancePage,
    limit: attendanceLimit,
    ...attendanceFilters
  });

  const data = await apiCall(`/admin/attendance?${params}`);
  if (!data) return;

  const records = data.data || [];

  if (records.length === 0) {
    tableContainer.style.display = 'none';
    emptyState.style.display = 'flex';
    if (paginationContainer) paginationContainer.style.display = 'none';
    return;
  }

  tableContainer.style.display = 'block';
  emptyState.style.display = 'none';
  if (paginationContainer) paginationContainer.style.display = 'flex';

  updatePagination(data.pagination);
  document.getElementById('attendance-count').textContent = `${data.pagination.total} records`;

  tbody.innerHTML = records.map(record => `
    <tr>
      <td>${escapeHtml(record.student_name || '-')}</td>
      <td>${escapeHtml(record.roll_number || '-')}</td>
      <td><strong>${record.session_id}</strong></td>
      <td>${formatDateTime(record.scan_time)}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteAttendance('${record.row_id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function updatePagination(pagination) {
  document.getElementById('page-info').textContent = `Page ${pagination.page} of ${pagination.total_pages}`;
  document.getElementById('prev-page').disabled = pagination.page === 1;
  document.getElementById('next-page').disabled = pagination.page >= pagination.total_pages;
}

function changedPage(delta) {
  attendancePage += delta;
  if (attendancePage < 1) attendancePage = 1;
  loadAttendance();
}

function changePage(delta) {
  changedPage(delta);
}

function applyFilters() {
  attendancePage = 1;
  attendanceFilters = {};

  const lecturerId = document.getElementById('filter-lecturer').value;
  const sessionId = document.getElementById('filter-session').value;
  const date = document.getElementById('filter-date').value;
  const roll = document.getElementById('filter-roll').value;
  const name = document.getElementById('filter-name').value;

  if (lecturerId) attendanceFilters.lecturer_id = lecturerId;
  if (sessionId) attendanceFilters.session_id = sessionId;
  if (date) attendanceFilters.date = date;
  if (roll) attendanceFilters.roll_number = roll;
  if (name) attendanceFilters.student_name = name;

  loadAttendance();
}

async function deleteAttendance(id) {
  if (!confirm('Delete this attendance record?')) return;

  const result = await apiCall(`/admin/attendance/${id}`, {
    method: 'DELETE'
  });

  if (result) {
    showToast('Record deleted successfully', 'success');
    loadAttendance();
  }
}

// Audit Logs
async function loadAuditLogs() {
  const tbody = document.getElementById('audit-table');
  const emptyState = document.getElementById('audit-empty');
  const tableContainer = tbody.closest('.table-container');
  
  tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="loading"></div></td></tr>';
  emptyState.style.display = 'none';

  const data = await apiCall('/admin/audit-logs');
  if (!data) return;

  const logs = data.data || [];

  if (logs.length === 0) {
    tableContainer.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  tableContainer.style.display = 'block';
  emptyState.style.display = 'none';

  tbody.innerHTML = logs.map((log, idx) => `
    <tr>
      <td>${formatAction(log.action)}</td>
      <td>${escapeHtml(log.actor_name || 'System')}</td>
      <td>${log.target_type}</td>
      <td>${formatDateTime(log.created_at)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="toggleAuditDetails('audit-${idx}')">Details</button>
      </td>
    </tr>
    <tr class="audit-row" id="audit-${idx}" style="display: none;">
      <td colspan="5">
        <div class="audit-details" id="audit-details-${idx}">
${JSON.stringify(log.details || {}, null, 2)}
        </div>
      </td>
    </tr>
  `).join('');
}

function toggleAuditDetails(id) {
  const row = document.getElementById(id);
  row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}

// Modal
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

// Toast
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Logout
function logout() {
  console.log('[ADMIN] 🔐 Logout initiated - clearing all auth state');
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  currentUser = null;
  console.log('[ADMIN] ✅ Auth state cleared from localStorage');
  showLogin();
}

// Utilities
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return dateString;
  }
}

function formatAction(action) {
  return action
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}
