/* =============================================
   dashboard.js — TrainerHub API client
   Maps every tab to an exact backend endpoint
   ============================================= */

const API = 'http://localhost:8080';

// ---- Helpers ----

function getToken() {
  return localStorage.getItem('jwt_token');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + getToken()
  };
}

function $(id) { return document.getElementById(id); }

function toast(msg, type = 'info') {
  const c = $('toast-container');
  const t = document.createElement('div');
  t.className = `toast t-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.classList.add('t-out');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }, 3000);
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-IN', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return d; }
}

function showRes(statusEl, bodyEl, statusCode, statusText, data, ok) {
  statusEl.textContent = `${statusCode} ${statusText}`;
  statusEl.className = 'res-status ' + (ok ? 'ok' : 'fail');
  bodyEl.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

function setBtn(id, loading) {
  const btn = $(id);
  if (!btn) return;
  const lbl = btn.querySelector('.btn-label');
  const sp = btn.querySelector('.spinner');
  btn.disabled = loading;
  if (lbl) lbl.style.display = loading ? 'none' : '';
  if (sp)  sp.style.display  = loading ? 'block' : 'none';
}

function showAlert(id, msg, type = 'error') {
  const el = $(id);
  el.textContent = msg;
  el.className = 'alert ' + type;
  el.style.display = 'block';
}
function hideAlert(id) { const el=$(id); if(el) el.style.display='none'; }

function safeHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ---- Guard: redirect if no token ----
(function guard() {
  const token = getToken();
  if (!token) { window.location.href = 'login.html'; return; }

  // Show token in topbar (abbreviated)
  const abbrev = token.length > 30 ? token.substring(0, 30) + '…' : token;
  $('token-text').textContent = 'Token: ' + abbrev;

  // Copy token on click
  $('token-preview').addEventListener('click', () => {
    navigator.clipboard.writeText(token).then(() => toast('JWT token copied!', 'info'));
  });

  // Show user info
  const email = localStorage.getItem('user_email') || '';
  $('user-email-display').textContent = email || 'Unknown';
  $('user-av').textContent = (email.charAt(0) || 'U').toUpperCase();
})();

// =============================================
// SIDEBAR NAVIGATION
// =============================================

document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(item.dataset.tab);
    $('sidebar').classList.remove('open');
  });
});

function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-tab]').forEach(n => n.classList.remove('active'));
  $('tab-' + tabId).classList.add('active');
  const navEl = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (navEl) navEl.classList.add('active');

  const titles = {
    'all':    'GET /admin/fetchAllTrainers',
    'add':    'POST /addTrainer',
    'get-id': 'GET /trainer/{id}',
    'update': 'PUT /update/{id}',
    'delete': 'DELETE /deleteTrainer/{id}'
  };
  $('topbar-title').textContent = titles[tabId] || '';
}

// Mobile sidebar
$('hamburger').addEventListener('click', () => $('sidebar').classList.toggle('open'));
$('sb-close').addEventListener('click', () => $('sidebar').classList.remove('open'));

// Logout
$('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user_email');
  window.location.href = 'login.html';
});

// =============================================
// TAB: GET ALL TRAINERS
// GET /admin/fetchAllTrainers
// Requires: ADMIN role
// =============================================

let allTrainers = [];

$('btn-fetch-all').addEventListener('click', fetchAllTrainers);

async function fetchAllTrainers() {
  hideAlert('all-alert');
  $('all-loading').style.display = 'flex';
  $('all-table-wrap').style.display = 'none';
  $('all-res').style.display = 'none';
  $('all-stats').style.display = 'none';
  $('all-search').style.display = 'none';

  try {
    const res = await fetch(`${API}/admin/fetchAllTrainers`, {
      method: 'GET',
      headers: authHeaders()
    });

    const data = await res.json();

    // Show raw JSON
    $('all-res').style.display = 'block';
    showRes($('all-res-status'), $('all-res-body'), res.status, res.statusText, data, res.ok);

    if (res.status === 401 || res.status === 403) {
      showAlert('all-alert', `${res.status} Forbidden — You need ADMIN role. Current token may not have ADMIN authority.`, 'error');
      return;
    }
    if (!res.ok) {
      showAlert('all-alert', `Error ${res.status}: ${JSON.stringify(data)}`, 'error');
      return;
    }

    allTrainers = Array.isArray(data) ? data : [];
    $('stat-count').textContent = allTrainers.length;
    $('all-stats').style.display = 'flex';
    $('all-search').style.display = 'flex';
    renderTable(allTrainers);
    toast(`Fetched ${allTrainers.length} trainer(s)`, 'success');

  } catch (err) {
    showAlert('all-alert', 'Network error — is Spring Boot running on port 8080? Check CORS config.', 'error');
    $('all-res').style.display = 'block';
    $('all-res-status').textContent = 'Network Error';
    $('all-res-status').className = 'res-status fail';
    $('all-res-body').textContent = err.message;
  } finally {
    $('all-loading').style.display = 'none';
  }
}

function renderTable(trainers) {
  const tbody = $('trainers-body');
  tbody.innerHTML = '';

  if (!trainers.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#484f58;padding:28px;">No trainers found</td></tr>`;
    $('all-table-wrap').style.display = 'block';
    return;
  }

  trainers.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="td-id">#${safeHtml(t.id)}</span></td>
      <td><strong>${safeHtml(t.name || '—')}</strong></td>
      <td><span class="td-email">${safeHtml(t.email || '—')}</span></td>
      <td><span class="td-date">${fmtDate(t.createdAt)}</span></td>
      <td>
        <button class="qa-btn qa-edit" onclick="quickEdit(${t.id},'${escAttr(t.name)}','${escAttr(t.email)}')">✏ Edit</button>
        <button class="qa-btn qa-del"  onclick="quickDelete(${t.id})">🗑 Del</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  $('all-table-wrap').style.display = 'block';
}

// Live filter
$('search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = allTrainers.filter(t =>
    (t.name || '').toLowerCase().includes(q) ||
    (t.email || '').toLowerCase().includes(q)
  );
  renderTable(filtered);
});

// Quick-fill the update tab from table
function quickEdit(id, name, email) {
  $('update-id').value = id;
  $('update-name').value = name;
  $('update-email').value = email;
  updateUpdatePreview();
  switchTab('update');
}
// Quick-fill delete tab from table
function quickDelete(id) {
  $('del-id').value = id;
  updateDelPreview();
  switchTab('delete');
}

function escAttr(s) {
  return String(s || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// Auto-load on page start
fetchAllTrainers();

// =============================================
// TAB: ADD TRAINER
// POST /addTrainer
// Body: { name, email }
// =============================================

// Live preview
$('add-name').addEventListener('input', updateAddPreview);
$('add-email').addEventListener('input', updateAddPreview);
function updateAddPreview() {
  const n = $('add-name').value || '...';
  const e = $('add-email').value || '...';
  $('add-preview').querySelector('.req-body').textContent =
    `{ "name": "${n}", "email": "${e}" }`;
}

$('add-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  hideAlert('add-alert');
  $('add-res').style.display = 'none';

  const name  = $('add-name').value.trim();
  const email = $('add-email').value.trim();

  if (!name || !email) { showAlert('add-alert', 'name and email are required.', 'error'); return; }

  setBtn('add-btn', true);

  try {
    const res = await fetch(`${API}/addTrainer`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, email })
    });

    const data = await res.json();
    $('add-res').style.display = 'block';
    showRes($('add-res-status'), $('add-res-body'), res.status, res.statusText, data, res.ok);

    if (res.ok) {
      toast(`Trainer "${data.name}" added (ID: ${data.id})`, 'success');
      $('add-form').reset();
      updateAddPreview();
      fetchAllTrainers(); // refresh list
    } else {
      showAlert('add-alert', data.message || `Error ${res.status}`, 'error');
    }
  } catch (err) {
    showAlert('add-alert', 'Network error — ' + err.message, 'error');
  } finally {
    setBtn('add-btn', false);
  }
});

// =============================================
// TAB: GET TRAINER BY ID
// GET /trainer/{id}
// =============================================

$('getid-id').addEventListener('input', () => {
  const v = $('getid-id').value || '{id}';
  $('getid-url-preview').textContent = v;
});

$('getid-btn').addEventListener('click', getById);

async function getById() {
  const id = $('getid-id').value.trim();
  hideAlert('getid-alert');
  $('getid-result-wrap').style.display = 'none';

  if (!id || isNaN(id)) { showAlert('getid-alert', 'Enter a valid numeric ID.', 'error'); return; }

  setBtn('getid-btn', true);

  try {
    const res = await fetch(`${API}/trainer/${id}`, {
      method: 'GET',
      headers: authHeaders()
    });

    if (res.status === 404) {
      showAlert('getid-alert', `No trainer found with ID ${id}.`, 'error');
      return;
    }

    const data = await res.json();
    $('getid-result-wrap').style.display = 'block';

    if (res.ok) {
      // Fill profile card
      $('getid-avatar').textContent = (data.name || '?').charAt(0).toUpperCase();
      $('getid-name').textContent = data.name || '—';
      $('getid-email').textContent = data.email || '—';
      $('getid-id-show').textContent = '#' + data.id;
      $('getid-created').textContent = fmtDate(data.createdAt);
      toast(`Found: ${data.name}`, 'success');
    }

    showRes($('getid-res-status'), $('getid-res-body'), res.status, res.statusText, data, res.ok);

  } catch (err) {
    showAlert('getid-alert', 'Network error — ' + err.message, 'error');
  } finally {
    setBtn('getid-btn', false);
  }
}

// =============================================
// TAB: UPDATE TRAINER
// PUT /update/{id}
// Body: { name, email }
// Returns: String message
// =============================================

['update-id','update-name','update-email'].forEach(id =>
  $(id).addEventListener('input', updateUpdatePreview)
);
function updateUpdatePreview() {
  const id = $('update-id').value || '{id}';
  const n  = $('update-name').value || '...';
  const e  = $('update-email').value || '...';
  $('update-url-preview').textContent = id;
  $('update-body-preview').textContent = `{ "name": "${n}", "email": "${e}" }`;
}

$('update-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  hideAlert('update-alert');
  $('update-res').style.display = 'none';

  const id    = $('update-id').value.trim();
  const name  = $('update-name').value.trim();
  const email = $('update-email').value.trim();

  if (!id || !name || !email) { showAlert('update-alert', 'All fields are required.', 'error'); return; }

  setBtn('update-btn', true);

  try {
    const res = await fetch(`${API}/update/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ name, email })
    });

    // This endpoint returns a plain String, not JSON
    const text = await res.text();
    $('update-res').style.display = 'block';
    showRes($('update-res-status'), $('update-res-body'), res.status, res.statusText, text, res.ok);

    if (res.ok) {
      toast(text || 'Trainer updated!', 'success');
      fetchAllTrainers(); // refresh list
    } else {
      showAlert('update-alert', `Error ${res.status}: ${text}`, 'error');
    }
  } catch (err) {
    showAlert('update-alert', 'Network error — ' + err.message, 'error');
  } finally {
    setBtn('update-btn', false);
  }
});

// =============================================
// TAB: DELETE TRAINER
// DELETE /deleteTrainer/{id}
// Returns: String message
// =============================================

$('del-id').addEventListener('input', updateDelPreview);
function updateDelPreview() {
  const v = $('del-id').value || '{id}';
  $('del-url-preview').textContent = v;
}

$('del-btn').addEventListener('click', async () => {
  const id = $('del-id').value.trim();
  hideAlert('del-alert');
  $('del-res').style.display = 'none';

  if (!id || isNaN(id)) { showAlert('del-alert', 'Enter a valid numeric ID.', 'error'); return; }

  setBtn('del-btn', true);

  try {
    const res = await fetch(`${API}/deleteTrainer/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    // Returns plain String
    const text = await res.text();
    $('del-res').style.display = 'block';
    showRes($('del-res-status'), $('del-res-body'), res.status, res.statusText, text, res.ok);

    if (res.ok) {
      toast(text || `Trainer #${id} deleted`, 'success');
      $('del-id').value = '';
      updateDelPreview();
      fetchAllTrainers(); // refresh list
    } else {
      showAlert('del-alert', `Error ${res.status}: ${text}`, 'error');
    }
  } catch (err) {
    showAlert('del-alert', 'Network error — ' + err.message, 'error');
  } finally {
    setBtn('del-btn', false);
  }
});
