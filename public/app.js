// Haber — arayüz mantığı
// Tüm haberler bir kez çekilir; sekme, arama ve kişiselleştirme tarayıcıda anında uygulanır.

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PAGE = 24;
const LANGS = { tr: 'Türkçe', en: 'İngilizce' };
const CAT_EMOJI = { gundem: '📰', dunya: '🌍', teknoloji: '💻', ekonomi: '📈', spor: '⚽', bilim: '🔬', kultur: '🎭' };

// ---------- Kalıcı durum (tarayıcıda) ----------
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};
const prefs = { categories: [], langs: [], keywords: [], onboarded: false, ...store.get('haber.prefs', {}) };
if (typeof prefs.keywords === 'string') prefs.keywords = prefs.keywords.split(',').map((k) => k.trim()).filter(Boolean);
const saved = new Map(store.get('haber.saved', []).map((i) => [i.link, i]));
const readSet = new Set(store.get('haber.read', []));
const savePrefs = () => store.set('haber.prefs', prefs);
const saveSaved = () => store.set('haber.saved', [...saved.values()]);
const saveRead = () => store.set('haber.read', [...readSet].slice(-500));

// ---------- Uygulama durumu ----------
let categories = {};
let allNews = [];
let view = [];
let shown = 0;
let activeTab = 'foryou';
let query = '';

// ---------- Yardımcılar ----------
function timeAgo(date) {
  if (!date) return '';
  const s = (Date.now() - new Date(date)) / 1000;
  if (s < 60) return 'şimdi';
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa önce`;
  if (s < 604800) return `${Math.floor(s / 86400)} gün önce`;
  return new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}
const catColor = (c) => `var(--c-${c}, var(--accent))`;
const lower = (s) => s.toLocaleLowerCase('tr');
const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); el.addEventListener('animationend', () => el.remove()); }, 2200);
}

function matchedKeywords(item) {
  const text = lower(`${item.title} ${item.summary}`);
  return prefs.keywords.filter((k) => text.includes(lower(k)));
}

// ---------- Sekmeler ----------
function tabList() {
  return [
    { id: 'foryou', label: 'Sana Özel' },
    { id: 'all', label: 'Tümü' },
    ...Object.entries(categories).map(([id, label]) => ({ id, label })),
    { id: 'saved', label: 'Kaydedilenler', count: saved.size },
  ];
}

function renderTabs() {
  const tabs = $('tabs');
  tabs.querySelectorAll('.tab').forEach((t) => t.remove());
  const indicator = $('tab-indicator');
  for (const t of tabList()) {
    const b = document.createElement('button');
    b.className = 'tab' + (t.id === activeTab ? ' active' : '');
    b.dataset.id = t.id;
    b.role = 'tab';
    b.innerHTML = esc(t.label) + (t.count ? `<span class="count">${t.count}</span>` : '');
    b.onclick = () => selectTab(t.id);
    tabs.insertBefore(b, indicator);
  }
  requestAnimationFrame(moveIndicator);
}

function moveIndicator() {
  const active = $('tabs').querySelector('.tab.active');
  if (!active) return;
  const ind = $('tab-indicator');
  ind.style.width = active.offsetWidth + 'px';
  ind.style.transform = `translateX(${active.offsetLeft}px)`;
  const cat = categories[activeTab] ? catColor(activeTab) : 'var(--accent)';
  ind.style.background = cat;
}

function selectTab(id) {
  if (id === activeTab) { window.scrollTo({ top: 0 }); return; }
  haptic();
  activeTab = id;
  $('tabs').querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.id === id));
  const btn = $('tabs').querySelector(`.tab[data-id="${id}"]`);
  btn?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
  moveIndicator();
  window.scrollTo({ top: 0, behavior: 'instant' });
  buildView();
}

// ---------- Karşılama metni ----------
function renderGreeting() {
  const h = new Date().getHours();
  const hello = h < 6 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
  const titles = { foryou: hello, all: 'Tüm haberler', saved: 'Kaydettiklerin' };
  $('greeting-title').textContent = titles[activeTab] || categories[activeTab] || hello;
  const sub = activeTab === 'foryou'
    ? `${view.length} haber senin ilgi alanlarına göre sıralandı.`
    : activeTab === 'saved' ? 'Sonra okumak için ayırdıkların.' : `${view.length} güncel haber`;
  $('greeting-sub').textContent = query ? `"${query}" için ${view.length} sonuç` : sub;
  for (const el of $('greeting').children) { el.style.animation = 'none'; el.offsetHeight; el.style.animation = ''; }
}

// ---------- Akışı oluştur ----------
function buildView() {
  let items = activeTab === 'saved' ? [...saved.values()].reverse() : allNews;
  if (prefs.langs.length && activeTab !== 'saved') items = items.filter((i) => prefs.langs.includes(i.lang));

  if (activeTab === 'foryou') {
    if (prefs.categories.length) items = items.filter((i) => prefs.categories.includes(i.category) || matchedKeywords(i).length);
    // Puan: anahtar kelime eşleşmesi + tazelik. Eşleşenler üste çıkar, gerisi zaman sırasında kalır.
    items = items
      .map((i) => ({ i, s: matchedKeywords(i).length * 10 - (Date.now() - new Date(i.date || 0)) / 3.6e6 / 6 }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.i);
  } else if (categories[activeTab]) {
    items = items.filter((i) => i.category === activeTab);
  }

  if (query) {
    const q = lower(query);
    items = items.filter((i) => lower(`${i.title} ${i.summary} ${i.source}`).includes(q));
  }

  view = items;
  shown = 0;
  $('feed').innerHTML = '';
  renderGreeting();

  if (!view.length) {
    const empty = activeTab === 'saved'
      ? ['🔖', 'Henüz bir şey kaydetmedin. Kartlardaki işaret simgesine dokun.']
      : query ? ['🔎', 'Aramana uyan haber bulunamadı.'] : ['🌤️', 'Tercihlerine uyan haber yok. İlgi alanlarını genişletebilirsin.'];
    $('feed').innerHTML = `<div class="status"><span class="big-emoji">${empty[0]}</span>${empty[1]}</div>`;
    return;
  }
  renderMore();
}

function renderMore() {
  const feed = $('feed');
  const frag = document.createDocumentFragment();
  const slice = view.slice(shown, shown + PAGE);
  slice.forEach((item, idx) => {
    const n = shown + idx;
    let size = '';
    if (n === 0 && item.image && !query) size = 'hero';
    else if (n % 9 === 5 && item.image && innerWidth > 700) size = 'wide';
    frag.appendChild(cardEl(item, size, idx));
  });
  shown += slice.length;
  feed.querySelector('.sentinel')?.remove();
  feed.appendChild(frag);
  if (shown < view.length) {
    const s = document.createElement('div');
    s.className = 'sentinel';
    s.style.gridColumn = '1 / -1';
    feed.appendChild(s);
    moreObserver.observe(s);
  }
}

function cardEl(item, size, idx) {
  const el = document.createElement('article');
  el.className = `card ${size}` + (readSet.has(item.link) ? ' read' : '');
  el.style.setProperty('--cat', catColor(item.category));
  el.dataset.stagger = idx % 6;
  const kws = matchedKeywords(item);
  const media = item.image
    ? `<div class="card-media"><img alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${esc(item.image)}"></div>`
    : `<div class="card-media fallback"><span>${esc(item.source)}</span></div>`;
  el.innerHTML = `
    ${media}
    <button class="save${saved.has(item.link) ? ' on' : ''}" aria-label="Kaydet">
      <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>
    </button>
    <div class="card-body">
      <div class="meta"><span class="cat-pill">${esc(categories[item.category] || item.category)}</span><span class="dot"></span>${esc(item.source)}<span class="dot"></span>${timeAgo(item.date)}</div>
      <h3>${esc(item.title)}</h3>
      ${item.summary ? `<p>${esc(item.summary)}</p>` : ''}
      ${kws.length && activeTab !== 'saved' ? `<span class="match-tag">✦ ${esc(kws.join(', '))}</span>` : ''}
    </div>`;

  const img = el.querySelector('img');
  if (img) {
    const done = () => img.classList.add('loaded');
    img.complete && img.naturalWidth ? done() : img.addEventListener('load', done);
    img.addEventListener('error', () => {
      const m = img.parentElement;
      m.classList.add('fallback');
      m.innerHTML = `<span>${esc(item.source)}</span>`;
    });
  }
  el.querySelector('.save').addEventListener('click', (e) => { e.stopPropagation(); toggleSave(item, e.currentTarget); });
  el.addEventListener('click', () => openSheet(item, el));
  revealObserver.observe(el);
  return el;
}

// ---------- Animasyonlu giriş ve sonsuz kaydırma ----------
const revealObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const el = e.target;
    el.style.transitionDelay = reduceMotion ? '0ms' : `${el.dataset.stagger * 60}ms`;
    el.classList.add('in');
    setTimeout(() => { el.style.transitionDelay = ''; }, 700);
    revealObserver.unobserve(el);
  }
}, { rootMargin: '0px 0px -40px 0px' });

const moreObserver = new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) { moreObserver.disconnect(); renderMore(); }
}, { rootMargin: '600px' });

// ---------- Kaydetme ----------
function toggleSave(item, btn) {
  haptic(12);
  if (saved.has(item.link)) {
    saved.delete(item.link);
    btn?.classList.remove('on');
    toast('Kaydedilenlerden çıkarıldı');
  } else {
    saved.set(item.link, item);
    if (btn) {
      btn.classList.add('on');
      burst(btn);
    }
    toast('Kaydedildi 🔖');
  }
  if (btn) { btn.classList.remove('pop'); btn.offsetWidth; btn.classList.add('pop'); }
  saveSaved();
  const count = $('tabs').querySelector('.tab[data-id="saved"]');
  if (count) { count.innerHTML = 'Kaydedilenler' + (saved.size ? `<span class="count">${saved.size}</span>` : ''); moveIndicator(); }
}

function burst(btn) {
  if (reduceMotion) return;
  const b = document.createElement('span');
  b.className = 'burst';
  for (let k = 0; k < 8; k++) {
    const i = document.createElement('i');
    i.style.setProperty('--a', `${k * 45}deg`);
    b.appendChild(i);
  }
  btn.appendChild(b);
  setTimeout(() => b.remove(), 650);
}

// ---------- Okuma paneli ----------
let sheetItem = null;
function openSheet(item, card) {
  sheetItem = item;
  haptic();
  readSet.add(item.link); saveRead();
  setTimeout(() => card?.classList.add('read'), 400);
  const kws = matchedKeywords(item);
  $('sheet-body').innerHTML = `
    ${item.image ? `<img class="sheet-img" src="${esc(item.image)}" alt="" referrerpolicy="no-referrer">` : ''}
    <div class="meta" style="--cat:${catColor(item.category)}"><span class="cat-pill">${esc(categories[item.category] || '')}</span><span class="dot"></span>${esc(item.source)}<span class="dot"></span>${timeAgo(item.date)}</div>
    <h2>${esc(item.title)}</h2>
    <p>${esc(item.summary || 'Bu haberin özeti kaynakta yer almıyor. Tamamını kaynağında okuyabilirsin.')}</p>
    <div class="sheet-actions">
      <a class="primary" href="${esc(item.link)}" target="_blank" rel="noopener">Haberin tamamını oku
        <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      <button class="secondary" id="sheet-save">${saved.has(item.link) ? 'Kaydedildi ✓' : 'Kaydet'}</button>
      <button class="secondary" id="sheet-share">Paylaş</button>
    </div>
    ${kws.length ? `<p class="hint">✦ Takip ettiğin konu: ${esc(kws.join(', '))}</p>` : ''}`;
  $('sheet-save').onclick = (e) => {
    toggleSave(item, null);
    e.currentTarget.textContent = saved.has(item.link) ? 'Kaydedildi ✓' : 'Kaydet';
    card?.querySelector('.save')?.classList.toggle('on', saved.has(item.link));
  };
  $('sheet-share').onclick = async () => {
    try {
      if (navigator.share) await navigator.share({ title: item.title, url: item.link });
      else { await navigator.clipboard.writeText(item.link); toast('Bağlantı kopyalandı'); }
    } catch {}
  };
  $('sheet-body').scrollTop = 0;
  $('sheet').style.transform = '';
  $('sheet').classList.add('open');
  $('sheet-backdrop').classList.add('open');
  document.body.classList.add('locked');
}
function closeSheet() {
  $('sheet').classList.remove('open');
  $('sheet').style.transform = '';
  $('sheet-backdrop').classList.remove('open');
  document.body.classList.remove('locked');
  sheetItem = null;
}

// Paneli aşağı sürükleyerek kapatma
(function dragToClose() {
  const sheet = $('sheet');
  let startY = null, dy = 0;
  const start = (y) => { startY = y; dy = 0; sheet.classList.add('dragging'); };
  const move = (y) => {
    if (startY === null) return;
    dy = Math.max(0, y - startY);
    sheet.style.transform = `translate(-50%, ${dy}px)`;
  };
  const end = () => {
    if (startY === null) return;
    sheet.classList.remove('dragging');
    if (dy > 120) closeSheet(); else sheet.style.transform = '';
    startY = null;
  };
  const handle = sheet.querySelector('.sheet-handle');
  handle.addEventListener('pointerdown', (e) => { handle.setPointerCapture(e.pointerId); start(e.clientY); });
  handle.addEventListener('pointermove', (e) => move(e.clientY));
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  // Mobilde içerik en üstteyken aşağı çekmek de kapatır
  const body = $('sheet-body');
  body.addEventListener('touchstart', (e) => { if (body.scrollTop <= 0) start(e.touches[0].clientY); }, { passive: true });
  body.addEventListener('touchmove', (e) => { if (startY !== null && body.scrollTop <= 0) move(e.touches[0].clientY); }, { passive: true });
  body.addEventListener('touchend', end);
})();

// ---------- Tercih paneli ----------
function chip(label, on, color, onClick, extra = '') {
  const c = document.createElement('span');
  c.className = 'chip' + (on ? ' on' : '');
  if (color) c.style.setProperty('--cat', color);
  c.innerHTML = `<span class="tick"><svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg></span>${label}${extra}`;
  c.onclick = () => { haptic(); onClick(c); };
  return c;
}

function renderPrefs() {
  const cat = $('cat-list');
  cat.innerHTML = '';
  for (const [id, label] of Object.entries(categories)) {
    cat.appendChild(chip(`${CAT_EMOJI[id] || ''} ${esc(label)}`, prefs.categories.includes(id), catColor(id), (c) => {
      prefs.categories = prefs.categories.includes(id) ? prefs.categories.filter((x) => x !== id) : [...prefs.categories, id];
      c.classList.toggle('on'); savePrefs(); buildView();
    }));
  }
  const lang = $('lang-list');
  lang.innerHTML = '';
  for (const [id, label] of Object.entries(LANGS)) {
    lang.appendChild(chip(esc(label), prefs.langs.includes(id), null, (c) => {
      prefs.langs = prefs.langs.includes(id) ? prefs.langs.filter((x) => x !== id) : [...prefs.langs, id];
      c.classList.toggle('on'); savePrefs(); buildView();
    }));
  }
  renderKeywords();
}

function renderKeywords() {
  const list = $('kw-list');
  list.innerHTML = '';
  for (const k of prefs.keywords) {
    const c = chip(esc(k), true, null, () => {
      prefs.keywords = prefs.keywords.filter((x) => x !== k);
      c.style.transition = 'transform .25s, opacity .25s';
      c.style.transform = 'scale(.6)'; c.style.opacity = '0';
      setTimeout(() => { renderKeywords(); savePrefs(); buildView(); }, 220);
    }, '<span class="x">✕</span>');
    c.classList.add('kw');
    list.appendChild(c);
  }
}

function openDrawer() { $('drawer').classList.add('open'); $('drawer-backdrop').classList.add('open'); document.body.classList.add('locked'); }
function closeDrawer() { $('drawer').classList.remove('open'); $('drawer-backdrop').classList.remove('open'); document.body.classList.remove('locked'); }

// ---------- İlk açılış ----------
function showOnboarding() {
  const ob = $('onboard');
  ob.hidden = false;
  const list = $('onboard-cats');
  const go = $('onboard-go');
  list.innerHTML = '';
  for (const [id, label] of Object.entries(categories)) {
    list.appendChild(chip(`${CAT_EMOJI[id] || ''} ${esc(label)}`, prefs.categories.includes(id), catColor(id), (c) => {
      prefs.categories = prefs.categories.includes(id) ? prefs.categories.filter((x) => x !== id) : [...prefs.categories, id];
      c.classList.toggle('on');
      go.disabled = !prefs.categories.length;
      go.textContent = prefs.categories.length ? `Başlayalım (${prefs.categories.length})` : 'Başlayalım';
    }));
  }
  go.disabled = !prefs.categories.length;
  go.onclick = () => {
    prefs.onboarded = true; savePrefs(); renderPrefs(); buildView();
    ob.classList.add('leaving');
    setTimeout(() => { ob.hidden = true; ob.classList.remove('leaving'); toast('Akışın hazır ✨'); }, 480);
  };
}

// ---------- Yükleme ----------
function showSkeletons() {
  $('feed').innerHTML = `<div class="skeleton hero shimmer"></div>` +
    Array.from({ length: 6 }, () => `<div class="skeleton"><div class="sk-media shimmer"></div><div class="sk-line short shimmer"></div><div class="sk-line shimmer"></div><div class="sk-line last shimmer"></div></div>`).join('');
}

async function loadNews(force = false) {
  if (!allNews.length) showSkeletons();
  const res = await fetch('/api/news?limit=500' + (force ? '&refresh=1' : ''));
  const { items } = await res.json();
  const before = new Set(allNews.map((i) => i.link));
  const fresh = allNews.length ? items.filter((i) => !before.has(i.link)).length : 0;
  allNews = items;
  buildView();
  return fresh;
}

// ---------- Olaylar ----------
function bindEvents() {
  let t;
  $('search').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { query = e.target.value.trim(); buildView(); }, 200);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); $('search').focus(); }
    if (e.key === 'Escape') { closeSheet(); closeDrawer(); $('search').blur(); }
  });

  $('refresh').onclick = async () => {
    const b = $('refresh');
    b.classList.remove('spin'); b.offsetWidth; b.classList.add('spin');
    try {
      const fresh = await loadNews(true);
      toast(fresh ? `${fresh} yeni haber geldi` : 'Akış güncel ✓');
    } catch { toast('Haberler alınamadı'); }
  };

  $('theme').onclick = () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    const apply = () => { document.documentElement.dataset.theme = next; store.set('haber.theme', next); };
    // Destekleyen tarayıcılarda tema dairesel bir geçişle yayılır
    if (document.startViewTransition && !reduceMotion) {
      const r = $('theme').getBoundingClientRect();
      document.documentElement.style.setProperty('--vt-x', `${r.left + r.width / 2}px`);
      document.documentElement.style.setProperty('--vt-y', `${r.top + r.height / 2}px`);
      document.startViewTransition(apply);
    } else apply();
  };

  $('open-prefs').onclick = openDrawer;
  $('close-prefs').onclick = closeDrawer;
  $('drawer-backdrop').onclick = closeDrawer;
  $('sheet-backdrop').onclick = closeSheet;
  $('kw-input').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const v = e.target.value.trim();
    if (v && !prefs.keywords.some((k) => lower(k) === lower(v))) {
      prefs.keywords.push(v); savePrefs(); renderKeywords(); buildView();
      toast(`"${v}" takip ediliyor`);
    }
    e.target.value = '';
  });

  $('to-top').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      $('progress').style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      $('topbar').classList.toggle('scrolled', y > 8);
      $('to-top').classList.toggle('show', y > 900);
      ticking = false;
    });
  }, { passive: true });
  addEventListener('resize', moveIndicator);
}

// ---------- Başlat ----------
async function init() {
  bindEvents();
  showSkeletons();
  try {
    const meta = await fetch('/api/meta').then((r) => r.json());
    categories = meta.categories;
    renderTabs();
    renderPrefs();
    if (!prefs.onboarded) showOnboarding();
    await loadNews();
  } catch {
    $('feed').innerHTML = '<div class="status"><span class="big-emoji">📡</span>Haberler alınamadı. Sunucu çalışıyor mu?</div>';
  }
  document.fonts?.ready.then(moveIndicator);
}
init();
