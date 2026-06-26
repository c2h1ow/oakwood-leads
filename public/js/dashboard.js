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
