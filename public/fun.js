// Haber — okumayı keyifli yapan modlar: story'ler, günlük baskı, günün testi, "Bu başlık kimin?",
// bugün tarihte kartları, iyi haber modu ve rozetler. app.js ve extras.js'teki ortak durumu kullanır.

// ---------- Ortak: istatistik sayaçları, konfeti ----------
const stats = { editions: [], quizDays: [], quizPerfect: 0, kimBest: 0, swipes: 0, eyes: 0, good: 0, ...store.get('haber.stats', {}) };
const saveStats = () => store.set('haber.stats', stats);
function bump(key, n = 1) { stats[key] = (stats[key] || 0) + n; saveStats(); checkBadges(); }
const todayKey = () => new Date().toISOString().slice(0, 10);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function confetti(n = 90) {
  if (reduceMotion) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#ff4d2e', '#ffb02e', '#2f7bff', '#10b981', '#8b5cf6', '#ec4899'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', (Math.random() * 2 - 1) * 160 + 'px');
    p.style.setProperty('--r', Math.random() * 720 + 'deg');
    p.style.animationDelay = Math.random() * 0.25 + 's';
    p.style.animationDuration = 1.4 + Math.random() * 0.9 + 's';
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2600);
}

// Son 24 saatin, gizlenenler hariç, hikaye başına tek haberlik havuzu
function freshPool(hours = 24) {
  const seen = new Set();
  return allNews
    .filter((i) => Date.now() - new Date(i.date || 0) < hours * 3600e3)
    .filter((i) => !prefs.muteSources.includes(i.sourceId) && !i.tags.some((t) => prefs.muteTags.includes(t)) && (!prefs.langs.length || prefs.langs.includes(i.lang)))
    .filter((i) => !i.storyId || !seen.has(i.storyId) && seen.add(i.storyId));
}

// =============== İyi haber modu ===============
let goodOnly = false;
$('good-btn').onclick = () => {
  goodOnly = !goodOnly;
  $('good-btn').classList.toggle('on', goodOnly);
  haptic(12);
  if (goodOnly) { toast('☀️ Sadece iyi haberler'); document.documentElement.classList.add('good-mode'); }
  else document.documentElement.classList.remove('good-mode');
  window.scrollTo({ top: 0, behavior: 'instant' });
  buildView();
};

// =============== Bugün tarihte ===============
let history = [];
fetch('/api/onthisday').then((r) => r.json()).then((d) => { history = d.items || []; }).catch(() => {});
function historyCard(k) {
  const h = history[k];
  if (!h) return null;
  const el = document.createElement('article');
  el.className = 'card history';
  el.dataset.stagger = 2;
  el.innerHTML = `
    ${h.image ? `<div class="card-media"><img alt="" loading="lazy" referrerpolicy="no-referrer" src="${esc(h.image)}"></div>` : ''}
    <div class="card-body">
      <div class="meta"><span class="cat-pill">📜 Bugün tarihte</span><span class="dot"></span>${h.year}</div>
      <div class="ago"><b>${h.ago}</b> yıl önce bugün</div>
      <h3>${esc(h.text)}</h3>
      ${h.link ? '<span class="hint">Vikipedi\'de oku →</span>' : ''}
    </div>`;
  const img = el.querySelector('img');
  if (img) { img.onload = () => img.classList.add('loaded'); img.onerror = () => img.parentElement.remove(); }
  if (h.link) el.onclick = () => openOriginal(h.link);
  revealObserver.observe(el);
  return el;
}

// =============== Story halkaları ===============
const storySeen = store.get('haber.storySeen', {});
if (storySeen.day !== todayKey()) { storySeen.day = todayKey(); storySeen.ids = []; }
const markSeen = (id) => { if (!storySeen.ids.includes(id)) storySeen.ids.push(id); store.set('haber.storySeen', storySeen); };

function storyGroups() {
  const pool = freshPool(24);
  const groups = [];
  const forYou = pool.map((i) => [i, score(i)]).sort((a, b) => b[1] - a[1]).slice(0, 6).map((x) => x[0]);
  if (forYou.length >= 3) groups.push({ id: 'foryou', label: 'Sana Özel', color: 'var(--accent)', items: forYou });
  const cats = Object.keys(categories).sort((a, b) => (aff.cats[b] || 0) - (aff.cats[a] || 0) + (prefs.categories.includes(b) - prefs.categories.includes(a)) * 5);
  for (const c of cats) {
    const items = pool.filter((i) => i.category === c).sort((a, b) => (b.storySize || 1) - (a.storySize || 1) || (!!b.image - !!a.image)).slice(0, 5);
    if (items.length >= 3) groups.push({ id: c, label: categories[c], color: catColor(c), items });
  }
  return groups;
}

function renderRings() {
  const box = $('story-rings');
  const show = (activeTab === 'foryou' || activeTab === 'all') && !activeTags.length && !query && !activeCountry && !goodOnly && allNews.length;
  box.hidden = !show;
  if (!show) return;
  const groups = storyGroups();
  box.innerHTML = groups.map((g, k) => {
    const img = g.items.find((i) => i.image)?.image;
    return `<button class="ring${storySeen.ids.includes(g.id) ? ' seen' : ''}" data-k="${k}" style="--ring:${g.color}; animation-delay:${k * 40}ms">
      <span class="ring-img" ${img ? `style="background-image:url('${esc(img.replace('/ace/standard/976/', '/ace/standard/240/'))}')"` : ''}>${img ? '' : CAT_EMOJI[g.id] || '✦'}</span>
      <span class="ring-label">${esc(g.label)}</span></button>`;
  }).join('');
  box.querySelectorAll('.ring').forEach((b) => { b.onclick = () => { haptic(); openStories(groups, +b.dataset.k); }; });
}

function openStories(groups, gi) {
  let si = 0, timer = null, paused = false, startAt = 0, elapsed = 0;
  const DUR = 7000;
  const { el, close } = overlay('storyview', `
    <div class="sv-bars" id="sv-bars"></div>
    <div class="sv-top"><span class="sv-group" id="sv-group"></span><button class="icon-btn" data-close aria-label="Kapat"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    <div class="sv-stage" id="sv-stage"></div>
    <div class="sv-tap left"></div><div class="sv-tap right"></div>`);
  const stage = el.querySelector('#sv-stage');

  function show() {
    const g = groups[gi], item = g.items[si];
    markSeen(g.id);
    el.querySelector('#sv-group').innerHTML = `<i style="background:${g.color}"></i>${esc(g.label)}`;
    el.querySelector('#sv-bars').innerHTML = g.items.map((_, k) => `<span class="${k < si ? 'done' : ''}"><i></i></span>`).join('');
    stage.innerHTML = `
      <div class="sv-bg" ${item.image ? `style="background-image:url('${esc(item.image)}')"` : `style="background:radial-gradient(120% 90% at 20% 10%, ${catColor(item.category)}, #111 70%)"`}></div>
      <div class="sv-content">
        <div class="meta"><span class="cat-pill" style="--cat:#fff">${esc(categories[item.category] || '')}</span><span class="dot"></span>${esc(item.source)}<span class="dot"></span>${timeAgo(item.date)}</div>
        <h2>${esc(item.title)}</h2>
        <p>${esc(item.summary || '')}</p>
        ${item.storySize > 1 ? `<span class="story-badge">${item.storySize} kaynak yazdı</span>` : ''}
        <button class="primary sv-read">Habere git ↑</button>
      </div>`;
    stage.querySelector('.sv-read').onclick = (e) => { e.stopPropagation(); pause(true); openSheet(item, null); };
    elapsed = 0; startAt = performance.now(); paused = false;
    animate();
  }
  // İlerleme çubuğu: duraklatılınca (basılı tutma ya da haber açıkken) süre işlemez
  function animate() {
    cancelAnimationFrame(timer);
    const bar = el.querySelector(`#sv-bars span:nth-child(${si + 1}) i`);
    const loop = (t) => {
      if (!el.isConnected) return;
      if (!paused && !$('sheet').classList.contains('open')) {
        elapsed += t - startAt;
        const p = Math.min(1, elapsed / DUR);
        if (bar) bar.style.transform = `scaleX(${p})`;
        if (p >= 1) return next();
      }
      startAt = t;
      timer = requestAnimationFrame(loop);
    };
    startAt = performance.now();
    timer = requestAnimationFrame(loop);
  }
  function pause(v) { paused = v; }
  function next() {
    if (si < groups[gi].items.length - 1) { si++; show(); }
    else if (gi < groups.length - 1) { gi++; si = 0; stage.classList.remove('slide'); void stage.offsetWidth; stage.classList.add('slide'); show(); }
    else { close(); }
  }
  function prev() {
    if (si > 0) si--; else if (gi > 0) { gi--; si = 0; }
    show();
  }
  el.querySelector('.sv-tap.left').onclick = prev;
  el.querySelector('.sv-tap.right').onclick = next;
  el.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) pause(true); });
  el.addEventListener('pointerup', () => pause(false));
  const onKey = (e) => {
    if ($('sheet').classList.contains('open')) return;
    if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev(); else if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  el.addEventListener('closed', () => { cancelAnimationFrame(timer); document.removeEventListener('keydown', onKey); renderRings(); });
  show();
}

// =============== Günlük baskı ===============
function editionKey() { const h = new Date().getHours(); return `${todayKey()}-${h < 15 ? 'sabah' : 'aksam'}`; }

function openEdition() {
  const evening = new Date().getHours() >= 15;
  const pool = freshPool(18).map((i) => [i, score(i) + (i.storySize || 1) * 3 + (i.image ? 2 : 0)]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  const perCat = {};
  const picks = [];
  for (const i of pool) { if ((perCat[i.category] || 0) >= 3) continue; perCat[i.category] = (perCat[i.category] || 0) + 1; picks.push(i); if (picks.length >= 11) break; }
  if (picks.length < 4) { toast('Baskı için yeterli haber yok, biraz sonra tekrar dene'); return; }
  const lead = picks.find((i) => i.image) || picks[0];
  const rest = picks.filter((i) => i !== lead);
  const date = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const no = Math.floor((Date.now() - new Date('2026-01-01')) / 864e5) * 2 + (evening ? 2 : 1);
  const story = (i, big) => `
    <article class="ed-story${big ? ' big' : ''}" data-link="${esc(i.link)}">
      ${big && i.image ? `<img src="${esc(i.image)}" alt="" referrerpolicy="no-referrer">` : ''}
      <span class="ed-kicker" style="--cat:${catColor(i.category)}">${esc(categories[i.category] || '')}${i.storySize > 1 ? ` · ${i.storySize} kaynak` : ''}</span>
      <h3>${esc(i.title)}</h3>
      <p>${esc((i.summary || '').slice(0, big ? 260 : 150))}${(i.summary || '').length > (big ? 260 : 150) ? '…' : ''}</p>
      <span class="ed-src">${esc(i.source)} · ${timeAgo(i.date)}</span>
    </article>`;
  const pages = [
    `<div class="ed-mast"><span>${date}</span><h1>HABER</h1><span>${evening ? 'Akşam' : 'Sabah'} Baskısı · Sayı ${no}</span></div>
     <div class="ed-front">${story(lead, true)}<div class="ed-col">${rest.slice(0, 3).map((i) => story(i)).join('')}</div></div>`,
    `<div class="ed-pagehead">HABER · ${date}<span>2</span></div><div class="ed-grid">${rest.slice(3, 7).map((i) => story(i)).join('')}</div>`,
    `<div class="ed-pagehead">HABER · ${date}<span>3</span></div><div class="ed-grid">${rest.slice(7, 10).map((i) => story(i)).join('')}</div>`,
    `<div class="ed-end"><span class="big-emoji">☕</span><h2>Bugünlük bu kadar.</h2><p>Güncelsin. ${picks.length} önemli haberi gözden geçirdin.</p>
      <div class="ed-end-stats"><div><b>${stats.editions.length + 1}</b><span>baskı okudun</span></div><div><b>${new Set(picks.map((p) => p.category)).size}</b><span>farklı alan</span></div><div><b>${picks.reduce((s, p) => s + (p.storySize || 1), 0)}</b><span>kaynaktan derlendi</span></div></div>
      <button class="primary" data-done>Akışa dön</button></div>`,
  ].filter((p, k) => k !== 2 || rest.length > 7);
  let page = 0;
  const { el, close } = overlay('edition', `
    <div class="ov-head"><span class="ov-title">${evening ? '🌙 Akşam' : '☀️ Sabah'} baskısı</span><span class="ed-pager" id="ed-pager"></span>
      <button class="icon-btn" data-close aria-label="Kapat"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    <div class="ed-book" id="ed-book">${pages.map((p, k) => `<section class="ed-page" data-k="${k}">${p}</section>`).join('')}</div>
    <div class="ed-nav"><button class="secondary" data-prev>← Önceki</button><button class="primary" data-next>Sayfayı çevir →</button></div>`);
  const book = el.querySelector('#ed-book');
  const pagesEl = [...book.querySelectorAll('.ed-page')];
  function go(to) {
    if (to < 0 || to >= pagesEl.length || to === page) return;
    haptic();
    const fwd = to > page;
    pagesEl[page].classList.remove('cur'); pagesEl[page].classList.add(fwd ? 'out-left' : 'out-right');
    const nextEl = pagesEl[to];
    nextEl.classList.remove('out-left', 'out-right'); nextEl.classList.add('cur', fwd ? 'in-right' : 'in-left');
    setTimeout(() => nextEl.classList.remove('in-right', 'in-left'), 600);
    page = to;
    update();
    if (page === pagesEl.length - 1 && !stats.editions.includes(editionKey())) { stats.editions.push(editionKey()); saveStats(); checkBadges(); confetti(50); }
  }
  function update() {
    el.querySelector('#ed-pager').textContent = `${page + 1} / ${pagesEl.length}`;
    el.querySelector('[data-prev]').disabled = page === 0;
    el.querySelector('[data-next]').style.visibility = page === pagesEl.length - 1 ? 'hidden' : '';
  }
  pagesEl[0].classList.add('cur');
  update();
  el.querySelector('[data-prev]').onclick = () => go(page - 1);
  el.querySelector('[data-next]').onclick = () => go(page + 1);
  el.querySelector('[data-done]').onclick = close;
  book.addEventListener('click', (e) => {
    const s = e.target.closest('.ed-story');
    if (s) { const it = allNews.find((x) => x.link === s.dataset.link); if (it) openSheet(it, null); }
  });
  const onKey = (e) => { if ($('sheet').classList.contains('open')) return; if (e.key === 'ArrowRight') go(page + 1); else if (e.key === 'ArrowLeft') go(page - 1); else if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  el.addEventListener('closed', () => document.removeEventListener('keydown', onKey));
}

// =============== Günün testi ===============
function buildQuiz() {
  const readLinks = new Set(readLog.filter((r) => Date.now() - r.t < 36 * 3600e3).map((r) => r.link));
  let pool = allNews.filter((i) => readLinks.has(i.link));
  if (pool.length < 6) pool = pool.concat(freshPool(24).sort((a, b) => (b.storySize || 1) - (a.storySize || 1)).slice(0, 30));
  pool = shuffle([...new Set(pool)]);
  const qs = [];
  // 1) Boşluk doldurma: başlıktaki özel ismi bul
  // Başlık Her Kelimesi Büyük yazılmışsa özel isimleri ayırt edemeyiz; o başlıkları atla
  const titleCase = (t) => { const w = t.split(/\s+/).filter((x) => /^\p{L}/u.test(x)); return w.filter((x) => /^\p{Lu}/u.test(x)).length / (w.length || 1) > 0.5; };
  const proper = (t) => titleCase(t) ? [] : t.split(/\s+/).slice(1).map((w) => w.replace(/['’].*$/, '').replace(/[^\p{L}]/gu, '')).filter((w) => w.length >= 4 && /^\p{Lu}/u.test(w) && w !== w.toUpperCase());
  for (const i of pool) {
    const ws = proper(i.title);
    if (!ws.length) continue;
    const ans = ws[0];
    const others = shuffle(allNews.filter((x) => x.lang === i.lang && x !== i).flatMap((x) => proper(x.title)).filter((w) => w !== ans));
    const opts = [...new Set(others)].slice(0, 3);
    if (opts.length < 3) continue;
    qs.push({ type: 'Boşluğu doldur', q: esc(i.title).replace(esc(ans), '<span class="blank">_____</span>'), opts: shuffle([ans, ...opts]), ans, item: i });
    break;
  }
  // 2) Hangi ülke?
  for (const i of pool) {
    if (!i.countries?.length || qs.some((q) => q.item === i)) continue;
    const ans = countryMap[i.countries[0]];
    const opts = shuffle(Object.values(countryMap).filter((c) => !i.countries.map((x) => countryMap[x]).includes(c))).slice(0, 3);
    qs.push({ type: 'Hangi ülkeyle ilgili?', q: esc(i.title).replace(new RegExp(esc(ans), 'gi'), '•••'), opts: shuffle([ans, ...opts]), ans, item: i });
    break;
  }
  // 3) Hangi kaynak?
  for (const i of pool) {
    if (qs.some((q) => q.item === i)) continue;
    const opts = shuffle([...new Set(allNews.filter((x) => x.lang === i.lang && x.source !== i.source).map((x) => x.source))]).slice(0, 3);
    if (opts.length < 3) continue;
    qs.push({ type: 'Bu başlığı hangi kaynak attı?', q: esc(i.title), opts: shuffle([i.source, ...opts]), ans: i.source, item: i });
    break;
  }
  return qs;
}

function openQuiz() {
  const qs = buildQuiz();
  if (qs.length < 3) { toast('Test için biraz daha haber gerekiyor'); return; }
  let k = 0, right = 0;
  const { el, close } = overlay('quizview', `<div class="quiz-card"><div class="ov-head"><span class="ov-title">🧠 Günün testi</span><span class="quiz-step" id="quiz-step"></span><button class="icon-btn" data-close aria-label="Kapat"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div id="quiz-body"></div></div>`);
  const body = el.querySelector('#quiz-body');
  function show() {
    const q = qs[k];
    el.querySelector('#quiz-step').innerHTML = qs.map((_, j) => `<i class="${j < k ? 'done' : j === k ? 'cur' : ''}"></i>`).join('');
    body.innerHTML = `<div class="quiz-q"><span class="quiz-type">${q.type}</span><h3>${q.q}</h3></div>
      <div class="quiz-opts">${q.opts.map((o) => `<button class="quiz-opt">${esc(o)}</button>`).join('')}</div>`;
    body.querySelectorAll('.quiz-opt').forEach((b) => { b.onclick = () => answer(b, q); });
  }
  function answer(b, q) {
    const ok = b.textContent === q.ans;
    body.querySelectorAll('.quiz-opt').forEach((x) => { x.disabled = true; if (x.textContent === q.ans) x.classList.add('right'); });
    if (ok) { right++; haptic(15); b.classList.add('right', 'pop'); } else { haptic(30); b.classList.add('wrong', 'shake'); }
    body.insertAdjacentHTML('beforeend', `<p class="quiz-fb ${ok ? 'ok' : 'no'}">${ok ? 'Doğru! 🎯' : `Doğrusu: <b>${esc(q.ans)}</b>`} <span>· ${esc(q.item.source)}</span></p>`);
    setTimeout(() => { k++; if (k < qs.length) show(); else finish(); }, 1300);
  }
  function finish() {
    const perfect = right === qs.length;
    const first = !stats.quizDays.includes(todayKey());
    if (first) { stats.quizDays.push(todayKey()); if (perfect) stats.quizPerfect++; saveStats(); checkBadges(); }
    let streak = 0; for (let d = new Date(); stats.quizDays.includes(d.toISOString().slice(0, 10)); d.setDate(d.getDate() - 1)) streak++;
    el.querySelector('#quiz-step').innerHTML = '';
    body.innerHTML = `<div class="quiz-end"><span class="big-emoji">${perfect ? '🏆' : right ? '👏' : '📚'}</span>
      <h3>${right} / ${qs.length}</h3><p>${perfect ? 'Kusursuz! Gündemi gerçekten takip ediyorsun.' : right ? 'Fena değil, yarın daha iyisi.' : 'Bugün biraz daha okumaya ne dersin?'}</p>
      <p class="hint">Test serisi: ${streak} gün 🔥</p><button class="primary" data-ok>Tamam</button></div>`;
    body.querySelector('[data-ok]').onclick = close;
    if (perfect) confetti();
  }
  show();
}

// =============== "Bu başlık kimin?" ===============
function openKim() {
  const pool = shuffle(freshPool(36).filter((i) => i.title.length > 30)).slice(0, 10);
  if (pool.length < 5) { toast('Oyun için yeterli haber yok'); return; }
  let k = 0, scoreN = 0, combo = 0, timer = null;
  const TIME = 9000;
  const { el, close } = overlay('kimview', `<div class="quiz-card"><div class="ov-head"><span class="ov-title">🕵️ Bu başlık kimin?</span><span class="kim-score" id="kim-score">0</span><button class="icon-btn" data-close aria-label="Kapat"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div id="kim-body"></div></div>`);
  const body = el.querySelector('#kim-body');
  function show() {
    const i = pool[k];
    const opts = shuffle([i.source, ...shuffle([...new Set(allNews.filter((x) => x.lang === i.lang && x.source !== i.source).map((x) => x.source))]).slice(0, 3)]);
    body.innerHTML = `<div class="kim-timer"><i></i></div>
      <div class="quiz-q"><span class="quiz-type">${k + 1} / ${pool.length}${combo >= 2 ? ` · <b class="combo">${combo}x seri</b>` : ''}</span><h3>${esc(i.title)}</h3></div>
      <div class="quiz-opts">${opts.map((o) => `<button class="quiz-opt">${esc(o)}</button>`).join('')}</div>`;
    const bar = body.querySelector('.kim-timer i');
    bar.style.animationDuration = TIME + 'ms';
    const t0 = performance.now();
    clearTimeout(timer);
    timer = setTimeout(() => answer(null, i, t0), TIME);
    body.querySelectorAll('.quiz-opt').forEach((b) => { b.onclick = () => answer(b, i, t0); });
  }
  function answer(b, i, t0) {
    clearTimeout(timer);
    body.querySelector('.kim-timer i').style.animationPlayState = 'paused';
    const ok = b && b.textContent === i.source;
    body.querySelectorAll('.quiz-opt').forEach((x) => { x.disabled = true; if (x.textContent === i.source) x.classList.add('right'); });
    if (ok) {
      combo++;
      const pts = Math.round((100 + Math.max(0, TIME - (performance.now() - t0)) / 20) * (combo >= 3 ? 2 : 1));
      scoreN += pts; haptic(15);
      b.classList.add('right', 'pop');
      body.insertAdjacentHTML('beforeend', `<span class="pts">+${pts}</span>`);
    } else { combo = 0; haptic(30); b?.classList.add('wrong', 'shake'); }
    const sc = el.querySelector('#kim-score'); sc.textContent = scoreN; sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump');
    setTimeout(() => { k++; if (k < pool.length) show(); else finish(); }, 1000);
  }
  function finish() {
    const best = scoreN > (stats.kimBest || 0);
    if (best) { stats.kimBest = scoreN; saveStats(); checkBadges(); confetti(); }
    body.innerHTML = `<div class="quiz-end"><span class="big-emoji">${best ? '🥇' : '🕵️'}</span><h3>${scoreN} puan</h3>
      <p>${best ? 'Yeni rekor!' : `Rekorun: ${stats.kimBest}`}</p><div class="quiz-actions"><button class="secondary" data-again>Tekrar oyna</button><button class="primary" data-ok>Tamam</button></div></div>`;
    body.querySelector('[data-ok]').onclick = close;
    body.querySelector('[data-again]').onclick = () => { close(); setTimeout(openKim, 380); };
  }
  el.addEventListener('closed', () => clearTimeout(timer));
  show();
}

// =============== Rozetler ===============
const BADGES = [
  ['first', '👣', 'İlk adım', 'İlk haberini oku', () => [readLog.length, 1]],
  ['curious', '🧐', 'Meraklı', '25 haber oku', () => [readLog.length, 25]],
  ['bookworm', '📚', 'Haber kurdu', '150 haber oku', () => [readLog.length, 150]],
  ['traveler', '🧳', 'Gezgin', '10 farklı ülkeden haber oku', () => [new Set(readLog.flatMap((r) => r.countries || [])).size, 10]],
  ['citizen', '🌍', 'Dünya vatandaşı', '30 farklı ülkeden haber oku', () => [new Set(readLog.flatMap((r) => r.countries || [])).size, 30]],
  ['explorer', '🧭', 'Kâşif', '25 farklı konuda haber oku', () => [new Set(readLog.flatMap((r) => r.tags || [])).size, 25]],
  ['streak3', '🔥', 'Isınıyor', '3 gün üst üste oku', () => [readStreak(), 3]],
  ['streak7', '⚡', 'Alışkanlık', '7 gün üst üste oku', () => [readStreak(), 7]],
  ['early', '🌅', 'Erkenci kuş', "Sabah 7'den önce haber oku", () => [readLog.some((r) => new Date(r.t).getHours() < 7) ? 1 : 0, 1]],
  ['night', '🦉', 'Gece kuşu', 'Gece yarısından sonra haber oku', () => [readLog.some((r) => { const h = new Date(r.t).getHours(); return h >= 0 && h < 4; }) ? 1 : 0, 1]],
  ['eyes', '👀', 'Farklı gözler', '10 kez aynı olayı farklı kaynaklardan karşılaştır', () => [stats.eyes || 0, 10]],
  ['detective', '🔎', 'Dedektif', '3 gelişen hikayeyi takip et', () => [followed.length, 3]],
  ['sorter', '🃏', 'Ayıklama ustası', '100 kartı kaydırarak ayıkla', () => [stats.swipes || 0, 100]],
  ['genius', '🧠', 'Gündem dehası', 'Günün testini 3 kez kusursuz bitir', () => [stats.quizPerfect || 0, 3]],
  ['reader', '🗞️', 'Baskı okuru', '5 günlük baskıyı sonuna kadar oku', () => [stats.editions.length, 5]],
  ['optimist', '☀️', 'İyimser', '10 iyi haber oku', () => [stats.good || 0, 10]],
  ['speed', '🏎️', 'Hız canavarı', '"Bu başlık kimin?" oyununda 1500 puan yap', () => [stats.kimBest || 0, 1500]],
];
function readStreak() {
  const days = new Set(readLog.map((r) => new Date(r.t).toDateString()));
  let n = 0; for (let d = new Date(); days.has(d.toDateString()); d.setDate(d.getDate() - 1)) n++;
  return n;
}
const unlocked = new Set(store.get('haber.badges', []));
function checkBadges() {
  const fresh = BADGES.filter(([id, , , , f]) => { const [v, goal] = f(); return v >= goal && !unlocked.has(id); });
  for (const [id, emoji, name] of fresh) {
    unlocked.add(id);
    setTimeout(() => {
      const t = document.createElement('div');
      t.className = 'badge-toast';
      t.innerHTML = `<span>${emoji}</span><div><small>Yeni rozet!</small><b>${esc(name)}</b></div>`;
      document.body.appendChild(t);
      confetti(60); haptic(20);
      setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3000);
    }, 400);
  }
  if (fresh.length) store.set('haber.badges', [...unlocked]);
}
function openBadges() {
  const { el } = overlay('badgeview', `<div class="quiz-card wide"><div class="ov-head"><span class="ov-title">🏅 Rozetlerin</span><span class="map-sub">${unlocked.size} / ${BADGES.length}</span><button class="icon-btn" data-close aria-label="Kapat"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    <div class="badges">${BADGES.map(([id, emoji, name, desc, f], k) => {
      const [v, goal] = f(); const on = unlocked.has(id);
      return `<div class="badge${on ? ' on' : ''}" style="animation-delay:${k * 30}ms"><span class="b-emoji">${emoji}</span><b>${esc(name)}</b><small>${esc(desc)}</small>${on ? '<em>Kazanıldı ✓</em>' : `<i class="b-prog"><i style="width:${Math.min(100, Math.round((v / goal) * 100))}%"></i></i><em>${Math.min(v, goal)} / ${goal}</em>`}</div>`;
    }).join('')}</div></div>`);
  el.addEventListener('click', (e) => { if (e.target === el) el.querySelector('[data-close]').click(); });
}

// =============== Keşfet menüsü ===============
function openFun() {
  const pop = $('fun-pop');
  const open = pop.classList.toggle('open');
  haptic();
  if (!open) return;
  const evening = new Date().getHours() >= 15;
  const edDone = stats.editions.includes(editionKey());
  const quizDone = stats.quizDays.includes(todayKey());
  pop.innerHTML = [
    ['edition', evening ? '🌙' : '☀️', `${evening ? 'Akşam' : 'Sabah'} baskısı`, edDone ? 'Okundu ✓' : 'Gazete gibi, biten bir özet'],
    ['quiz', '🧠', 'Günün testi', quizDone ? 'Bugün çözüldü ✓' : '3 soru, 1 dakika'],
    ['kim', '🕵️', 'Bu başlık kimin?', `Rekor: ${stats.kimBest || 0}`],
    ['badges', '🏅', 'Rozetlerin', `${unlocked.size} / ${BADGES.length}`],
    ['swipe', '🃏', 'Hızlı ayıkla', 'Kaydır, ayıkla'],
    ['week', '📊', 'Haftan', 'Okuma özetin'],
  ].map(([id, e, t, d], k) => `<button class="fun-tile" data-f="${id}" style="animation-delay:${k * 35}ms"><span>${e}</span><b>${t}</b><small>${d}</small></button>`).join('');
  // Keşif atölyesi (labs.js): beş mekanik, her biri tek dokunuşla açılır
  if (window.LABS) {
    const seen = new Set(store.get('haber.labsSeen', []));
    pop.insertAdjacentHTML('afterbegin', '<div class="fun-sec">Gazete ve oyunlar</div>');
    // Sesli bülten menünün en üstünde, tek dokunuşla
    const feat = window.LABS.find((l) => l.id === 'bulletin');
    if (feat) pop.insertAdjacentHTML('afterbegin', `<button class="fun-tile lab feature" data-lab="${feat.id}"><span>${feat.emoji}</span><div><b>${feat.title}</b><small>${esc(evening ? 'Akşam bülteni, 3 dakikada dinle' : 'Sabah bülteni, 3 dakikada dinle')}</small></div>${seen.has(feat.id) ? '' : '<em class="new-tag">Yeni</em>'}</button>`);
    const rest = window.LABS.filter((l) => l !== feat);
    let group = '';
    const sizes = {};
    rest.forEach((l) => { sizes[l.group] = (sizes[l.group] || 0) + 1; });
    const done = {};
    pop.insertAdjacentHTML('beforeend', rest.map((l, k) => {
      const head = l.group && l.group !== group ? `<div class="fun-sec">${l.group}</div>` : '';
      group = l.group || group;
      done[l.group] = (done[l.group] || 0) + 1;
      const wide = sizes[l.group] % 2 && done[l.group] === sizes[l.group] ? ' wide' : '';
      return `${head}<button class="fun-tile lab${wide}" data-lab="${l.id}" style="animation-delay:${(k + 6) * 30}ms"><span>${l.emoji}</span><b>${l.title}</b><small>${esc(l.sub())}</small>${seen.has(l.id) ? '' : '<em class="new-tag">Yeni</em>'}</button>`;
    }).join(''));
  }
}
$('open-fun').onclick = (e) => { e.stopPropagation(); $('open-fun').classList.remove('has-new'); openFun(); };
$('fun-pop').addEventListener('click', (e) => {
  const b = e.target.closest('.fun-tile');
  if (!b) return;
  $('fun-pop').classList.remove('open');
  if (b.dataset.lab) return window.openLab(b.dataset.lab);
  ({ edition: openEdition, quiz: openQuiz, kim: openKim, badges: openBadges, swipe: openSwipe, week: openWeek })[b.dataset.f]();
});
document.addEventListener('click', (e) => { if (!e.target.closest('#fun-pop')) $('fun-pop').classList.remove('open'); });

// Akış her yeniden çizildiğinde story halkalarını güncelle
window.onViewBuilt = renderRings;
renderRings();
checkBadges();
