/* ── Clock ── */
function updateClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}
updateClock();
setInterval(updateClock, 1000);

/* ── Toast ── */
function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = isError ? '#DC2626' : '#1B2A4A';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

/* ── Status change ── */
document.querySelectorAll('.status-select').forEach(sel => {
  sel.addEventListener('change', async function () {
    const id = this.dataset.id;
    const status = this.value;

    // update visual class immediately
    this.className = 'status-select status-' + status;

    // update row attribute for filter
    this.closest('tr').dataset.status = status;

    try {
      const res = await fetch(`/leads/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Server error');
      showToast('Status updated');
    } catch (e) {
      showToast('Failed to save', true);
    }
  });
});

/* ── Inline date / nights save (debounced) ── */
let saveTimer = {};

document.querySelectorAll('.inline-input').forEach(input => {
  input.addEventListener('change', function () {
    const row = this.closest('tr');
    const id = row.dataset.id;
    clearTimeout(saveTimer[id]);
    saveTimer[id] = setTimeout(() => saveRowDetails(id, row), 600);
  });
});

async function saveRowDetails(id, row) {
  const checkin = row.querySelector('.checkin-input')?.value || '';
  const nights  = row.querySelector('.nights-input')?.value  || '';

  try {
    const res = await fetch(`/leads/${id}/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkin_date: checkin, nights }),
    });
    if (!res.ok) throw new Error();
    showToast('Saved');
  } catch {
    showToast('Failed to save', true);
  }
}

/* ── Table Filters ── */
const filterChannel = document.getElementById('filterChannel');
const filterStatus  = document.getElementById('filterStatus');
const filterSearch  = document.getElementById('filterSearch');
const tableBody     = document.querySelector('#leadsTable tbody');

function applyFilters() {
  const ch  = filterChannel.value.toLowerCase();
  const st  = filterStatus.value.toLowerCase();
  const q   = filterSearch.value.toLowerCase();

  tableBody.querySelectorAll('tr[data-id]').forEach(row => {
    const rowCh  = (row.dataset.channel  || '').toLowerCase();
    const rowSt  = (row.dataset.status   || '').toLowerCase();
    const rowTxt = row.textContent.toLowerCase();

    const matchCh = !ch || rowCh === ch;
    const matchSt = !st || rowSt === st;
    const matchQ  = !q  || rowTxt.includes(q);

    row.style.display = matchCh && matchSt && matchQ ? '' : 'none';
  });
}

filterChannel.addEventListener('change', applyFilters);
filterStatus.addEventListener('change',  applyFilters);
filterSearch.addEventListener('input',   applyFilters);

/* ── Auto-refresh every 60 s ── */
setTimeout(() => location.reload(), 60_000);

/* ── Edit Modal ── */
const editOverlay     = document.getElementById('editModalOverlay');
const editModalClose  = document.getElementById('editModalClose');
const editModalCancel = document.getElementById('editModalCancel');
const editLeadForm    = document.getElementById('editLeadForm');
const editModalSubmit = document.getElementById('editModalSubmit');

function openEditModal(btn) {
  document.getElementById('el-id').value          = btn.dataset.id;
  document.getElementById('el-name').value        = btn.dataset.name;
  document.getElementById('el-phone').value       = btn.dataset.phone;
  document.getElementById('el-channel').value     = btn.dataset.channel;
  document.getElementById('el-agent').value       = btn.dataset.agent;
  document.getElementById('el-package').value     = btn.dataset.package;
  document.getElementById('el-checkin').value     = btn.dataset.checkin;
  document.getElementById('el-nights').value      = btn.dataset.nights;
  document.getElementById('el-message').value     = btn.dataset.message;
  editLeadForm.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  editOverlay.hidden = false;
  document.getElementById('el-name').focus();
}

function closeEditModal() { editOverlay.hidden = true; }

editModalClose.addEventListener('click', closeEditModal);
editModalCancel.addEventListener('click', closeEditModal);
editOverlay.addEventListener('click', e => { if (e.target === editOverlay) closeEditModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !editOverlay.hidden) closeEditModal(); });

document.querySelectorAll('.btn-edit').forEach(btn => {
  btn.addEventListener('click', () => openEditModal(btn));
});

editLeadForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  const id = document.getElementById('el-id').value;

  let valid = true;
  ['el-name', 'el-channel', 'el-agent'].forEach(elId => {
    const el = document.getElementById(elId);
    if (!el.value.trim()) { el.classList.add('error'); valid = false; }
    else el.classList.remove('error');
  });
  if (!valid) { showToast('Please fill in required fields', true); return; }

  editModalSubmit.disabled = true;
  editModalSubmit.textContent = 'Saving…';

  const data = Object.fromEntries(new FormData(editLeadForm).entries());

  try {
    const res = await fetch(`/leads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Server error');
    closeEditModal();
    showToast('Lead updated — refreshing…');
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    showToast(err.message, true);
    editModalSubmit.disabled = false;
    editModalSubmit.textContent = 'Save Changes';
  }
});

/* ── Delete ── */
document.querySelectorAll('.btn-delete').forEach(btn => {
  btn.addEventListener('click', async () => {
    const id   = btn.dataset.id;
    const name = btn.dataset.name;
    if (!confirm(`ลบ lead "${name}" ใช่ไหม?`)) return;

    try {
      const res = await fetch(`/leads/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Server error');
      showToast('ลบแล้ว — refreshing…');
      setTimeout(() => location.reload(), 700);
    } catch (err) {
      showToast(err.message, true);
    }
  });
});

/* ── Add Lead Modal ── */
const overlay      = document.getElementById('modalOverlay');
const addLeadBtn   = document.getElementById('addLeadBtn');
const modalClose   = document.getElementById('modalClose');
const modalCancel  = document.getElementById('modalCancel');
const addLeadForm  = document.getElementById('addLeadForm');
const modalSubmit  = document.getElementById('modalSubmit');

function openModal() {
  addLeadForm.reset();
  addLeadForm.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  overlay.hidden = false;
  document.getElementById('fl-name').focus();
}

function closeModal() {
  overlay.hidden = true;
}

addLeadBtn.addEventListener('click', openModal);
modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });

addLeadForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  // Client-side validation
  let valid = true;
  ['fl-name', 'fl-channel', 'fl-agent'].forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) { el.classList.add('error'); valid = false; }
    else el.classList.remove('error');
  });
  if (!valid) { showToast('Please fill in required fields', true); return; }

  modalSubmit.disabled = true;
  modalSubmit.textContent = 'Saving…';

  const data = Object.fromEntries(new FormData(addLeadForm).entries());

  try {
    const res = await fetch('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Server error');

    closeModal();
    showToast('Lead saved — refreshing…');
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    showToast(err.message, true);
    modalSubmit.disabled = false;
    modalSubmit.textContent = 'Save Lead';
  }
});
