// Kişisel tercihler tarayıcıda (localStorage) tutulur. İleride kullanıcı hesabına taşınabilir.
const PREFS_KEY = 'haber.prefs';
const LANGS = { tr: 'Türkçe', en: 'İngilizce' };

const loadPrefs = () => {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
};
let prefs = { categories: [], langs: [], keywords: '', ...loadPrefs() };
const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {} };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let categories = {};

function renderChips(el, options, key) {
  el.innerHTML = '';
  for (const [value, label] of Object.entries(options)) {
    const chip = document.createElement('span');
    chip.className = 'chip' + (prefs[key].includes(value) ? ' on' : '');
    chip.textContent = label;
    chip.onclick = () => {
      prefs[key] = prefs[key].includes(value) ? prefs[key].filter((v) => v !== value) : [...prefs[key], value];
      savePrefs(); renderChips(el, options, key); loadNews();
    };
    el.appendChild(chip);
  }
}

function keywordList() {
  return prefs.keywords.split(',').map((k) => k.trim().toLocaleLowerCase('tr')).filter(Boolean);
}

async function loadNews() {
  const params = new URLSearchParams({ limit: '200' });
  if (prefs.categories.length) params.set('categories', prefs.categories.join(','));
  if (prefs.langs.length) params.set('langs', prefs.langs.join(','));
  const q = $('search').value.trim();
  if (q) params.set('q', q);

  const feed = $('feed');
  try {
    const res = await fetch('/api/news?' + params);
    const { items } = await res.json();
    const kws = keywordList();
    const scored = items.map((it) => {
      const text = `${it.title} ${it.summary}`.toLocaleLowerCase('tr');
      return { ...it, score: kws.filter((k) => text.includes(k)).length };
    }).sort((a, b) => b.score - a.score); // eşleşenler üste, gerisi tarih sırasında kalır

    feed.innerHTML = scored.length ? scored.map((it) => `
      <article class="card${it.score ? ' match' : ''}">
        <div class="meta">${esc(it.source)} · ${esc(categories[it.category] || it.category)} · ${it.date ? new Date(it.date).toLocaleString('tr-TR') : ''}</div>
        <a href="${esc(it.link)}" target="_blank" rel="noopener"><h3>${esc(it.title)}</h3></a>
        <p>${esc(it.summary)}</p>
      </article>`).join('') : '<p class="status">Tercihlerine uyan haber bulunamadı.</p>';
  } catch {
    feed.innerHTML = '<p class="status">Haberler alınamadı.</p>';
  }
}

async function init() {
  const meta = await fetch('/api/meta').then((r) => r.json());
  categories = meta.categories;
  renderChips($('cat-list'), categories, 'categories');
  renderChips($('lang-list'), LANGS, 'langs');
  $('keywords').value = prefs.keywords;
  $('keywords').onchange = (e) => { prefs.keywords = e.target.value; savePrefs(); loadNews(); };
  $('toggle-prefs').onclick = () => { $('prefs').hidden = !$('prefs').hidden; };
  let t; $('search').oninput = () => { clearTimeout(t); t = setTimeout(loadNews, 300); };
  loadNews();
}
init();
