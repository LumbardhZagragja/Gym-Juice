// Gym&Juice front end: a tiny hash-routed app (#home, #checkin, #board, #feed).

const view = document.getElementById('view');
const tabs = document.getElementById('tabs');
const logoutBtn = document.getElementById('logout');

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};

let token = store.get('gj_token');
let me = null;
try { me = JSON.parse(store.get('gj_me') || 'null'); } catch { me = null; }
let boardTab = 'week';
let renderId = 0;
let stream = null;
let facing = 'user';

/* ---------- helpers ---------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TINTS = ['#FF8FC8', '#8FD3FF', '#FFC98F', '#B8F28F', '#D9A8FF', '#FFE58F', '#8FFFE0', '#FFB3A8'];
function tint(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}
const avatar = (name) => `<span class="avatar" style="background:${tint(name)}">${esc(String(name)[0] || '?')}</span>`;
const medal = (rank) => `<span class="medal ${rank <= 3 ? 'm' + rank : ''}">${rank}</span>`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function ago(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

function dayLabel(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function monthName(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en', { month: 'long', timeZone: 'UTC' });
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

const ICON = {
  camera: (c = 'currentColor', s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13.5" r="3.8"/></svg>`,
  trophy: `<svg width="24" height="24" viewBox="0 0 24 24" fill="#FFB020" aria-hidden="true"><path d="M7 3h10v6a5 5 0 0 1-10 0z"/><path d="M11 14h2v4h-2zM8 19h8v2H8z"/></svg>`,
  chevron: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`,
  photos: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg>`,
  crown: `<svg width="44" height="36" viewBox="0 0 24 20" fill="none" stroke="#FF2E9A" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M2 17h20l-2-12-5 5-3-7-3 7-5-5z"/></svg>`,
  flip: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2"/><path d="M20 4v4h-4M4 20v-4h4"/></svg>`,
  sus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A0629" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#FFC21A"/><path d="M7 8l3 1M14 7.5l3-1.5"/><circle cx="9" cy="11" r="1" fill="#1A0629"/><circle cx="15" cy="10.5" r="1" fill="#1A0629"/><path d="M9 16h6"/></svg>`,
  heart: `<svg width="15" height="15" viewBox="0 0 24 24" fill="#FF2E5E" aria-hidden="true"><path d="M12 21l-8.5-8.6a5 5 0 0 1 7-7.1L12 6.8l1.5-1.5a5 5 0 0 1 7 7.1z"/></svg>`,
};

/* ---------- API ---------- */

async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401 && path !== 'login') {
    logout();
    throw new Error(data.error || 'Please log in again');
  }
  if (!res.ok) {
    const err = new Error(data.error || `Something went wrong (HTTP ${res.status})`);
    err.status = res.status;
    err.detail = data.detail || `${path} returned HTTP ${res.status}`;
    throw err;
  }
  return data;
}

function logout() {
  token = null;
  me = null;
  store.del('gj_token');
  store.del('gj_me');
  if (location.hash !== '#home') location.hash = '#home';
  else render();
}
logoutBtn.addEventListener('click', () => {
  if (confirm(`Log out${me ? ` ${me.name}` : ''}? You'll need your PIN to log back in.`)) logout();
});

/* ---------- router ---------- */

const pages = { home: homePage, checkin: checkinPage, board: boardPage, feed: feedPage };

async function render() {
  stopCamera();
  const id = ++renderId;
  const route = location.hash.slice(1) || 'home';
  const loggedIn = !!token;
  tabs.hidden = !loggedIn;
  logoutBtn.hidden = !loggedIn;
  for (const a of tabs.querySelectorAll('a')) {
    if (a.dataset.tab === route) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  view.innerHTML = '<div class="loading">Loading…</div>';
  try {
    if (!loggedIn) await loginPage(id);
    else await (pages[route] || homePage)(id);
  } catch (err) {
    if (id !== renderId) return;
    console.error(err);
    const detail = err.detail || `${err.name}: ${err.message}`;
    view.innerHTML = `<div class="empty"><p>${esc(err.message)}</p><p class="small" style="word-break:break-word">${esc(detail)}</p><button type="button" class="btn ghost" id="retry">Try again</button></div>`;
    document.getElementById('retry').onclick = render;
  }
}
window.addEventListener('hashchange', render);

/* ---------- login ---------- */

async function loginPage(id) {
  const { people } = await api('people');
  if (id !== renderId) return;
  let person = null;
  let pin = '';
  let firstPin = '';
  let error = '';
  let busy = false;

  const pick = () => {
    view.innerHTML = `
      <h1>Who <span class="accent">are you?</span></h1>
      <div class="people">
        ${people.map((p, i) => `<button type="button" class="person" data-i="${i}">${avatar(p.name)}<span>${esc(p.name)}</span></button>`).join('')}
      </div>
      ${people.length ? '' : '<p class="empty">No one is set up yet. Ask the admin to add you.</p>'}`;
    view.querySelectorAll('.person').forEach((b) => {
      b.onclick = () => { person = people[Number(b.dataset.i)]; pin = ''; firstPin = ''; error = ''; drawPin(); };
    });
  };

  const drawPin = () => {
    const isNew = !person.hasPin;
    const title = !isNew ? `Hey ${esc(person.name)}, <span class="accent">your PIN</span>`
      : firstPin ? `Repeat <span class="accent">your PIN</span>` : `${esc(person.name)}, <span class="accent">pick a PIN</span>`;
    const hint = isNew && !firstPin ? '<p class="muted center small">4 digits. You\'ll only need it once on this phone.</p>' : '';
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
    view.innerHTML = `
      <h1>${title}</h1>
      ${hint}
      <div class="dots" aria-label="${pin.length} of 4 digits">${[0, 1, 2, 3].map((i) => `<span class="dot ${i < pin.length ? 'on' : ''}"></span>`).join('')}</div>
      <p class="error" role="alert">${esc(error)}</p>
      <div class="keypad">
        ${keys.map((k) => k === '' ? '<span class="key blank"></span>'
          : `<button type="button" class="key" data-k="${k}" ${k === 'del' ? 'aria-label="Delete"' : ''}>${k === 'del' ? '⌫' : k}</button>`).join('')}
      </div>
      <button type="button" class="btn ghost" id="back">Not ${esc(person.name)}?</button>`;
    view.querySelectorAll('.key[data-k]').forEach((b) => { b.onclick = () => press(b.dataset.k); });
    document.getElementById('back').onclick = pick;
  };

  const press = async (k) => {
    if (busy) return;
    error = '';
    if (k === 'del') pin = pin.slice(0, -1);
    else if (pin.length < 4) pin += k;
    drawPin();
    if (pin.length < 4) return;

    if (!person.hasPin && !firstPin) { firstPin = pin; pin = ''; drawPin(); return; }
    if (!person.hasPin && pin !== firstPin) { error = "PINs didn't match. Pick again."; firstPin = ''; pin = ''; drawPin(); return; }

    busy = true;
    try {
      const res = await api('login', { method: 'POST', body: { personId: person.id, pin } });
      token = res.token;
      me = res.me;
      store.set('gj_token', token);
      store.set('gj_me', JSON.stringify(me));
      toast(res.created ? `PIN set. Welcome, ${me.name}!` : `Welcome back, ${me.name}!`);
      location.hash = '#home';
      render();
    } catch (err) {
      error = err.message;
      pin = '';
      if (err.status === 409) { person.hasPin = true; firstPin = ''; }
      drawPin();
    } finally {
      busy = false;
    }
  };

  pick();
}

/* ---------- home ---------- */

async function homePage(id) {
  const [b, f] = await Promise.all([api('leaderboard'), api('feed')]);
  if (id !== renderId) return;
  const w = b.lastMonthWinner;
  const top = b.month.rows.slice(0, 3);
  const recent = f.posts.slice(0, 2);
  const done = b.me.checkedInToday;

  view.innerHTML = `
    ${w ? `
      <div class="winner">
        ${ICON.trophy.replace('#FFB020', '#1A0629').replace('width="24" height="24"', 'width="38" height="38"')}
        <div class="grow">
          <div class="label">${esc(monthName(w.month))}'s winner · ${plural(w.days, 'day')}</div>
          <div class="name">${esc(w.name)}</div>
        </div>
        ${ICON.crown}
      </div>` : ''}

    <section class="card">
      <a class="section-link" href="#board">${ICON.trophy}<h2>This month</h2>${ICON.chevron}</a>
      ${top.map((r) => `
        <div class="mini-row">${medal(r.rank)}${avatar(r.name)}<span class="name">${esc(r.name)}</span>
          <span class="days">${r.days} <span>days</span></span></div>`).join('')}
    </section>

    <div class="big-wrap">
      ${done
        ? `<a class="big-btn done" href="#feed"><span class="h">Done</span><span class="sub">for today ✓</span></a>`
        : `<a class="big-btn" href="#checkin">${ICON.camera('#1A0629', 44)}<span class="h">Check-in</span><span class="sub">at the gym</span></a>`}
    </div>

    <section>
      <a class="section-link" href="#feed">${ICON.photos}<h2>Recent check-ins</h2>${ICON.chevron}</a>
      ${recent.length ? `<div class="thumbs">${recent.map((p) => `
        <a class="thumb" href="#feed">${p.photoUrl ? `<img src="${esc(p.photoUrl)}" alt="${esc(p.name)} at the gym" loading="lazy">` : ''}
          <span>${esc(p.name)} · ${esc(p.addedByAdmin ? dayLabel(p.day) : ago(p.createdAt))}</span></a>`).join('')}</div>`
        : '<p class="empty">No check-ins yet. Be the first!</p>'}
    </section>`;
}

/* ---------- leaderboard ---------- */

async function boardPage(id) {
  const b = await api('leaderboard');
  if (id !== renderId) return;

  const draw = () => {
    const period = b[boardTab];
    const mine = period.rows.find((r) => r.id === b.me.id);
    view.innerHTML = `
      <h1>Leaderboard</h1>
      <div class="pill-tabs" role="tablist">
        <button type="button" role="tab" data-t="week" aria-selected="${boardTab === 'week'}">This week</button>
        <button type="button" role="tab" data-t="month" aria-selected="${boardTab === 'month'}">This month</button>
      </div>
      <div class="stats">
        <div class="stat"><div class="label">You · this ${boardTab}</div><div class="value">${mine?.days ?? 0} <small>gym days</small></div></div>
        <div class="stat"><div class="label">Your rank</div><div class="value">${mine ? ordinal(mine.rank) : '–'} <small>of ${period.rows.length}</small></div></div>
      </div>
      <div class="list">
        ${period.rows.map((r) => `
          <div class="board-row ${r.rank === 1 && r.days > 0 ? 'lead' : ''} ${r.id === b.me.id ? 'me' : ''}">
            ${medal(r.rank)}${avatar(r.name)}<span class="name">${esc(r.name)}${r.id === b.me.id ? ' (you)' : ''}</span>
            <span class="days">${r.days} <span>${r.days === 1 ? 'day' : 'days'}</span></span>
          </div>`).join('')}
      </div>
      <p class="muted center small">${boardTab === 'week' ? 'Resets Monday at midnight' : 'Resets on the 1st'} · one check-in per day counts</p>`;
    view.querySelectorAll('[data-t]').forEach((btn) => {
      btn.onclick = () => { boardTab = btn.dataset.t; draw(); };
    });
  };
  draw();
}

/* ---------- check-in ---------- */

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

/** Draw a video frame or image onto a canvas, max 1080px, as a JPEG data URL. */
function toJpeg(source, w, h, mirror) {
  const scale = Math.min(1, 1080 / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (mirror) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

async function checkinPage(id) {
  const b = await api('leaderboard');
  if (id !== renderId) return;

  if (b.me.checkedInToday) {
    view.innerHTML = `
      <h1>You're in <span class="accent">for today</span></h1>
      <div class="big-wrap"><a class="big-btn done" href="#feed"><span class="h">Done</span><span class="sub">for today ✓</span></a></div>
      <p class="muted center">One check-in per day counts. Come back tomorrow.</p>
      <a class="btn" href="#board" style="display:grid;place-items:center;text-decoration:none">See the leaderboard</a>`;
    return;
  }

  view.innerHTML = `
    <h1>Check-in <span class="accent">at the gym</span></h1>
    <div class="camera" id="cam">
      <div class="placeholder" id="ph">
        <div class="circle">${ICON.camera('#C2187A', 50)}</div>
        <div class="h" style="font-size:24px">Starting camera…</div>
      </div>
    </div>
    <div class="row" id="controls"></div>
    <p class="muted center small">Live photo only · one check-in per day</p>
    <input type="file" accept="image/*" capture="user" id="file" hidden>`;

  const cam = document.getElementById('cam');
  const controls = document.getElementById('controls');
  const file = document.getElementById('file');
  let photo = null;

  const showPreview = (dataUrl) => {
    stopCamera();
    photo = dataUrl;
    cam.innerHTML = `<img src="${dataUrl}" alt="Your gym photo">`;
    controls.innerHTML = `
      <button type="button" class="btn ghost" id="retake">Retake</button>
      <button type="button" class="btn" id="post">Post it</button>`;
    document.getElementById('retake').onclick = () => { photo = null; start(); };
    document.getElementById('post').onclick = post;
  };

  const fallback = (why) => {
    cam.innerHTML = `
      <div class="placeholder">
        <div class="circle">${ICON.camera('#C2187A', 50)}</div>
        <div class="h" style="font-size:24px">Snap your proof</div>
        <div class="small" style="color:#1A0629;font-weight:700">${esc(why)}</div>
      </div>`;
    controls.innerHTML = '<button type="button" class="btn" id="open">Open camera</button>';
    document.getElementById('open').onclick = () => file.click();
  };

  file.onchange = () => {
    const f = file.files?.[0];
    if (!f) return;
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      showPreview(toJpeg(img, img.naturalWidth, img.naturalHeight, false));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => toast("Couldn't read that photo");
    img.src = url;
    file.value = '';
  };

  async function start() {
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) return fallback('Tap below to take your photo.');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false,
      });
      if (id !== renderId) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
    } catch {
      return fallback('Camera access was blocked. Tap below to take your photo instead.');
    }
    const mirror = facing === 'user';
    cam.innerHTML = `<video autoplay playsinline muted class="${mirror ? 'mirror' : ''}"></video>
      <button type="button" class="flip" id="flip" aria-label="Switch camera">${ICON.flip}</button>`;
    const video = cam.querySelector('video');
    video.srcObject = stream;
    document.getElementById('flip').onclick = () => { facing = facing === 'user' ? 'environment' : 'user'; start(); };
    controls.innerHTML = `<button type="button" class="btn" id="snap">${ICON.camera('#1A0629', 26)} Snap</button>`;
    const snap = document.getElementById('snap');
    snap.style.display = 'flex';
    snap.style.alignItems = 'center';
    snap.style.justifyContent = 'center';
    snap.style.gap = '10px';
    snap.onclick = () => {
      if (!video.videoWidth) return toast('Camera is still starting…');
      showPreview(toJpeg(video, video.videoWidth, video.videoHeight, mirror));
    };
  }

  async function post() {
    const btn = document.getElementById('post');
    btn.disabled = true;
    btn.textContent = 'Posting…';
    try {
      await api('checkin', { method: 'POST', body: { photo } });
      toast('+1 day! See you on the board 💪');
      location.hash = '#home';
    } catch (err) {
      toast(err.message);
      if (err.status === 409) location.hash = '#home';
      else { btn.disabled = false; btn.textContent = 'Post it'; }
    }
  }

  start();
}

/* ---------- feed ---------- */

async function feedPage(id) {
  const { posts } = await api('feed');
  if (id !== renderId) return;

  view.innerHTML = `
    <h1>Recent <span class="accent">check-ins</span></h1>
    ${posts.length ? `<div class="grid2">${posts.map((p) => `
      <article class="post">
        <div class="post-head">${avatar(p.name)}<b>${esc(p.name)}</b><span class="muted">· ${esc(p.addedByAdmin ? dayLabel(p.day) : ago(p.createdAt))}</span></div>
        <div class="post-photo">
          ${p.photoUrl ? `<img src="${esc(p.photoUrl)}" alt="${esc(p.name)} at the gym" loading="lazy">`
            : p.addedByAdmin ? `<div class="gone">Added by admin<br>for ${esc(dayLabel(p.day))}</div>`
            : '<div class="gone">Photo cleared after 90 days</div>'}
          <div class="reacts">
            <button type="button" class="react" data-id="${esc(p.id)}" data-kind="sus" aria-pressed="${p.mySus}" aria-label="Sus">${ICON.sus}<span>${p.sus}</span></button>
            <button type="button" class="react" data-id="${esc(p.id)}" data-kind="love" aria-pressed="${p.myLove}" aria-label="Love">${ICON.heart}<span>${p.love}</span></button>
          </div>
        </div>
      </article>`).join('')}</div>`
      : '<p class="empty">No check-ins yet. Go lift something!</p>'}`;

  view.querySelectorAll('.react').forEach((btn) => {
    btn.onclick = async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        const r = await api('react', { method: 'POST', body: { checkinId: btn.dataset.id, kind: btn.dataset.kind } });
        btn.setAttribute('aria-pressed', String(r.mine));
        btn.querySelector('span').textContent = r.count;
      } catch (err) {
        toast(err.message);
      } finally {
        btn.disabled = false;
      }
    };
  });
}

render();
