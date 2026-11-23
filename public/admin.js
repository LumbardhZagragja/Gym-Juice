const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let key = '';
try { key = sessionStorage.getItem('gj_admin') || ''; } catch { /* ignore */ }

async function call(action, extra = {}) {
  $('err').textContent = '';
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
    body: JSON.stringify({ action, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  draw(data.people);
}

function draw(people) {
  $('keyForm').hidden = true;
  $('panel').hidden = false;
  $('list').innerHTML = people.map((p) => `
    <div class="admin-row">
      <span class="name">${esc(p.name)} <span class="muted small">${p.hasPin ? '· PIN set' : '· no PIN yet'}</span></span>
      <button type="button" class="mini" data-a="rename" data-id="${esc(p.id)}" data-name="${esc(p.name)}">Rename</button>
      <button type="button" class="mini" data-a="resetPin" data-id="${esc(p.id)}" data-name="${esc(p.name)}">Reset PIN</button>
      <button type="button" class="mini danger" data-a="remove" data-id="${esc(p.id)}" data-name="${esc(p.name)}">Remove</button>
    </div>`).join('') || '<p class="muted">Nobody yet.</p>';
}

$('list').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-a]');
  if (!b) return;
  const { a, id, name } = b.dataset;
  try {
    if (a === 'rename') {
      const n = prompt(`New name for ${name}:`, name);
      if (n && n.trim()) await call('rename', { personId: id, name: n.trim() });
    } else if (a === 'resetPin') {
      if (confirm(`Reset ${name}'s PIN?`)) await call('resetPin', { personId: id });
    } else if (a === 'remove') {
      if (confirm(`Remove ${name} AND all their check-ins? This can't be undone.`)) await call('remove', { personId: id });
    }
  } catch (err) { $('err').textContent = err.message; }
});

$('keyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  key = $('key').value;
  try {
    await call('list');
    try { sessionStorage.setItem('gj_admin', key); } catch { /* ignore */ }
  } catch (err) { $('err').textContent = err.message; }
});

$('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await call('add', { name: $('newName').value.trim() });
    $('newName').value = '';
  } catch (err) { $('err').textContent = err.message; }
});

if (key) call('list').catch(() => { key = ''; });
