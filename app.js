/* =============================================
   TrainerHub — app.js
   Spring Boot JWT API Client
   ============================================= */

const API_BASE = 'http://localhost:8080';

// ---- State ----
let jwtToken = null;
let allTrainers = [];
let currentDeleteId = null;
let currentDeleteName = '';

// =============================================
// UTILITIES
// =============================================

function $(id) { return document.getElementById(id); }

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = $(pageId);
  if (target) target.classList.add('active');
}

function showSection(sectionId) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const section = $('section-' + sectionId);
  const navItem = $('nav-' + sectionId);
  if (section) section.classList.add('active');
  if (navItem) navItem.classList.add('active');

  const titles = {
    trainers: 'All Trainers',
    add: 'Add New Trainer',
    lookup: 'Lookup by ID'
  };
  $('topbar-title').textContent = titles[sectionId] || '';

  // Close sidebar on mobile
  $('sidebar').classList.remove('open');
}

function showAlert(elId, msg, type = 'error') {
  const el = $(elId);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.style.display = 'block';
}

function hideAlert(elId) {
  const el = $(elId);
  if (el) el.style.display = 'none';
}

function setLoading(btnId, loading) {
  const btn = $(btnId);
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (text) text.style.display = loading ? 'none' : '';
  if (loader) loader.style.display = loading ? '' : 'none';
}

function toast(message, type = 'info') {
  const container = $('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span class="toast-dot"></span>${message}`;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add('toast-out');
    t.addEventListener('animationend', () => t.remove());
  }, 3500);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return dateStr; }
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  };
}

// =============================================
// AUTH: LOGIN
// =============================================

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert('login-error');

  const email = $('login-email').value.trim();
  const password = $('login-password').value;

  if (!email || !password) {
    showAlert('login-error', 'Please fill in all fields.');
    return;
  }

  setLoading('login-btn', true);

  try {
    const res = await fetch(`${API_BASE}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert('login-error', data.message || 'Invalid credentials. Please try again.');
      return;
    }

    jwtToken = data.token;
    localStorage.setItem('jwt_token', jwtToken);
    localStorage.setItem('user_email', email);

    // Update UI with user info
    const username = email.split('@')[0];
    $('sidebar-username').textContent = username;
    $('user-avatar-initial').textContent = username.charAt(0).toUpperCase();

    toast('Login successful! Welcome back.', 'success');
    showPage('page-dashboard');
    loadTrainers();

  } catch (err) {
    showAlert('login-error', 'Cannot connect to server. Make sure the backend is running on port 8080.');
  } finally {
    setLoading('login-btn', false);
  }
});

// Password toggle
$('toggle-password').addEventListener('click', () => {
  const input = $('login-password');
  const eyeOpen = $('eye-open');
  const eyeClosed = $('eye-closed');
  if (input.type === 'password') {
    input.type = 'text';
    eyeOpen.style.display = 'none';
    eyeClosed.style.display = '';
  } else {
    input.type = 'password';
    eyeOpen.style.display = '';
    eyeClosed.style.display = 'none';
  }
});

// =============================================
// AUTH: REGISTER
// =============================================

$('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert('register-error');
  hideAlert('register-success');

  const name = $('reg-name').value.trim();
  const email = $('reg-email').value.trim();
  const password = $('reg-password').value;
  const role = $('reg-role').value;

  if (!name || !email || !password) {
    showAlert('register-error', 'Please fill in all required fields.');
    return;
  }
  if (password.length < 6) {
    showAlert('register-error', 'Password must be at least 6 characters.');
    return;
  }

  setLoading('register-btn', true);

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });

    if (res.ok) {
      showAlert('register-success', 'Account created successfully! You can now login.', 'success');
      $('register-form').reset();
      toast('Registration successful!', 'success');
      setTimeout(() => showPage('page-login'), 2000);
    } else {
      const data = await res.json().catch(() => ({}));
      showAlert('register-error', data.message || 'Registration failed. Email may already be in use.');
    }

  } catch (err) {
    showAlert('register-error', 'Cannot connect to server. Make sure the backend is running.');
  } finally {
    setLoading('register-btn', false);
  }
});

// =============================================
// PAGE NAVIGATION (Login <-> Register)
// =============================================

$('go-register').addEventListener('click', (e) => {
  e.preventDefault();
  showPage('page-register');
});

$('go-login').addEventListener('click', (e) => {
  e.preventDefault();
  showPage('page-login');
});

// =============================================
// SIDEBAR & MOBILE
// =============================================

$('hamburger').addEventListener('click', () => {
  $('sidebar').classList.toggle('open');
});

$('sidebar-close').addEventListener('click', () => {
  $('sidebar').classList.remove('open');
});

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    showSection(item.dataset.section);
  });
});

// =============================================
// LOGOUT
// =============================================

$('btn-logout').addEventListener('click', () => {
  jwtToken = null;
  allTrainers = [];
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user_email');
  $('login-form').reset();
  $('login-email').value = '';
  $('login-password').value = '';
  showPage('page-login');
  toast('Logged out successfully.', 'info');
});

// =============================================
// TRAINERS — LOAD ALL (Admin only endpoint)
// =============================================

async function loadTrainers() {
  $('trainers-loading').style.display = 'flex';
  $('trainers-table-wrapper').style.display = 'none';
  $('trainers-empty').style.display = 'none';
  hideAlert('trainers-alert');

  try {
    const res = await fetch(`${API_BASE}/admin/fetchAllTrainers`, {
      headers: authHeaders()
    });

    if (res.status === 403 || res.status === 401) {
      showAlert('trainers-alert', 'Access denied. Only ADMIN users can view all trainers. Please login with an ADMIN account.', 'error');
      $('trainers-loading').style.display = 'none';
      $('stat-total').textContent = '—';
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    allTrainers = await res.json();
    $('stat-total').textContent = allTrainers.length;
    renderTrainers(allTrainers);

  } catch (err) {
    showAlert('trainers-alert', 'Failed to load trainers. Check your connection and ensure the server is running.', 'error');
    $('stat-total').textContent = '—';
  } finally {
    $('trainers-loading').style.display = 'none';
  }
}

function renderTrainers(trainers) {
  const tbody = $('trainers-tbody');
  tbody.innerHTML = '';

  if (!trainers || trainers.length === 0) {
    $('trainers-table-wrapper').style.display = 'none';
    $('trainers-empty').style.display = 'flex';
    return;
  }

  $('trainers-empty').style.display = 'none';
  $('trainers-table-wrapper').style.display = 'block';

  trainers.forEach((t, i) => {
    const row = document.createElement('tr');
    row.style.animationDelay = `${i * 30}ms`;
    row.innerHTML = `
      <td><span class="trainer-id">#${t.id}</span></td>
      <td><strong>${escapeHtml(t.name || '—')}</strong></td>
      <td><span class="trainer-email">${escapeHtml(t.email || '—')}</span></td>
      <td><span class="trainer-date">${formatDate(t.createdAt)}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn-icon btn-edit" onclick="openEditModal(${t.id}, '${escapeAttr(t.name)}', '${escapeAttr(t.email)}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button class="btn-icon btn-delete" onclick="openDeleteModal(${t.id}, '${escapeAttr(t.name)}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
            Delete
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Live search filter
$('search-input').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) { renderTrainers(allTrainers); return; }
  const filtered = allTrainers.filter(t =>
    (t.name || '').toLowerCase().includes(q) ||
    (t.email || '').toLowerCase().includes(q)
  );
  renderTrainers(filtered);
});

$('btn-refresh-trainers').addEventListener('click', loadTrainers);

// =============================================
// ADD TRAINER
// =============================================

$('add-trainer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert('add-alert');

  const name = $('add-name').value.trim();
  const email = $('add-email').value.trim();

  if (!name || !email) {
    showAlert('add-alert', 'Please fill in all fields.');
    return;
  }

  setLoading('add-trainer-btn', true);

  try {
    const res = await fetch(`${API_BASE}/addTrainer`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, email })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showAlert('add-alert', data.message || `Error: ${res.status} — Could not add trainer.`);
      return;
    }

    const newTrainer = await res.json();
    $('add-trainer-form').reset();
    toast(`Trainer "${newTrainer.name}" added successfully!`, 'success');
    loadTrainers();
    setTimeout(() => showSection('trainers'), 800);

  } catch (err) {
    showAlert('add-alert', 'Connection error. Please ensure the backend is running.');
  } finally {
    setLoading('add-trainer-btn', false);
  }
});

// =============================================
// LOOKUP TRAINER BY ID
// =============================================

$('btn-lookup').addEventListener('click', lookupTrainer);

$('lookup-id').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') lookupTrainer();
});

async function lookupTrainer() {
  const id = $('lookup-id').value.trim();
  if (!id || isNaN(id) || Number(id) < 1) {
    showAlert('lookup-alert', 'Please enter a valid trainer ID (positive number).');
    return;
  }
  hideAlert('lookup-alert');
  $('lookup-result').style.display = 'none';
  setLoading('btn-lookup', true);

  try {
    const res = await fetch(`${API_BASE}/trainer/${id}`, {
      headers: authHeaders()
    });

    if (res.status === 404) {
      showAlert('lookup-alert', `No trainer found with ID ${id}.`);
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const t = await res.json();
    $('profile-name').textContent = t.name || '—';
    $('profile-email').textContent = t.email || '—';
    $('profile-id').textContent = `#${t.id}`;
    $('profile-created').textContent = formatDate(t.createdAt);
    $('profile-avatar').textContent = (t.name || '?').charAt(0).toUpperCase();

    // Wire edit/delete buttons
    $('profile-edit-btn').onclick = () => openEditModal(t.id, t.name, t.email);
    $('profile-delete-btn').onclick = () => openDeleteModal(t.id, t.name);

    $('lookup-result').style.display = 'block';
    toast(`Trainer found: ${t.name}`, 'info');

  } catch (err) {
    showAlert('lookup-alert', 'Failed to fetch trainer. Please check the ID and try again.');
  } finally {
    setLoading('btn-lookup', false);
  }
}

// =============================================
// EDIT TRAINER MODAL
// =============================================

function openEditModal(id, name, email) {
  $('edit-id').value = id;
  $('edit-name').value = name || '';
  $('edit-email').value = email || '';
  hideAlert('edit-alert');
  $('edit-modal').style.display = 'flex';
  setTimeout(() => $('edit-name').focus(), 100);
}

function closeEditModal() {
  $('edit-modal').style.display = 'none';
}

$('modal-close').addEventListener('click', closeEditModal);
$('modal-cancel').addEventListener('click', closeEditModal);
$('edit-modal').addEventListener('click', (e) => {
  if (e.target === $('edit-modal')) closeEditModal();
});

$('edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert('edit-alert');

  const id = $('edit-id').value;
  const name = $('edit-name').value.trim();
  const email = $('edit-email').value.trim();

  if (!name || !email) {
    showAlert('edit-alert', 'Please fill in all fields.');
    return;
  }

  setLoading('edit-save-btn', true);

  try {
    const res = await fetch(`${API_BASE}/update/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ name, email })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showAlert('edit-alert', data.message || `Update failed (${res.status}).`);
      return;
    }

    closeEditModal();
    toast(`Trainer updated successfully!`, 'success');
    loadTrainers();

    // Refresh lookup if showing
    const lookupId = $('lookup-id').value;
    if (lookupId && lookupId == id) lookupTrainer();

  } catch (err) {
    showAlert('edit-alert', 'Connection error during update.');
  } finally {
    setLoading('edit-save-btn', false);
  }
});

// =============================================
// DELETE TRAINER MODAL
// =============================================

function openDeleteModal(id, name) {
  currentDeleteId = id;
  currentDeleteName = name;
  $('delete-name-display').textContent = `"${name}"`;
  $('delete-modal').style.display = 'flex';
}

function closeDeleteModal() {
  $('delete-modal').style.display = 'none';
  currentDeleteId = null;
  currentDeleteName = '';
}

$('delete-cancel').addEventListener('click', closeDeleteModal);
$('delete-modal').addEventListener('click', (e) => {
  if (e.target === $('delete-modal')) closeDeleteModal();
});

$('delete-confirm-btn').addEventListener('click', async () => {
  if (!currentDeleteId) return;
  setLoading('delete-confirm-btn', true);

  try {
    const res = await fetch(`${API_BASE}/deleteTrainer/${currentDeleteId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (!res.ok && res.status !== 200) {
      toast(`Delete failed (${res.status}).`, 'error');
      return;
    }

    const msg = currentDeleteName;
    closeDeleteModal();
    toast(`Trainer "${msg}" deleted successfully.`, 'success');
    $('lookup-result').style.display = 'none';
    $('lookup-id').value = '';
    loadTrainers();

  } catch (err) {
    toast('Connection error during delete.', 'error');
  } finally {
    setLoading('delete-confirm-btn', false);
  }
});

// =============================================
// KEYBOARD SHORTCUTS
// =============================================

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeEditModal();
    closeDeleteModal();
  }
});

// =============================================
// SECURITY HELPERS
// =============================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// =============================================
// INIT — Check for existing session
// =============================================

(function init() {
  const saved = localStorage.getItem('jwt_token');
  const savedEmail = localStorage.getItem('user_email');

  if (saved) {
    jwtToken = saved;
    const username = savedEmail ? savedEmail.split('@')[0] : 'User';
    $('sidebar-username').textContent = username;
    $('user-avatar-initial').textContent = username.charAt(0).toUpperCase();
    showPage('page-dashboard');
    loadTrainers();
  } else {
    showPage('page-login');
  }
})();
