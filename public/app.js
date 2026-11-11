// Haber — arayüz mantığı
// Tüm haberler bir kez çekilir; sekme, arama, etiket filtreleri ve kişiselleştirme tarayıcıda anında uygulanır.

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PAGE = 24;
const LANGS = { tr: 'Türkçe', en: 'İngilizce' };
const CAT_EMOJI = { gundem: '🇹🇷', dunya: '🌍', ekonomi: '📈', teknoloji: '💻', bilim: '🔭', saglik: '🩺', spor: '⚽', oyun: '🎮', kultur: '🎭' };
// İlk açılışta, seçilen kategoriye göre önerilecek etiket grupları
const CAT_GROUPS = { gundem: ['konu', 'bolge'], dunya: ['bolge', 'konu'], ekonomi: ['ekonomi'], teknoloji: ['teknoloji'], bilim: ['bilim'], saglik: ['bilim'], spor: ['spor'], oyun: ['kultur'], kultur: ['kultur'] };
const TIME = { all: Infinity, '1h': 3.6e6, today: 'today', week: 7 * 864e5 };

// ---------- Kalıcı durum (tarayıcıda) ----------
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};
const prefs = {
  categories: [], langs: [], keywords: [], onboarded: false,
  followTags: [], muteTags: [], muteSources: [], sort: 'smart',
  ...store.get('haber.prefs', {}),
};
if (typeof prefs.keywords === 'string') prefs.keywords = prefs.keywords.split(',').map((k) => k.trim()).filter(Boolean);
const saved = new Map(store.get('haber.saved', []).map((i) => [i.link, i]));
const readSet = new Set(store.get('haber.read', []));
const savePrefs = () => store.set('haber.prefs', prefs);
const saveSaved = () => store.set('haber.saved', [...saved.values()].map(({ _text, ...rest }) => rest));
const saveRead = () => store.set('haber.read', [...readSet].slice(-500));

// Öğrenen akış: okuduğun, kaydettiğin, geçtiğin haberlerden etiket/kategori/kaynak eğilimi çıkarılır.
// Her gün %3 azalır; böylece eski ilgiler zamanla söner, yenileri öne çıkar.
const aff = { tags: {}, cats: {}, srcs: {}, at: Date.now(), ...store.get('haber.aff', {}) };
(function decay() {
  const f = Math.pow(0.97, (Date.now() - aff.at) / 864e5);
  for (const m of [aff.tags, aff.cats, aff.srcs]) for (const k in m) { m[k] *= f; if (Math.abs(m[k]) < 0.05) delete m[k]; }
  aff.at = Date.now();
})();
const saveAff = () => store.set('haber.aff', aff);
const clamp = (x) => Math.max(-10, Math.min(20, x));
function learn(item, w) {
  for (const t of item.tags || []) aff.tags[t] = clamp((aff.tags[t] || 0) + w);
  aff.cats[item.category] = clamp((aff.cats[item.category] || 0) + w * 0.5);
  aff.srcs[item.sourceId] = clamp((aff.srcs[item.sourceId] || 0) + w * 0.3);
  saveAff();
}
// Okuma günlüğü (haftalık özet için)
const readLog = store.get('haber.log', []);
function logRead(item, dwell) {
  readLog.push({ t: Date.now(), link: item.link, tags: item.tags || [], cat: item.category, src: item.source, countries: item.countries || [], dwell: Math.round(dwell) });
  while (readLog.length > 3000) readLog.shift();
  store.set('haber.log', readLog);
}
// Takip edilen gelişen hikayeler
const followed = store.get('haber.stories', []);
const saveFollowed = () => store.set('haber.stories', followed);
const slim = (i) => ({ link: i.link, title: i.title, source: i.source, date: i.date, lang: i.lang, image: i.image, summary: i.summary, category: i.category, sourceId: i.sourceId, tags: i.tags, storyId: i.storyId });

// ---------- Uygulama durumu ----------
let categories = {};
let tagGroups = {};
let tagMap = {};
let sources = [];
let allNews = [];
let view = [];
let shown = 0;
let activeTab = 'foryou';
let query = '';
let activeTags = [];
let timeRange = 'all';
let storyMap = new Map(); // hikaye kimliği -> o olayı yazan tüm haberler
let activeCountry = null;
let countryMap = {};

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
const lower = (s) => String(s).toLocaleLowerCase('tr');
const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };
const tagLabel = (id) => (tagMap[id] ? `${tagMap[id].emoji} ${tagMap[id].label}` : id);

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); el.addEventListener('animationend', () => el.remove()); }, 2200);
}

function matchedKeywords(item) {
  return prefs.keywords.filter((k) => item._text.includes(lower(k)));
}

// ---------- Sekmeler ----------
function tabList() {
  return [
    { id: 'foryou', label: 'Sana Özel' },
    { id: 'all', label: 'Tümü' },
    ...Object.entries(categories).map(([id, label]) => ({ id, label })),
    { id: 'stories', label: '🔔 Hikayelerim', count: unseenCount() },
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
  ind.style.background = categories[activeTab] ? catColor(activeTab) : 'var(--accent)';
}

function selectTab(id) {
  if (id === activeTab) { window.scrollTo({ top: 0 }); return; }
  haptic();
  activeTab = id;
  activeTags = [];
  $('tabs').querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.id === id));
  $('tabs').querySelector(`.tab[data-id="${id}"]`)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
  moveIndicator();
  window.scrollTo({ top: 0, behavior: 'instant' });
  buildView();
}

// ---------- Filtre çubuğu ----------
function moveSegThumb() {
  const on = $('time-seg').querySelector('button.on');
  const thumb = $('time-seg').querySelector('.seg-thumb');
  thumb.style.width = on.offsetWidth + 'px';
  thumb.style.transform = `translateX(${on.offsetLeft}px)`;
}

function renderSortBtn() {
  const forYou = activeTab === 'foryou';
  $('sort-btn').textContent = forYou && prefs.sort === 'smart' ? '✦ Sana uygun' : '🕒 En yeni';
  $('sort-btn').disabled = !forYou;
  $('sort-btn').classList.toggle('on', forYou && prefs.sort === 'smart');
}

// Görünen haberlerdeki etiketleri sayıp şeride dizer; seçililer başta
function renderTagStrip(baseItems) {
  const counts = new Map();
  for (const i of baseItems) for (const t of i.tags) if (!prefs.muteTags.includes(t)) counts.set(t, (counts.get(t) || 0) + 1);
  const top = [...counts.entries()]
    .filter(([t]) => !activeTags.includes(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);
  $('tag-strip').innerHTML =
    activeTags.map((t) => `<button class="tag-chip on" data-t="${t}">${esc(tagLabel(t))}<span class="n">${counts.get(t) || 0}</span><span class="x">✕</span></button>`).join('') +
    top.map(([t, n]) => `<button class="tag-chip${prefs.followTags.includes(t) ? ' followed' : ''}" data-t="${t}">${esc(tagLabel(t))}<span class="n">${n}</span></button>`).join('');
  if (activeCountry) $('tag-strip').insertAdjacentHTML('afterbegin', `<button class="tag-chip on" data-country="1">📍 ${esc(countryMap[activeCountry] || '')}<span class="x">✕</span></button>`);
  $('clear-filters').hidden = !(activeTags.length || timeRange !== 'all' || query || activeCountry);
}

function toggleActiveTag(t) {
  haptic();
  activeTags = activeTags.includes(t) ? activeTags.filter((x) => x !== t) : [...activeTags, t];
  window.scrollTo({ top: 0, behavior: 'instant' });
  buildView();
  $('tag-strip').scrollTo({ left: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
}

// ---------- Karşılama metni ----------
function renderGreeting() {
  const h = new Date().getHours();
  const hello = h < 6 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
  const titles = { foryou: hello, all: 'Tüm haberler', saved: 'Kaydettiklerin' };
  let title = titles[activeTab] || categories[activeTab] || hello;
  if (activeTags.length === 1) title = tagLabel(activeTags[0]);
  if (activeCountry) title = `📍 ${countryMap[activeCountry] || ''}`;
  $('greeting-title').textContent = title;
  let sub;
  if (query) sub = `"${query}" için ${view.length} sonuç`;
  else if (activeTags.length > 1) sub = `${activeTags.map((t) => tagMap[t]?.label || t).join(' + ')}: ${view.length} haber`;
  else if (activeTab === 'foryou') sub = `${view.length} haber senin zevkine göre sıralandı`;
  else if (activeTab === 'saved') sub = 'Sonra okumak için ayırdıkların';
  else sub = `${view.length} güncel haber`;
  $('greeting-sub').textContent = sub;
}

// ---------- Akışı oluştur ----------
function inTime(item) {
  if (timeRange === 'all') return true;
  const t = new Date(item.date || 0).getTime();
  if (TIME[timeRange] === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return t >= d.getTime(); }
  return Date.now() - t <= TIME[timeRange];
}

function score(item) {
  let s = -(Date.now() - new Date(item.date || 0)) / 3.6e6 / 6; // her 6 saatte 1 puan düşer
  s += matchedKeywords(item).length * 10;
  s += item.tags.filter((t) => prefs.followTags.includes(t)).length * 12;
  if (prefs.categories.includes(item.category)) s += 3;
  for (const t of item.tags) s += Math.min(aff.tags[t] || 0, 8) * 1.5;
  s += (aff.cats[item.category] || 0) + (aff.srcs[item.sourceId] || 0) * 0.5;
  if (item.storySize > 1) s += Math.log2(item.storySize) * 2.5;
  return s;
}

// "Bunu neden görüyorum?" — haberin akışta olma sebepleri, en güçlüsü başta
function reasons(item) {
  const r = [];
  const fol = item.tags.filter((t) => prefs.followTags.includes(t));
  if (fol.length) r.push(`${tagMap[fol[0]]?.label || fol[0]} konusunu takip ediyorsun`);
  const kws = matchedKeywords(item);
  if (kws.length) r.push(`"${kws[0]}" kelimesini takip ediyorsun`);
  const learned = item.tags.filter((t) => (aff.tags[t] || 0) >= 1.5 && !fol.includes(t)).sort((a, b) => aff.tags[b] - aff.tags[a]);
  if (learned.length) r.push(`${tagMap[learned[0]]?.label || learned[0]} haberlerini sık okuyorsun`);
  if (item.storySize >= 3) r.push(`Çok konuşulan: ${item.storySize} kaynak yazdı`);
  if ((aff.srcs[item.sourceId] || 0) >= 1.5) r.push(`${item.source} sık okuduğun bir kaynak`);
  if (prefs.categories.includes(item.category)) r.push(`${categories[item.category]} ilgi alanlarında`);
  if (Date.now() - new Date(item.date || 0) < 3.6e6) r.push('Son bir saatte yayımlandı');
  return r;
}

function unseenCount() {
  return followed.reduce((n, st) => n + st.items.filter((i) => new Date(i.date || 0) > st.lastSeen).length, 0);
}

function buildView() {
  if (activeTab === 'stories') { renderStoriesTab(); return; }
  let items = activeTab === 'saved' ? [...saved.values()].reverse() : allNews;
  if (activeTab !== 'saved') {
    items = items.filter((i) => !prefs.muteSources.includes(i.sourceId) && !i.tags.some((t) => prefs.muteTags.includes(t)));
    if (prefs.langs.length) items = items.filter((i) => prefs.langs.includes(i.lang));
  }

  if (activeTab === 'foryou') {
    if (prefs.categories.length || prefs.followTags.length) {
      items = items.filter((i) => prefs.categories.includes(i.category) || i.tags.some((t) => prefs.followTags.includes(t)) || matchedKeywords(i).length);
    }
  } else if (categories[activeTab]) {
    items = items.filter((i) => i.category === activeTab);
  }

  items = items.filter(inTime);
  if (activeCountry) items = items.filter((i) => (i.countries || []).includes(activeCountry));
  if (typeof goodOnly !== 'undefined' && goodOnly) items = items.filter((i) => i.mood === 'good');
  if (query) {
    const q = lower(query);
    items = items.filter((i) => i._text.includes(q) || lower(i.source).includes(q) || i.tags.some((t) => lower(tagMap[t]?.label || '').includes(q)));
  }

  // Seçili etiketlerin hepsi birden aranır (her etiket sonucu daraltır)
  if (activeTags.length) items = items.filter((i) => activeTags.every((t) => i.tags.includes(t)));
  renderTagStrip(items);

  if (activeTab === 'foryou' && prefs.sort === 'smart') {
    items = items.map((i) => [i, score(i)]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  }
  // Aynı olayı yazan haberler tek kartta: en üstteki temsil eder, gerisi "farklı gözler"de
  if (activeTab !== 'saved') {
    const seenStory = new Set();
    items = items.filter((i) => !i.storyId || i.storySize < 2 || (!seenStory.has(i.storyId) && seenStory.add(i.storyId)));
  }

  view = items;
  shown = 0;
  $('feed').innerHTML = '';
  renderGreeting();
  renderSortBtn();
  window.onViewBuilt?.();

  if (!view.length) {
    const empty = activeTab === 'saved' && !activeTags.length
      ? ['🔖', 'Henüz bir şey kaydetmedin. Kartlardaki işaret simgesine dokun.']
      : query ? ['🔎', 'Aramana uyan haber bulunamadı.']
      : activeTags.length || timeRange !== 'all' ? ['🧐', 'Bu filtrelere uyan haber yok. Bir etiketi kaldırmayı ya da zamanı genişletmeyi dene.']
      : ['🌤️', 'Tercihlerine uyan haber yok. İlgi alanlarını genişletebilirsin.'];
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
    if (n === 0 && item.image && !query && !activeTags.length) size = 'hero';
    else if (n % 9 === 5 && item.image && innerWidth > 700) size = 'wide';
    // Akışın arasına "bugün tarihte" kartları
    if ((n === 6 || n === 18) && typeof historyCard === 'function' && (activeTab === 'foryou' || activeTab === 'all') && !activeTags.length && !query && !activeCountry) {
      const h = historyCard(n === 6 ? 0 : 1);
      if (h) frag.appendChild(h);
    }
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

// "7 kaynak · TR + EN" rozeti, kaynakların baş harfleriyle
function storyBadge(item) {
  if (!(item.storySize > 1)) return '';
  const members = storyMap.get(item.storyId) || [];
  const av = members.slice(0, 4).map((m) => `<i style="--cat:${catColor(m.category)}">${esc(m.source[0])}</i>`).join('');
  const langs = (item.storyLangs || []).length > 1 ? ' · 🇹🇷 + 🌍' : '';
  return `<span class="story-badge"><span class="avatars">${av}</span>${item.storySize} kaynak yazdı${langs}</span>`;
}

function cardEl(item, size, idx) {
  const el = document.createElement('article');
  el.className = `card ${size}` + (readSet.has(item.link) ? ' read' : '');
  el.style.setProperty('--cat', catColor(item.category));
  el.dataset.stagger = idx % 6;
  const why = activeTab === 'foryou' ? reasons(item)[0] : '';
  const src = size === 'hero' ? item.image : item.image?.replace('/ace/standard/976/', '/ace/standard/480/');
  const media = item.image
    ? `<div class="card-media"><img alt="" loading="${size === 'hero' ? 'eager' : 'lazy'}" decoding="async" referrerpolicy="no-referrer" src="${esc(src)}"></div>`
    : `<div class="card-media fallback"><span>${esc(item.source)}</span></div>`;
  const tags = item.tags.slice(0, 3).map((t) =>
    `<button class="card-tag${activeTags.includes(t) ? ' on' : ''}${prefs.followTags.includes(t) ? ' followed' : ''}" data-t="${t}">${esc(tagLabel(t))}</button>`).join('');
  el.innerHTML = `
    ${media}
    <button class="save${saved.has(item.link) ? ' on' : ''}" aria-label="Kaydet">
      <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>
    </button>
    <div class="card-body">
      <div class="meta"><span class="cat-pill">${esc(categories[item.category] || item.category)}</span><span class="dot"></span>${esc(item.source)}<span class="dot"></span>${timeAgo(item.date)}</div>
      <h3>${esc(item.title)}</h3>
      ${item.summary ? `<p>${esc(item.summary)}</p>` : ''}
      ${why ? `<span class="match-tag">✦ ${esc(why)}</span>` : ''}
      ${storyBadge(item)}
      ${tags ? `<div class="card-tags">${tags}</div>` : ''}
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
  el.querySelectorAll('.card-tag').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activeTags.includes(b.dataset.t)) toast(`${tagLabel(b.dataset.t)} filtrelendi`);
    toggleActiveTag(b.dataset.t);
  }));
  el.addEventListener('click', () => openSheet(item, el));
  revealObserver.observe(el);
  return el;
}

// ---------- Animasyonlu giriş ve sonsuz kaydırma ----------
const revealObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const el = e.target;
    el.style.transitionDelay = reduceMotion ? '0ms' : `${el.dataset.stagger * 50}ms`;
    el.classList.add('in');
    setTimeout(() => { el.style.transitionDelay = ''; }, 700);
    revealObserver.unobserve(el);
  }
}, { rootMargin: '0px 0px -40px 0px' });

const moreObserver = new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) { moreObserver.disconnect(); renderMore(); }
}, { rootMargin: '800px' });

// ---------- Kaydetme ----------
function toggleSave(item, btn) {
  haptic(12);
  if (saved.has(item.link)) {
    saved.delete(item.link);
    btn?.classList.remove('on');
    toast('Kaydedilenlerden çıkarıldı');
  } else {
    saved.set(item.link, item);
    learn(item, 2);
    if (btn) { btn.classList.add('on'); burst(btn); }
    toast('Kaydedildi 🔖');
  }
  if (btn) { btn.classList.remove('pop'); btn.offsetWidth; btn.classList.add('pop'); }
  saveSaved();
  const tab = $('tabs').querySelector('.tab[data-id="saved"]');
  if (tab) { tab.innerHTML = 'Kaydedilenler' + (saved.size ? `<span class="count">${saved.size}</span>` : ''); moveIndicator(); }
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
let sheetOpenedAt = 0;
// Panel kapanırken (ya da başka habere geçerken) okuma süresine göre öğren
function finishReading() {
  if (!sheetItem) return;
  const dwell = (Date.now() - sheetOpenedAt) / 1000;
  learn(sheetItem, dwell > 20 ? 2.5 : dwell > 6 ? 1 : 0.3);
  logRead(sheetItem, dwell);
  if (typeof bump === 'function') { if (sheetItem.mood === 'good') bump('good'); else checkBadges(); }
}

function otherEyes(item) {
  const members = (storyMap.get(item.storyId) || []).filter((m) => m.link !== item.link);
  if (!members.length) return '';
  const row = (m) => `<button class="eye-row" data-link="${esc(m.link)}"><span class="eye-src" style="--cat:${catColor(m.category)}">${esc(m.source)}</span><span class="eye-title">${esc(m.title)}</span><span class="eye-time">${timeAgo(m.date)}</span></button>`;
  const all = [item, ...members];
  const first = all.reduce((a, b) => (new Date(a.date || 0) < new Date(b.date || 0) ? a : b));
  const tr = members.filter((m) => m.lang === 'tr'), world = members.filter((m) => m.lang !== 'tr');
  return `<section class="eyes">
    <h4>👀 Farklı gözler <span>${all.length} kaynak · ilk ${esc(first.source)} yazdı, ${timeAgo(first.date)}</span></h4>
    ${tr.length ? `<div class="eye-group"><h5>🇹🇷 Türk basını</h5>${tr.map(row).join('')}</div>` : ''}
    ${world.length ? `<div class="eye-group"><h5>🌍 Dünya basını</h5>${world.map(row).join('')}</div>` : ''}
  </section>`;
}

function openSheet(item, card) {
  finishReading();
  sheetItem = item;
  sheetOpenedAt = Date.now();
  if (item.storySize > 1 && typeof bump === 'function') bump('eyes');
  haptic();
  readSet.add(item.link); saveRead();
  setTimeout(() => card?.classList.add('read'), 400);
  const kws = matchedKeywords(item);
  const tags = item.tags.map((t) => `<button class="card-tag${prefs.followTags.includes(t) ? ' followed' : ''}" data-t="${t}">${esc(tagLabel(t))}</button>`).join('');
  $('sheet-body').innerHTML = `
    ${item.image ? `<img class="sheet-img" src="${esc(item.image)}" alt="" referrerpolicy="no-referrer">` : ''}
    <div class="meta" style="--cat:${catColor(item.category)}"><span class="cat-pill">${esc(categories[item.category] || '')}</span><span class="dot"></span>${esc(item.source)}<span class="dot"></span>${timeAgo(item.date)}<span class="dot"></span><span id="read-time">okunuyor…</span></div>
    <h2>${esc(item.title)}</h2>
    ${tags ? `<div class="card-tags sheet-tags">${tags}<span class="hint">Takip etmek için etikete dokun</span></div>` : ''}
    ${kws.length ? `<p class="hint">✦ Takip ettiğin kelime: ${esc(kws.join(', '))}</p>` : ''}
    <div class="sheet-actions">
      <button class="secondary${followed.some((f) => f.id === (item.storyId || item.link)) ? ' on' : ''}" id="sheet-follow">${followed.some((f) => f.id === (item.storyId || item.link)) ? '🔔 Takip ediliyor' : '🔔 Hikayeyi takip et'}</button>
      <button class="secondary" id="sheet-save">${saved.has(item.link) ? 'Kaydedildi ✓' : 'Kaydet'}</button>
      <button class="secondary" id="sheet-share">Paylaş</button>
      <button class="secondary" id="sheet-original">Orijinal sayfa</button>
    </div>
    ${otherEyes(item)}
    <details class="why">
      <summary>Bunu neden görüyorum?</summary>
      <ul>${(reasons(item).length ? reasons(item) : ['Genel akıştan, en yeni haberler arasında']).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <div class="why-actions"><button class="secondary" id="more-like">👍 Daha fazla göster</button><button class="secondary" id="less-like">👎 Daha az göster</button></div>
    </details>
    <div class="article" id="article">
      ${item.summary ? `<p class="lede">${esc(item.summary)}</p>` : ''}
      <div class="article-loading">${'<div class="sk-line shimmer"></div>'.repeat(6)}</div>
    </div>`;
  $('sheet-body').querySelectorAll('.sheet-tags .card-tag').forEach((b) => { b.onclick = () => {
    const t = b.dataset.t;
    const on = !prefs.followTags.includes(t);
    prefs.followTags = on ? [...prefs.followTags, t] : prefs.followTags.filter((x) => x !== t);
    prefs.muteTags = prefs.muteTags.filter((x) => x !== t);
    savePrefs();
    b.classList.toggle('followed', on);
    haptic();
    toast(on ? `${tagLabel(t)} takip ediliyor` : `${tagLabel(t)} takipten çıkarıldı`);
  }; });
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
  $('sheet-original').onclick = () => openOriginal(item.link);
  $('sheet-follow').onclick = (e) => {
    const on = toggleFollow(item);
    e.currentTarget.classList.toggle('on', on);
    e.currentTarget.textContent = on ? '🔔 Takip ediliyor' : '🔔 Hikayeyi takip et';
  };
  $('more-like').onclick = () => { learn(item, 3); haptic(); toast('Bunun gibi haberleri daha çok göreceksin'); };
  $('less-like').onclick = () => { learn(item, -4); haptic(); toast('Bunun gibi haberleri daha az göreceksin'); };
  $('sheet-body').querySelectorAll('.eye-row').forEach((b) => { b.onclick = () => {
    const m = allNews.find((x) => x.link === b.dataset.link);
    if (m) openSheet(m, null);
  }; });
  $('sheet-body').scrollTop = 0;
  $('sheet').style.transform = '';
  $('sheet').classList.add('open');
  $('sheet-backdrop').classList.add('open');
  document.body.classList.add('locked');
  loadArticle(item);
}

// Orijinal sayfa: masaüstü uygulamasında uygulamanın kendi penceresinde açılır
function openOriginal(url) {
  window.open(url, '_blank', 'noopener');
}

async function loadArticle(item) {
  const box = $('article');
  try {
    const res = await fetch('/api/article?url=' + encodeURIComponent(item.link));
    const data = await res.json();
    if (sheetItem !== item) return;
    if (!res.ok) throw new Error(data.error);
    $('read-time').textContent = `${data.minutes} dk okuma`;
    box.innerHTML = data.content;
    box.querySelectorAll('img').forEach((img) => {
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      if (item.image && img.src.split('?')[0] === item.image.split('?')[0]) img.remove();
      img.onerror = () => img.remove();
    });
    box.querySelectorAll('a').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
    box.classList.add('loaded');
  } catch {
    if (sheetItem !== item) return;
    $('read-time').textContent = 'özet';
    box.querySelector('.article-loading')?.remove();
    box.insertAdjacentHTML('beforeend', `<div class="article-fail">Bu haberin tam metni buraya alınamadı.
      <button class="primary" id="fail-original">Orijinal sayfada oku</button></div>`);
    $('fail-original').onclick = () => openOriginal(item.link);
  }
}

function closeSheet() {
  if (!$('sheet').classList.contains('open')) return;
  finishReading();
  $('sheet').classList.remove('open');
  $('sheet').style.transform = '';
  $('sheet-backdrop').classList.remove('open');
  document.body.classList.remove('locked');
  sheetItem = null;
  buildViewIfDirty();
}

// ---------- Gelişen hikayeleri takip ----------
function toggleFollow(item) {
  haptic(12);
  const i = followed.findIndex((f) => f.id === (item.storyId || item.link));
  if (i >= 0) { followed.splice(i, 1); saveFollowed(); toast('Hikaye takibi bırakıldı'); renderTabs(); return false; }
  const members = storyMap.get(item.storyId) || [item];
  followed.unshift({ id: item.storyId || item.link, title: item.title, keys: item.keys || [], created: Date.now(), lastSeen: Date.now(), items: members.map(slim) });
  saveFollowed();
  toast('🔔 Takipte: yeni gelişmeler burada ve bildirimle gelecek');
  if (typeof checkBadges === 'function') checkBadges();
  try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch {}
  renderTabs();
  return true;
}

// Yeni gelen haberleri takip edilen hikayelerle eşleştir (aynı hikaye ya da en az 5 ortak anahtar kelime)
function updateFollowed(notify) {
  const fresh = [];
  for (const st of followed) {
    const have = new Set(st.items.map((i) => i.link));
    const keys = new Set(st.keys.filter((k) => !k.startsWith('#t')));
    for (const i of allNews) {
      if (have.has(i.link)) continue;
      if (new Date(i.date || 0) < st.created - 72 * 3600e3) continue;
      const shared = (i.keys || []).filter((k) => keys.has(k)).length;
      if (i.storyId === st.id || shared >= 5) {
        st.items.push(slim(i)); have.add(i.link);
        if (new Date(i.date || 0) > st.lastSeen) fresh.push([st, i]);
      }
    }
    st.items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }
  saveFollowed();
  if (notify && fresh.length) {
    const [st, i] = fresh[0];
    try { new Notification(`Gelişme: ${st.title.slice(0, 60)}`, { body: `${i.source}: ${i.title}`, silent: false }).onclick = () => { window.focus?.(); openByLink(i.link); }; } catch {}
    toast(`🔔 Takip ettiğin hikayede ${fresh.length} yeni gelişme`);
  }
  return fresh.length;
}

function renderStoriesTab() {
  $('feed').innerHTML = '';
  renderTagStrip([]);
  $('greeting-title').textContent = 'Hikayelerim';
  $('greeting-sub').textContent = followed.length ? `${followed.length} gelişen hikayeyi takip ediyorsun` : '';
  renderSortBtn();
  if (!followed.length) {
    $('feed').innerHTML = `<div class="status"><span class="big-emoji">🔔</span>Henüz bir hikaye takip etmiyorsun. Bir haberi açıp <b>Hikayeyi takip et</b>'e dokun; yeni gelişmeler burada zaman çizelgesi olarak birikir ve bildirim gelir.</div>`;
    return;
  }
  for (const st of followed) {
    const el = document.createElement('article');
    el.className = 'card story-card in';
    const nNew = st.items.filter((i) => new Date(i.date || 0) > st.lastSeen).length;
    el.innerHTML = `
      <div class="card-body">
        <div class="meta"><span class="cat-pill">Gelişen hikaye</span><span class="dot"></span>${st.items.length} haber<span class="dot"></span>son: ${timeAgo(st.items[0]?.date)}${nNew ? `<span class="new-pill">${nNew} yeni</span>` : ''}</div>
        <h3>${esc(st.title)}</h3>
        <ol class="timeline">${st.items.slice(0, 12).map((i) => `
          <li class="${new Date(i.date || 0) > st.lastSeen ? 'is-new' : ''}" data-link="${esc(i.link)}">
            <span class="tl-time">${timeAgo(i.date)}</span>
            <span class="tl-src">${esc(i.source)}</span>
            <span class="tl-title">${esc(i.title)}</span>
          </li>`).join('')}</ol>
        <div class="card-tags"><button class="card-tag unfollow">Takibi bırak</button></div>
      </div>`;
    el.querySelectorAll('.timeline li').forEach((li) => li.onclick = () => openByLink(li.dataset.link, st));
    el.querySelector('.unfollow').onclick = () => { followed.splice(followed.indexOf(st), 1); saveFollowed(); renderTabs(); renderStoriesTab(); };
    $('feed').appendChild(el);
  }
  // Görüldü olarak işaretle (yeni vurgusu bir sonraki açılışta kalkar)
  setTimeout(() => { for (const st of followed) st.lastSeen = Date.now(); saveFollowed(); const t = $('tabs').querySelector('.tab[data-id="stories"]'); if (t) { t.innerHTML = '🔔 Hikayelerim'; moveIndicator(); } }, 1500);
}

// Menü çubuğu ve bildirimlerden haber açmak için
function openByLink(link, story) {
  const it = allNews.find((i) => i.link === link) || story?.items.find((i) => i.link === link) || saved.get(link);
  if (!it) return;
  it._text ||= lower(`${it.title} ${it.summary || ''}`); it.tags ||= [];
  openSheet(it, null);
}
window.openByLink = openByLink;

// Okurken etiket takibi değiştiyse akışı panel kapanınca güncelle
let lastFollow = '';
function buildViewIfDirty() {
  const now = prefs.followTags.join();
  if (now !== lastFollow) { lastFollow = now; const y = scrollY; buildView(); scrollTo({ top: y, behavior: 'instant' }); }
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

// Uygulamanın senin hakkında öğrendikleri: en güçlü eğilimler çubuk grafik olarak
function renderLearned() {
  const box = $('learned');
  const top = Object.entries(aff.tags).filter(([, v]) => v > 0.5).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!top.length) { box.innerHTML = '<p class="hint">Haber okudukça burası dolacak. Neyi açtığını, ne kadar okuduğunu ve neyi kaydettiğini izleyip akışını buna göre ayarlıyorum.</p>'; return; }
  const max = top[0][1];
  box.innerHTML = top.map(([t, v]) => `<div class="bar-row"><span>${esc(tagLabel(t))}</span><i style="--w:${Math.round((v / max) * 100)}%"></i></div>`).join('') +
    '<button class="clear-btn" id="reset-learned">Öğrendiklerini sıfırla</button>';
  $('reset-learned').onclick = () => { aff.tags = {}; aff.cats = {}; aff.srcs = {}; saveAff(); renderLearned(); buildView(); toast('Sıfırlandı, sıfırdan öğreneceğim'); };
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

// Konular: takip et → gizle → sıfırla döngüsü
function topicState(id) {
  return prefs.followTags.includes(id) ? 'follow' : prefs.muteTags.includes(id) ? 'mute' : '';
}
function cycleTopic(id) {
  const st = topicState(id);
  prefs.followTags = prefs.followTags.filter((x) => x !== id);
  prefs.muteTags = prefs.muteTags.filter((x) => x !== id);
  if (st === '') prefs.followTags.push(id);
  else if (st === 'follow') prefs.muteTags.push(id);
  savePrefs();
  haptic();
  return topicState(id);
}

function renderTopics() {
  const q = lower($('topic-search').value || '');
  const counts = new Map();
  for (const i of allNews) for (const t of i.tags) counts.set(t, (counts.get(t) || 0) + 1);
  const box = $('topic-groups');
  box.innerHTML = '';
  for (const [g, gLabel] of Object.entries(tagGroups)) {
    const items = Object.values(tagMap).filter((t) => t.group === g && (!q || lower(t.label).includes(q)));
    if (!items.length) continue;
    const h = document.createElement('h3');
    h.textContent = gLabel;
    const wrap = document.createElement('div');
    wrap.className = 'chips';
    for (const t of items) {
      const b = document.createElement('button');
      const st = topicState(t.id);
      b.className = 'topic' + (st ? ' ' + st : '');
      b.innerHTML = `${t.emoji} ${esc(t.label)}<span class="n">${counts.get(t.id) || 0}</span>`;
      b.onclick = () => {
        const ns = cycleTopic(t.id);
        b.className = 'topic' + (ns ? ' ' + ns : '');
        void b.offsetWidth;
        b.classList.add('bump');
        toast(ns === 'follow' ? `${t.label} takip ediliyor` : ns === 'mute' ? `${t.label} gizlendi` : `${t.label} sıfırlandı`);
        buildView();
      };
      wrap.appendChild(b);
    }
    box.append(h, wrap);
  }
}

function renderSources() {
  const counts = new Map();
  for (const i of allNews) counts.set(i.sourceId, (counts.get(i.sourceId) || 0) + 1);
  const box = $('source-list');
  box.innerHTML = '';
  for (const [lang, label] of Object.entries(LANGS)) {
    const h = document.createElement('h3');
    h.textContent = label;
    box.appendChild(h);
    for (const s of sources.filter((x) => x.lang === lang)) {
      const row = document.createElement('label');
      row.className = 'src-row';
      const on = !prefs.muteSources.includes(s.id);
      row.innerHTML = `<span class="src-dot" style="--cat:${catColor(s.category)}"></span>
        <span class="src-name">${esc(s.name)}<small>${esc(categories[s.category] || '')} · ${counts.get(s.id) || 0} haber</small></span>
        <input type="checkbox" ${on ? 'checked' : ''}><span class="switch"></span>`;
      row.querySelector('input').onchange = (e) => {
        prefs.muteSources = e.target.checked ? prefs.muteSources.filter((x) => x !== s.id) : [...prefs.muteSources, s.id];
        savePrefs(); haptic(); buildView();
      };
      box.appendChild(row);
    }
  }
}

function openDrawer() { renderTopics(); renderSources(); renderLearned(); $('drawer').classList.add('open'); $('drawer-backdrop').classList.add('open'); document.body.classList.add('locked'); }
function closeDrawer() { $('drawer').classList.remove('open'); $('drawer-backdrop').classList.remove('open'); document.body.classList.remove('locked'); }

// ---------- İlk açılış (2 adım) ----------
function showOnboarding() {
  const ob = $('onboard');
  ob.hidden = false;
  const list = $('onboard-cats');
  const next = $('onboard-next');
  list.innerHTML = '';
  for (const [id, label] of Object.entries(categories)) {
    list.appendChild(chip(`${CAT_EMOJI[id] || ''} ${esc(label)}`, prefs.categories.includes(id), catColor(id), (c) => {
      prefs.categories = prefs.categories.includes(id) ? prefs.categories.filter((x) => x !== id) : [...prefs.categories, id];
      c.classList.toggle('on');
      next.disabled = !prefs.categories.length;
      next.textContent = prefs.categories.length ? `Devam (${prefs.categories.length})` : 'Devam';
    }));
  }
  next.disabled = !prefs.categories.length;
  next.onclick = () => {
    $('onboard-step1').hidden = true;
    $('onboard-step2').hidden = false;
    const groups = [...new Set(prefs.categories.flatMap((c) => CAT_GROUPS[c] || []))];
    const tl = $('onboard-tags');
    tl.innerHTML = '';
    for (const t of Object.values(tagMap).filter((x) => groups.includes(x.group))) {
      tl.appendChild(chip(`${t.emoji} ${esc(t.label)}`, prefs.followTags.includes(t.id), null, (c) => {
        prefs.followTags = prefs.followTags.includes(t.id) ? prefs.followTags.filter((x) => x !== t.id) : [...prefs.followTags, t.id];
        c.classList.toggle('on');
      }));
    }
  };
  $('onboard-go').onclick = () => {
    prefs.onboarded = true; savePrefs(); renderPrefs(); buildView();
    lastFollow = prefs.followTags.join();
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
  const res = await fetch('/api/news?limit=3000' + (force ? '&refresh=1' : ''));
  const { items } = await res.json();
  // Arama ve kelime eşleştirmesi için metni bir kez hazırla
  for (const i of items) { i._text = lower(`${i.title} ${i.summary}`); i.tags ||= []; }
  for (const s of saved.values()) { s._text ||= lower(`${s.title} ${s.summary}`); s.tags ||= []; }
  const before = new Set(allNews.map((i) => i.link));
  const fresh = allNews.length ? items.filter((i) => !before.has(i.link)).length : 0;
  applyNews(items);
  buildView();
  return fresh;
}

function applyNews(items) {
  allNews = items;
  storyMap = new Map();
  for (const i of items) if (i.storySize > 1) (storyMap.get(i.storyId) || storyMap.set(i.storyId, []).get(i.storyId)).push(i);
  lastFollow = prefs.followTags.join();
}

// Arka planda 10 dakikada bir yenile; akışı bozmadan üstte "yeni haber" düğmesi göster
setInterval(async () => {
  try {
    const res = await fetch('/api/news?limit=3000&refresh=1');
    const { items } = await res.json();
    for (const i of items) { i._text = lower(`${i.title} ${i.summary}`); i.tags ||= []; }
    const before = new Set(allNews.map((i) => i.link));
    const n = items.filter((i) => !before.has(i.link)).length;
    applyNews(items);
    updateFollowed(true);
    renderTabs();
    if (n) { $('new-pill').textContent = `↑ ${n} yeni haber`; $('new-pill').classList.add('show'); }
  } catch {}
}, 10 * 60 * 1000);

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

  $('time-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    haptic();
    $('time-seg').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    timeRange = b.dataset.v;
    moveSegThumb();
    buildView();
  });
  $('sort-btn').onclick = () => {
    prefs.sort = prefs.sort === 'smart' ? 'new' : 'smart';
    savePrefs(); haptic(); buildView();
  };
  $('tag-strip').addEventListener('click', (e) => {
    const b = e.target.closest('.tag-chip');
    if (b?.dataset.country) { activeCountry = null; haptic(); buildView(); return; }
    if (b) toggleActiveTag(b.dataset.t);
  });
  $('clear-filters').onclick = () => {
    activeTags = []; timeRange = 'all'; query = ''; activeCountry = null; $('search').value = '';
    $('time-seg').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === 'all'));
    moveSegThumb(); haptic(); buildView();
  };

  $('drawer-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    haptic();
    $('drawer-tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.dataset.p === b.dataset.p));
  });
  $('topic-search').addEventListener('input', renderTopics);

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
  $('new-pill').onclick = () => { $('new-pill').classList.remove('show'); window.scrollTo({ top: 0, behavior: 'instant' }); buildView(); };

  // Kaydırma: tek rAF içinde güncelle; kaydırırken üzerine gelme efektlerini kapat (takılmayı önler)
  let ticking = false, scrollTimer;
  const root = document.documentElement;
  addEventListener('scroll', () => {
    if (!root.classList.contains('is-scrolling')) root.classList.add('is-scrolling');
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => root.classList.remove('is-scrolling'), 160);
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      const max = root.scrollHeight - innerHeight;
      $('progress').style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      $('chrome').classList.toggle('scrolled', y > 8);
      $('to-top').classList.toggle('show', y > 900);
      ticking = false;
    });
  }, { passive: true });
  addEventListener('resize', () => { moveIndicator(); moveSegThumb(); });
}

// ---------- Başlat ----------
async function init() {
  bindEvents();
  showSkeletons();
  try {
    const meta = await fetch('/api/meta').then((r) => r.json());
    categories = meta.categories;
    countryMap = Object.fromEntries((meta.countries || []).map((c) => [c.id, c.name]));
    tagGroups = meta.tagGroups || {};
    tagMap = Object.fromEntries((meta.tags || []).map((t) => [t.id, t]));
    sources = meta.sources || [];
    renderTabs();
    renderPrefs();
    moveSegThumb();
    if (!prefs.onboarded) showOnboarding();
    await loadNews();
    if (updateFollowed(true)) renderTabs();
  } catch (err) {
    console.error(err);
    $('feed').innerHTML = '<div class="status"><span class="big-emoji">📡</span>Haberler alınamadı. Sunucu çalışıyor mu?</div>';
  }
  document.fonts?.ready.then(() => { moveIndicator(); moveSegThumb(); });
}
init();
