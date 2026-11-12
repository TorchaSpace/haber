// Haber — Keşif atölyesi: Keşfet menüsünden tek dokunuşla açılan beş mekanik.
// 1) Sonucu tahmin et  2) Zaman makinesi  3) Kelime avı  4) Görüş haritası  5) Konu tuvali
// app.js, extras.js ve fun.js'teki ortak durumu (allNews, prefs, overlay, freshPool, stats…) kullanır.

const labSeen = new Set(store.get('haber.labsSeen', []));
const CLOSE_SVG = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const lc = (s) => String(s || '').toLocaleLowerCase('tr');

// Mekaniklerin tek listesi: Keşfet menüsü ve ilk kullanım yönlendirmesi buradan beslenir
const LABS = [
  { id: 'predict', emoji: '🔮', title: 'Sonucu tahmin et', sub: () => stats.predictBest ? `Rekor: ${stats.predictBest} / 5` : 'Başlığı görmeden bil',
    steps: [['🙈', 'Başlığın önemli kısmı gizli; sadece kimin ve neyin konuşulduğunu görürsün.'], ['🤔', 'Sence iyi mi bitti, kötü mü? Bir tahmin seç.'], ['✨', 'Başlık açılır, tahminini gerçekle karşılaştırırsın.']] },
  { id: 'timemachine', emoji: '⏳', title: 'Zaman makinesi', sub: () => 'Dün ve bugün yan yana',
    steps: [['🏷️', 'Bir konu seç.'], ['🕰️', 'Ne kadar geriye gideceğini seç: 1, 5 ya da 10 yıl.'], ['🔍', 'O zamanki ve bugünkü başlıkları yan yana gör, neyin değiştiğini fark et.']] },
  { id: 'words', emoji: '🔤', title: 'Kelime avı', sub: () => { const n = store.get('haber.wordbook', []).length; return n ? `Defterinde ${n} kelime` : 'Boşluğu doldur, öğren'; },
    steps: [['📰', 'Gerçek bir başlıkta önemli bir terim boşlukta.'], ['⌨️', 'Harflere dokunarak (ya da klavyeyle) kelimeyi tamamla.'], ['📘', 'Doğru bilince terimin kısa açıklaması çıkar ve defterine eklenir.']] },
  { id: 'opinion', emoji: '🧭', title: 'Görüş haritası', sub: () => 'Hangi gözle okuyorsun?',
    steps: [['📍', 'Okuduğun her kaynak haritada bir baloncuk.'], ['↔️', 'Sol yerel basın, sağ dünya basını; yukarısı iyimser, aşağısı kötümser.'], ['⭐', 'Yıldız senin merkezin. Altta seni dengeleyecek farklı bir göz önerilir.']] },
  { id: 'canvas', emoji: '🧩', title: 'Konu tuvali', sub: () => 'İlgi alanların, bağlarıyla',
    steps: [['🃏', 'Her kart bir ilgi alanın. Sürükleyip istediğin gibi diz.'], ['🔗', 'Çizgiler, iki konunun bugün aynı haberlerde buluştuğunu gösterir; sayıya dokun.'], ['➕', 'Bir karta dokununca o konunun haberleri açılır. Alttan yeni konu eklersin.']] },
];

// İlk kullanımda kısa yönlendirme; başlıktaki "?" ile tekrar açılır
function coach(el, lab, force = false) {
  if (!force && labSeen.has(lab.id)) return;
  const c = document.createElement('div');
  c.className = 'coach';
  c.innerHTML = `<div class="coach-card"><span class="big-emoji">${lab.emoji}</span><h3>${esc(lab.title)}</h3>
    <ol>${lab.steps.map(([e, t]) => `<li><span>${e}</span>${esc(t)}</li>`).join('')}</ol>
    <button class="primary" data-go>${force ? 'Tamam' : 'Anladım, başla'}</button></div>`;
  el.appendChild(c);
  const go = () => { c.classList.add('out'); setTimeout(() => c.remove(), 300); labSeen.add(lab.id); store.set('haber.labsSeen', [...labSeen]); };
  c.querySelector('[data-go]').onclick = go;
  c.querySelector('[data-go]').focus();
}

// Ortak kabuk: kart ya da tam ekran, başlık, yardım ve kapat düğmesi
function labShell(id, { wide = false, full = false, extra = '' } = {}) {
  const lab = LABS.find((l) => l.id === id);
  const head = `<div class="ov-head"><span class="ov-title">${lab.emoji} ${esc(lab.title)}</span>${extra}
    <button class="icon-btn lab-help" data-help aria-label="Nasıl çalışır?">?</button>
    <button class="icon-btn" data-close aria-label="Kapat">${CLOSE_SVG}</button></div>`;
  const o = full
    ? overlay(`labview full lab-${id}`, `${head}<div class="lab-body" id="lab-body"></div>`)
    : overlay(`labview lab-${id}`, `<div class="quiz-card${wide ? ' wide' : ''}">${head}<div class="lab-body" id="lab-body"></div></div>`);
  o.body = o.el.querySelector('#lab-body');
  o.el.querySelector('[data-help]').onclick = () => coach(full ? o.el : o.el.querySelector('.quiz-card'), lab, true);
  if (!full) o.el.addEventListener('click', (e) => { if (e.target === o.el) o.close(); });
  const onKey = (e) => { if (e.key === 'Escape' && !$('sheet').classList.contains('open') && !document.activeElement?.matches('input')) o.close(); };
  document.addEventListener('keydown', onKey);
  o.el.addEventListener('closed', () => document.removeEventListener('keydown', onKey));
  setTimeout(() => coach(full ? o.el : o.el.querySelector('.quiz-card'), lab), 250);
  return o;
}

// Akışı bir konuya / aramaya göre süzüp açar (tuval ve harita buradan akışa döner)
function goFeed({ tags = [], q = '' }, close) {
  close?.();
  activeCountry = null; activeTags = tags; query = q; $('search').value = q;
  if (activeTab === 'stories' || activeTab === 'saved') selectTab('all');
  else { window.scrollTo({ top: 0, behavior: 'instant' }); buildView(); }
}

// =============== 1) Sonucu tahmin et ===============
const MOODS = { good: ['🙂', 'İyi haber'], neutral: ['😐', 'Ne iyi ne kötü'], bad: ['😟', 'Kötü haber'] };

// Başlığı maskeler: kim/ne (özel isimler, etiket kelimeleri) görünür, olanı anlatan kısım gizli
function maskTitle(item) {
  const terms = item.tags.flatMap((t) => tagMap[t]?.terms || []).map(lc).filter((t) => t.length > 3);
  const words = item.title.split(/\s+/);
  const titleCase = words.filter((w) => /^\p{Lu}/u.test(w)).length / words.length > 0.6;
  let shown = 0;
  return words.map((w, k) => {
    const bare = w.replace(/[^\p{L}\p{N}]/gu, '');
    const isTerm = terms.some((t) => lc(bare).startsWith(t.split(' ')[0]));
    const proper = !titleCase && /^\p{Lu}/u.test(bare) && (k > 0 || bare.length > 3);
    const keep = bare.length && (isTerm || proper || (titleCase && k < 2)) && shown < Math.ceil(words.length / 2);
    if (keep) { shown++; return `<span class="mk-w">${esc(w)}</span>`; }
    return `<span class="mk-h" data-w="${esc(w)}">${'█'.repeat(Math.min(10, Math.max(2, bare.length)))}</span>`;
  }).join(' ');
}

function openPredict() {
  const pool = freshPool(48).filter((i) => i.title.length > 35 && i.tags.length);
  const pick = [...shuffle(pool.filter((i) => i.mood === 'bad')).slice(0, 2), ...shuffle(pool.filter((i) => i.mood === 'good')).slice(0, 2), ...shuffle(pool.filter((i) => i.mood === 'neutral')).slice(0, 1)];
  const rounds = shuffle(pick.length >= 5 ? pick : shuffle(pool).slice(0, 5));
  if (rounds.length < 3) { toast('Tahmin oyunu için biraz daha haber gerekiyor'); return; }
  let k = 0, right = 0;
  const { el, body, close } = labShell('predict', { extra: '<span class="quiz-step" id="pr-step"></span>' });
  function show() {
    const i = rounds[k];
    el.querySelector('#pr-step').innerHTML = rounds.map((_, j) => `<i class="${j < k ? 'done' : j === k ? 'cur' : ''}"></i>`).join('');
    const tagNames = i.tags.slice(0, 3).map((t) => tagMap[t]?.label);
    const clues = [
      ...i.tags.slice(0, 3).map((t) => tagLabel(t)),
      ...(i.countries || []).slice(0, 2).filter((c) => countryMap[c] && !tagNames.includes(countryMap[c])).map((c) => `📍 ${countryMap[c]}`),
    ];
    body.innerHTML = `<div class="pr-card">
        ${i.image ? `<div class="pr-img" style="background-image:url('${esc(i.image)}')"></div>` : ''}
        <div class="pr-meta"><span class="cat-pill" style="--cat:${catColor(i.category)}">${esc(categories[i.category] || '')}</span>${esc(i.source)} · ${timeAgo(i.date)}${i.storySize > 1 ? ` · ${i.storySize} kaynak yazdı` : ''}</div>
        <h3 class="pr-title">${maskTitle(i)}</h3>
        <div class="pr-clues">${clues.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
      </div>
      <p class="pr-ask">Sence nasıl sonuçlandı?</p>
      <div class="pr-opts">${Object.entries(MOODS).map(([m, [e, t]]) => `<button class="quiz-opt pr-opt" data-m="${m}"><span>${e}</span>${t}</button>`).join('')}</div>`;
    body.querySelectorAll('.pr-opt').forEach((b) => { b.onclick = () => answer(b, i); });
  }
  function answer(b, i) {
    const truth = i.mood || 'neutral';
    const ok = b.dataset.m === truth;
    if (ok) { right++; haptic(15); b.classList.add('right', 'pop'); } else { haptic(30); b.classList.add('wrong', 'shake'); }
    body.querySelectorAll('.pr-opt').forEach((x) => { x.disabled = true; if (x.dataset.m === truth) x.classList.add('right'); });
    body.querySelector('.pr-img')?.classList.add('clear');
    body.querySelectorAll('.mk-h').forEach((h, n) => setTimeout(() => { h.textContent = h.dataset.w; h.classList.add('open'); }, n * 45));
    body.insertAdjacentHTML('beforeend', `<div class="pr-fb ${ok ? 'ok' : 'no'}">
      <div><small>Senin tahminin</small><b>${MOODS[b.dataset.m].join(' ')}</b></div><span class="pr-vs">${ok ? '=' : '≠'}</span>
      <div><small>Gerçekte</small><b>${MOODS[truth].join(' ')}</b></div></div>
      <div class="quiz-actions pr-next"><button class="secondary" data-read>Haberi oku</button><button class="primary" data-next>${k < rounds.length - 1 ? 'Sıradaki →' : 'Sonucu gör'}</button></div>`);
    body.querySelector('[data-read]').onclick = () => openSheet(i, null);
    body.querySelector('[data-next]').onclick = () => { k++; k < rounds.length ? show() : finish(); };
    body.querySelector('[data-next]').focus();
  }
  function finish() {
    const best = right > (stats.predictBest || 0);
    stats.predictGames = (stats.predictGames || 0) + 1; stats.predictRight = (stats.predictRight || 0) + right;
    if (best) stats.predictBest = right;
    saveStats();
    const rate = Math.round((stats.predictRight / (stats.predictGames * rounds.length)) * 100);
    el.querySelector('#pr-step').innerHTML = '';
    body.innerHTML = `<div class="quiz-end"><span class="big-emoji">${right >= 4 ? '🔮' : right >= 2 ? '🤔' : '🙈'}</span><h3>${right} / ${rounds.length}</h3>
      <p>${right >= 4 ? 'Sezgilerin çok güçlü!' : right >= 2 ? 'Fena değil, gündemi seziyorsun.' : 'Haberler bazen hiç beklemediğin yerden gelir.'}</p>
      <p class="hint">Genel isabetin: %${rate}${best ? ' · Yeni rekor!' : ''}</p>
      <div class="quiz-actions"><button class="secondary" data-again>Tekrar oyna</button><button class="primary" data-ok>Tamam</button></div></div>`;
    body.querySelector('[data-ok]').onclick = close;
    body.querySelector('[data-again]').onclick = () => { close(); setTimeout(openPredict, 380); };
    if (right === rounds.length) confetti();
  }
  show();
}

// =============== 2) Zaman makinesi ===============
const STOPW = new Set(`a an the and or but of to in on at for from by with as is are was were be been it its this that has have had will would can could not no new says said after over into about than more his her their they he she we you who what when how why which also just
ve ile bir bu şu o da de ki mi mu mı için gibi daha çok en ama veya ya ise olan olarak oldu sonra önce kadar göre yeni son ilk iki üç yıl gün nasıl neden ne kim her tüm var yok bugün dün karşı arasında haber haberi açıkladı dedi büyük`.split(/\s+/));
const wordsOf = (titles, skip) => {
  const m = new Map();
  for (const t of titles) for (const w of new Set(lc(t).split(/[^\p{L}\p{N}]+/u))) if (w.length > 3 && !STOPW.has(w) && !skip.some((s) => w.startsWith(s)) && !/^\d+$/.test(w)) m.set(w, (m.get(w) || 0) + 1);
  return m;
};

function timeTopics() {
  const counts = new Map();
  for (const i of freshPool(72)) for (const t of i.tags) counts.set(t, (counts.get(t) || 0) + 1);
  const mine = [...prefs.followTags, ...Object.entries(aff.tags).filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]).map(([t]) => t)];
  const trending = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  return [...new Set([...mine, ...trending])].filter((t) => tagMap[t] && (counts.get(t) || 0) >= 2 && tagMap[t].group !== 'bolge').slice(0, 10);
}

function openTimeMachine() {
  const topics = timeTopics();
  if (!topics.length) { toast('Zaman makinesi için biraz daha haber gerekiyor'); return; }
  const lang = prefs.langs.length === 1 ? prefs.langs[0] : 'tr';
  let topic = topics[0], ago = 5;
  const { el, body } = labShell('timemachine', { wide: true });
  body.innerHTML = `
    <div class="tm-topics" id="tm-topics">${topics.map((t) => `<button class="tag-chip${t === topic ? ' on' : ''}" data-t="${t}">${esc(tagLabel(t))}</button>`).join('')}</div>
    <div class="seg tm-dial" id="tm-dial" role="radiogroup" aria-label="Ne kadar geriye"><span class="seg-thumb"></span>
      ${[10, 5, 1].map((y) => `<button data-y="${y}" class="${y === ago ? 'on' : ''}">${y} yıl önce</button>`).join('')}</div>
    <div class="tm-cols"><section class="tm-col past" id="tm-past"></section><div class="tm-arrow">→</div><section class="tm-col now" id="tm-now"></section></div>
    <div class="tm-diff" id="tm-diff"></div>`;
  const thumb = () => {
    const seg = el.querySelector('#tm-dial'), on = seg.querySelector('button.on'), th = seg.querySelector('.seg-thumb');
    th.style.width = on.offsetWidth + 'px'; th.style.transform = `translateX(${on.offsetLeft - 3}px)`;
  };
  requestAnimationFrame(thumb);
  const row = (i, k) => `<button class="tm-item" style="animation-delay:${k * 50}ms" data-link="${esc(i.link)}"><b>${esc(i.title)}</b><small>${esc(i.source)}${i.date ? ' · ' + new Date(i.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</small></button>`;
  let token = 0;
  async function load() {
    const my = ++token;
    const seenStory = new Set();
    const now = allNews.filter((i) => i.tags.includes(topic) && (!i.storyId || !seenStory.has(i.storyId) && seenStory.add(i.storyId))).slice(0, 5);
    const year = new Date().getFullYear() - ago;
    el.querySelector('#tm-now').innerHTML = `<h4><span>Bugün</span>${new Date().getFullYear()}</h4>${now.map(row).join('')}`;
    el.querySelector('#tm-past').innerHTML = `<h4><span>${ago} yıl önce</span>${year}</h4><div class="tm-loading"><i></i><i></i><i></i></div>`;
    el.querySelector('#tm-diff').innerHTML = '';
    const q = (tagMap[topic]?.label || topic).split(/\s*[&,]\s*/)[0];
    let past = [];
    try { past = (await fetch(`/api/past?q=${encodeURIComponent(q)}&ago=${ago}&lang=${lang}`).then((r) => r.json())).items || []; } catch {}
    if (my !== token) return;
    el.querySelector('#tm-past').innerHTML = `<h4><span>${ago} yıl önce</span>${year}</h4>` + (past.length ? past.slice(0, 5).map(row).join('')
      : '<p class="hint tm-empty">O yıla ait arşive şu an ulaşılamadı. İnternet bağlantını kontrol edip başka bir yıl dene.</p>');
    el.querySelectorAll('.tm-item').forEach((b) => {
      b.onclick = () => { const it = allNews.find((x) => x.link === b.dataset.link); it ? openSheet(it, null) : openOriginal(b.dataset.link); };
    });
    if (past.length && now.length) {
      const skip = q.split(/\s+/).map((w) => lc(w).slice(0, 5));
      const then = wordsOf(past.map((p) => p.title), skip), today = wordsOf(now.map((p) => p.title), skip);
      const only = (a, b) => [...a.entries()].filter(([w]) => !b.has(w)).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([w]) => w);
      const gone = only(then, today), fresh = only(today, then);
      el.querySelector('#tm-diff').innerHTML = `<h4>Ne değişti?</h4>
        <div class="tm-words"><div><small>O zaman konuşulan</small>${gone.map((w) => `<span class="old">${esc(w)}</span>`).join('') || '<em>—</em>'}</div>
        <div><small>Bugün konuşulan</small>${fresh.map((w) => `<span class="new">${esc(w)}</span>`).join('') || '<em>—</em>'}</div></div>`;
    }
  }
  el.querySelector('#tm-topics').onclick = (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    topic = b.dataset.t; haptic();
    el.querySelectorAll('#tm-topics .tag-chip').forEach((x) => x.classList.toggle('on', x === b));
    load();
  };
  el.querySelector('#tm-dial').onclick = (e) => {
    const b = e.target.closest('[data-y]'); if (!b) return;
    ago = +b.dataset.y; haptic();
    el.querySelectorAll('#tm-dial button').forEach((x) => x.classList.toggle('on', x === b));
    thumb(); load();
  };
  load();
}

// =============== 3) Kelime avı ===============
const LEARN_GROUPS = ['konu', 'ekonomi', 'bilim', 'teknoloji', 'kultur'];
function wordRounds() {
  const terms = Object.values(tagMap).filter((t) => LEARN_GROUPS.includes(t.group))
    .flatMap((t) => (t.terms || []).filter((w) => w.length >= 5 && /^[\p{L} ]+$/u.test(w)).map((w) => ({ w, tag: t })));
  const out = [], used = new Set();
  for (const i of shuffle(freshPool(72))) {
    const low = lc(i.title);
    for (const { w, tag } of shuffle(terms.filter((x) => i.tags.includes(x.tag.id)))) {
      // Türkçede ek alabilir (enflasyonun), İngilizcede kelime tam olmalı (intel ≠ intelligence)
      const tail = i.lang === 'en' ? '(?:s|es)?(?![\\p{L}])' : '\\p{L}{0,5}(?![\\p{L}])';
      const at = low.search(new RegExp(`(?<![\\p{L}])${w.toLocaleLowerCase('tr').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${tail}`, 'u'));
      if (at < 0 || used.has(w)) continue;
      used.add(w);
      out.push({ item: i, at, ans: i.title.slice(at, at + w.length), term: w, tag });
      break;
    }
    if (out.length >= 5) break;
  }
  return out;
}

async function wikiSummary(term, lang) {
  const tryOne = async (l, t) => {
    const r = await fetch(`https://${l}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const d = await r.json();
    return d.type === 'standard' && d.extract ? { text: d.extract, link: d.content_urls?.desktop?.page } : null;
  };
  const cap = term.charAt(0).toLocaleUpperCase(lang === 'en' ? 'en' : 'tr') + term.slice(1);
  try { return (await tryOne(lang, cap)) || (lang !== 'tr' ? null : await tryOne('en', cap)); } catch { return null; }
}

function openWords() {
  const rounds = wordRounds();
  if (rounds.length < 2) { toast('Kelime avı için biraz daha haber gerekiyor'); return; }
  let k = 0, stars = 0;
  const book = store.get('haber.wordbook', []);
  const { el, body, close } = labShell('words', { extra: '<span class="quiz-step" id="wd-step"></span>' });
  let onKey = null;
  function show() {
    const r = rounds[k];
    const letters = [...r.ans.toLocaleUpperCase('tr')];
    const fixed = letters.map((ch, n) => n === 0 || ch === ' ');
    const fill = letters.map((ch, n) => (fixed[n] ? ch : ''));
    let hints = 0;
    const pool = shuffle([...letters.filter((ch, n) => !fixed[n]), ...shuffle([...'AEİRNLKMTSUBDYOÇŞĞÜÖ']).filter((c) => !letters.includes(c)).slice(0, 3)]).map((ch) => ({ ch, used: false }));
    el.querySelector('#wd-step').innerHTML = rounds.map((_, j) => `<i class="${j < k ? 'done' : j === k ? 'cur' : ''}"></i>`).join('');
    const before = esc(r.item.title.slice(0, r.at)), after = esc(r.item.title.slice(r.at + r.ans.length));
    body.innerHTML = `<div class="quiz-q"><span class="quiz-type">${esc(r.tag.emoji)} ${esc(r.tag.label)} · ${esc(r.item.source)}</span>
      <h3>${before}<span class="blank wd-blank">${'_'.repeat(3)}</span>${after}</h3></div>
      <div class="wd-boxes" id="wd-boxes"></div><div class="wd-tiles" id="wd-tiles"></div>
      <div class="quiz-actions wd-actions"><button class="secondary" data-hint>💡 Harf aç</button><button class="secondary" data-skip>Pas geç</button></div>`;
    const boxes = body.querySelector('#wd-boxes'), tiles = body.querySelector('#wd-tiles');
    function paint() {
      boxes.innerHTML = letters.map((ch, n) => ch === ' ' ? '<span class="wd-gap"></span>' : `<button class="wd-box${fixed[n] ? ' fixed' : ''}${fill[n] ? ' full' : ''}" data-n="${n}">${esc(fill[n])}</button>`).join('');
      tiles.innerHTML = pool.map((p, n) => `<button class="wd-tile" data-n="${n}" ${p.used ? 'disabled' : ''}>${esc(p.ch)}</button>`).join('');
    }
    function place(ch, tileN) {
      const n = fill.findIndex((f, j) => !f && !fixed[j]);
      if (n < 0) return;
      fill[n] = ch; if (tileN != null) pool[tileN].used = true;
      haptic(6); paint();
      if (fill.every((f) => f)) check();
    }
    function unplace(n) {
      if (fixed[n] || !fill[n]) return;
      const t = pool.find((p) => p.used && !p.gone && p.ch === fill[n]); if (t) t.used = false;
      fill[n] = ''; paint();
    }
    function check() {
      if (fill.join('') === letters.join('')) return solved(true);
      haptic(30); boxes.classList.remove('shake'); void boxes.offsetWidth; boxes.classList.add('shake');
      setTimeout(() => { letters.forEach((_, n) => { if (!fixed[n]) fill[n] = ''; }); pool.forEach((p) => { p.used = !!p.gone; }); paint(); }, 450);
    }
    async function solved(ok) {
      document.removeEventListener('keydown', onKey);
      const got = ok ? Math.max(1, 3 - hints) : 0;
      stars += got;
      if (ok) { haptic(15); if (!book.some((b) => b.term === r.term)) { book.unshift({ term: r.term, ans: r.ans, label: r.tag.label, t: Date.now() }); store.set('haber.wordbook', book.slice(0, 200)); } }
      letters.forEach((ch, n) => { fill[n] = ch; }); pool.forEach((p) => { p.used = true; }); paint();
      boxes.classList.add(ok ? 'win' : 'lose'); tiles.hidden = true;
      body.querySelector('.wd-blank').outerHTML = `<mark class="wd-ans">${esc(r.ans)}</mark>`;
      body.querySelector('.wd-actions').innerHTML = '';
      body.insertAdjacentHTML('beforeend', `<div class="wd-learn"><div class="wd-learn-head"><b>${ok ? '⭐'.repeat(got) + ' ' : ''}${esc(r.term)}</b><small>${esc(r.tag.label)}</small></div><p class="wd-def">Açıklama yükleniyor…</p></div>
        <div class="quiz-actions"><button class="secondary" data-read>Haberi oku</button><button class="primary" data-next>${k < rounds.length - 1 ? 'Sıradaki →' : 'Bitir'}</button></div>`);
      body.querySelector('[data-read]').onclick = () => openSheet(r.item, null);
      body.querySelector('[data-next]').onclick = () => { k++; k < rounds.length ? show() : finish(); };
      body.querySelector('[data-next]').focus();
      const w = await wikiSummary(r.term, r.item.lang === 'en' ? 'en' : 'tr');
      const def = body.querySelector('.wd-def');
      if (!def) return;
      def.innerHTML = w ? `${esc(w.text.length > 340 ? w.text.slice(0, 340).replace(/\s\S*$/, '') + '…' : w.text)}${w.link ? ` <a href="#" data-wiki>Vikipedi →</a>` : ''}`
        : `"${esc(r.term)}", ${esc(r.tag.label)} haberlerinde sık geçen bir terim. Haberi okuyarak bağlamını görebilirsin.`;
      def.querySelector('[data-wiki]')?.addEventListener('click', (e) => { e.preventDefault(); openOriginal(w.link); });
    }
    boxes.onclick = (e) => { const b = e.target.closest('.wd-box'); if (b) unplace(+b.dataset.n); };
    tiles.onclick = (e) => { const b = e.target.closest('.wd-tile'); if (b) place(pool[+b.dataset.n].ch, +b.dataset.n); };
    body.querySelector('[data-hint]').onclick = () => {
      const n = letters.findIndex((ch, j) => !fixed[j] && fill[j] !== ch);
      if (n < 0) return;
      // Yanlış yerleştirilenleri geri al, doğru harfi sabitle
      letters.forEach((_, j) => { if (!fixed[j]) fill[j] = ''; });
      fixed[n] = true; fill[n] = letters[n]; hints++;
      const t = pool.find((p) => p.ch === letters[n] && !p.gone); if (t) t.gone = true;
      pool.forEach((p) => { p.used = !!p.gone; });
      paint(); haptic();
      if (fill.every((f) => f)) check();
    };
    body.querySelector('[data-skip]').onclick = () => solved(false);
    document.removeEventListener('keydown', onKey);
    onKey = (e) => {
      if (e.metaKey || e.ctrlKey || $('sheet').classList.contains('open')) return;
      if (e.key === 'Backspace') { const n = fill.map((f, j) => (f && !fixed[j] ? j : -1)).filter((j) => j >= 0).pop(); if (n != null) unplace(n); return; }
      const ch = e.key.length === 1 ? e.key.toLocaleUpperCase('tr') : '';
      if (!/\p{L}/u.test(ch)) return;
      const tn = pool.findIndex((p) => !p.used && p.ch === ch);
      place(ch, tn >= 0 ? tn : null);
    };
    document.addEventListener('keydown', onKey);
    paint();
  }
  function finish() {
    el.querySelector('#wd-step').innerHTML = '';
    body.innerHTML = `<div class="quiz-end"><span class="big-emoji">${stars >= rounds.length * 2 ? '🏆' : '📘'}</span><h3>${stars} ⭐</h3>
      <p>${rounds.length} terim avladın.</p>
      <div class="wd-book"><small>Kelime defterin</small>${book.slice(0, 12).map((b) => `<span>${esc(b.term)}</span>`).join('')}</div>
      <div class="quiz-actions"><button class="secondary" data-again>Yeni kelimeler</button><button class="primary" data-ok>Tamam</button></div></div>`;
    body.querySelector('[data-ok]').onclick = close;
    body.querySelector('[data-again]').onclick = () => { close(); setTimeout(openWords, 380); };
    if (stars >= rounds.length * 2) confetti(60);
  }
  el.addEventListener('closed', () => document.removeEventListener('keydown', onKey));
  show();
}

// =============== 4) Görüş haritası ===============
const TURKEY = '792';
const moodVal = { good: 1, neutral: 0, bad: -1 };

// Kaynak başına konum: x = yerel (0) ↔ küresel (1), y = kötümser (-1) ↔ iyimser (1)
function perspectivePoints(entries) {
  const bySrc = new Map();
  for (const e of entries) {
    const s = sources.find((x) => x.id === e.srcId || x.name === e.src);
    if (!s) continue;
    const p = bySrc.get(s.id) || bySrc.set(s.id, { src: s, n: 0, tone: 0, foreign: 0, items: [] }).get(s.id);
    p.n++; p.tone += moodVal[e.mood] || 0;
    p.foreign += e.countries?.length ? (e.countries.includes(TURKEY) ? 0 : 1) : 0.5;
    if (e.item) p.items.push(e.item);
  }
  return [...bySrc.values()].map((p) => ({ ...p, x: (p.src.lang === 'en' ? 0.55 : 0) + (p.foreign / p.n) * 0.45, y: p.tone / p.n }));
}

function openOpinion() {
  const since = Date.now() - 60 * 864e5;
  const byLink = new Map(allNews.map((i) => [i.link, i]));
  const mine = readLog.filter((r) => r.t > since).map((r) => { const it = byLink.get(r.link); return { ...r, mood: r.mood || it?.mood || 'neutral', srcId: r.srcId || it?.sourceId, item: it }; });
  const today = freshPool(24).map((i) => ({ srcId: i.sourceId, src: i.source, mood: i.mood, countries: i.countries, item: i }));
  let mode = mine.length >= 3 ? 'mine' : 'today';
  const { el, body } = labShell('opinion', { full: true, extra: `<div class="seg op-seg" id="op-seg"><span class="seg-thumb"></span><button data-v="mine">Senin okumaların</button><button data-v="today">Bugünün gündemi</button></div>` });
  body.innerHTML = `<div class="op-wrap"><div class="op-plot" id="op-plot"></div><aside class="op-side" id="op-side"></aside></div>`;
  const seg = el.querySelector('#op-seg');
  const thumb = () => { const on = seg.querySelector('button.on'), th = seg.querySelector('.seg-thumb'); th.style.width = on.offsetWidth + 'px'; th.style.transform = `translateX(${on.offsetLeft - 3}px)`; };
  function render() {
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === mode));
    requestAnimationFrame(thumb);
    const pts = perspectivePoints(mode === 'mine' ? mine : today);
    const W = 640, H = 440, P = 64;
    const X = (x) => P + x * (W - 2 * P), Y = (y) => H / 2 - y * 0.85 * (H / 2 - P);
    const maxN = Math.max(1, ...pts.map((p) => p.n));
    // Üst üste binen baloncukları biraz ayır
    const nodes = pts.map((p) => ({ p, cx: X(p.x), cy: Y(p.y), r: 9 + Math.sqrt(p.n / maxN) * 22 }));
    for (let it = 0; it < 60; it++) for (const a of nodes) for (const b of nodes) {
      if (a === b) continue;
      const dx = b.cx - a.cx, dy = b.cy - a.cy, d = Math.hypot(dx, dy) || 1, min = a.r + b.r + 3;
      if (d < min) { const m = (min - d) / 2 / d; a.cx -= dx * m; a.cy -= dy * m; b.cx += dx * m; b.cy += dy * m; }
    }
    for (const n of nodes) { n.cx = Math.max(n.r + 4, Math.min(W - n.r - 4, n.cx)); n.cy = Math.max(n.r + 4, Math.min(H - n.r - 4, n.cy)); }
    const total = pts.reduce((s, p) => s + p.n, 0) || 1;
    const me = { x: pts.reduce((s, p) => s + p.x * p.n, 0) / total, y: pts.reduce((s, p) => s + p.y * p.n, 0) / total };
    el.querySelector('#op-plot').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kaynakların bakış açısı haritası">
      <rect class="op-q" x="${P / 2}" y="${P / 2}" width="${W - P}" height="${H - P}" rx="22"/>
      <line class="op-axis" x1="${W / 2}" y1="${P / 2}" x2="${W / 2}" y2="${H - P / 2}"/><line class="op-axis" x1="${P / 2}" y1="${H / 2}" x2="${W - P / 2}" y2="${H / 2}"/>
      <text class="op-lbl" x="${P}" y="${H / 2 - 8}">◂ Yerel</text><text class="op-lbl" x="${W - P}" y="${H / 2 - 8}" text-anchor="end">Küresel ▸</text>
      <text class="op-lbl" x="${W / 2 + 8}" y="${P + 4}">▴ İyimser</text><text class="op-lbl" x="${W / 2 + 8}" y="${H - P + 2}">▾ Kötümser</text>
      ${nodes.map((n, k) => `<g class="op-node" data-id="${n.p.src.id}" style="--cat:${catColor(n.p.src.category)}; animation-delay:${k * 30}ms" tabindex="0">
        <circle cx="${n.cx}" cy="${n.cy}" r="${n.r}"/><text x="${n.cx}" y="${n.cy + 4}" text-anchor="middle">${esc(n.p.src.name.split(' ').map((w) => w[0]).join('').slice(0, 3))}</text>
        <title>${esc(n.p.src.name)} · ${n.p.n} haber</title></g>`).join('')}
      ${pts.length ? `<g class="op-me"><circle cx="${X(me.x)}" cy="${Y(me.y)}" r="15"/><text x="${X(me.x)}" y="${Y(me.y) + 5}" text-anchor="middle">★</text></g>` : ''}
    </svg>${pts.length ? '' : '<div class="status"><span class="big-emoji">🧭</span>Haritada gösterecek haber yok.</div>'}`;
    side(pts, me);
    el.querySelectorAll('.op-node').forEach((g) => {
      const pick = () => { haptic(); el.querySelectorAll('.op-node').forEach((x) => x.classList.toggle('sel', x === g)); sourceCard(pts.find((p) => p.src.id === g.dataset.id)); };
      g.onclick = pick; g.onkeydown = (e) => { if (e.key === 'Enter') pick(); };
    });
  }
  function side(pts, me) {
    const box = el.querySelector('#op-side');
    if (!pts.length) { box.innerHTML = ''; return; }
    const total = pts.reduce((s, p) => s + p.n, 0);
    const local = Math.round((pts.filter((p) => p.x < 0.5).reduce((s, p) => s + p.n, 0) / total) * 100);
    const tone = me.y > 0.15 ? 'iyimser' : me.y < -0.15 ? 'kötümser' : 'dengeli';
    const who = mode === 'mine' ? 'Okumalarının' : 'Bugünkü gündemin';
    // Kör nokta: merkezinin tersindeki, hiç okumadığın kaynaklardan bugünün en iyi haberi
    const readSrc = new Set(mine.map((m) => m.srcId));
    const opp = { x: me.x < 0.5 ? 1 : 0, y: -me.y };
    const todayPts = perspectivePoints(today);
    const blind = todayPts.filter((p) => !readSrc.has(p.src.id) || mode === 'today')
      .sort((a, b) => Math.hypot(a.x - opp.x, a.y - opp.y) - Math.hypot(b.x - opp.x, b.y - opp.y)).slice(0, 2)
      .map((p) => p.items.sort((a, b) => score(b) - score(a))[0]).filter(Boolean);
    box.innerHTML = `<div class="op-insight"><b>%${local}</b><span>${who} yerel basından, tonu <b>${tone}</b>.</span></div>
      <div class="op-meter"><i style="width:${local}%"></i></div><div class="op-meter-l"><span>Yerel</span><span>Küresel</span></div>
      <h4>👁️ Farklı bir gözle oku</h4>
      ${blind.map((i) => `<button class="op-sug" data-link="${esc(i.link)}"><small>${esc(i.source)}</small><b>${esc(i.title)}</b></button>`).join('') || '<p class="hint">Şimdilik öneri yok.</p>'}
      <div id="op-src"></div>
      <p class="hint op-help">Baloncuğa dokun: o kaynaktan okuduklarını gör.</p>`;
    box.querySelectorAll('.op-sug').forEach((b) => { b.onclick = () => { const it = allNews.find((x) => x.link === b.dataset.link); if (it) openSheet(it, null); }; });
  }
  function sourceCard(p) {
    const box = el.querySelector('#op-src');
    const items = [...new Set(p.items)].slice(0, 4);
    box.innerHTML = `<div class="op-srccard" style="--cat:${catColor(p.src.category)}"><b>${esc(p.src.name)}</b>
      <small>${p.n} haber · ${p.src.lang === 'en' ? 'Dünya basını' : 'Türk basını'} · ton ${p.y > 0.15 ? 'iyimser 🙂' : p.y < -0.15 ? 'kötümser 😟' : 'dengeli 😐'}</small>
      ${items.map((i) => `<button class="tm-item" data-link="${esc(i.link)}"><b>${esc(i.title)}</b></button>`).join('')}</div>`;
    box.querySelectorAll('.tm-item').forEach((b) => { b.onclick = () => { const it = allNews.find((x) => x.link === b.dataset.link); if (it) openSheet(it, null); }; });
    box.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  }
  seg.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b || b.dataset.v === mode) return; if (b.dataset.v === 'mine' && !mine.length) { toast('Birkaç haber okuyunca kendi haritan burada belirir'); return; } mode = b.dataset.v; haptic(); render(); };
  render();
}

// =============== 5) Konu tuvali ===============
function canvasNodes() {
  const nodes = [
    ...prefs.followTags.filter((t) => tagMap[t]).map((t) => ({ id: 't:' + t, tag: t, label: tagMap[t].label, emoji: tagMap[t].emoji })),
    ...prefs.keywords.map((kw) => ({ id: 'k:' + lc(kw), kw, label: kw, emoji: '🔑' })),
  ];
  const learned = Object.entries(aff.tags).filter(([t, v]) => v > 2 && tagMap[t] && !prefs.followTags.includes(t) && !prefs.muteTags.includes(t)).sort((a, b) => b[1] - a[1]).slice(0, 4);
  for (const [t] of learned) nodes.push({ id: 't:' + t, tag: t, label: tagMap[t].label, emoji: tagMap[t].emoji, learned: true });
  return nodes.slice(0, 14);
}
const nodeMatch = (n) => (i) => (n.tag ? i.tags.includes(n.tag) : (i._text || lc(`${i.title} ${i.summary}`)).includes(lc(n.kw)));

function openCanvas() {
  const pos = store.get('haber.canvas', {});
  let changed = false;
  const { el, body, close } = labShell('canvas', { full: true });
  body.innerHTML = `<div class="cv-board" id="cv-board"><svg class="cv-lines" id="cv-lines"></svg><div id="cv-cards"></div></div>
    <div class="cv-dock"><div class="cv-sugs" id="cv-sugs"></div>
      <form class="cv-add" id="cv-add"><input id="cv-input" placeholder="Kendi kelimeni ekle…" autocomplete="off" /><button class="primary" type="submit">Ekle</button></form></div>`;
  const board = el.querySelector('#cv-board'), cardsBox = el.querySelector('#cv-cards'), svg = el.querySelector('#cv-lines');
  const pool = allNews.filter((i) => Date.now() - new Date(i.date || 0) < 72 * 3600e3);
  let nodes = [], edges = [];

  function build() {
    nodes = canvasNodes();
    for (const n of nodes) n.items = pool.filter(nodeMatch(n));
    edges = [];
    for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
      const set = new Set(nodes[a].items.map((i) => i.link));
      const both = nodes[b].items.filter((i) => set.has(i.link));
      if (both.length) edges.push({ a: nodes[a], b: nodes[b], n: both.length });
      // Bugün ortak haber yoksa bile aynı alandaki konular soluk, kesikli bir bağla birleşir
      else if (nodes[a].tag && nodes[b].tag && tagMap[nodes[a].tag].group === tagMap[nodes[b].tag].group) edges.push({ a: nodes[a], b: nodes[b], n: 0 });
    }
    // Kayıtlı konumu olmayanlar daire üzerine dizilir
    const narrow = board.clientWidth < 560, rows = Math.ceil(nodes.length / 2);
    nodes.forEach((n, k) => {
      if (!pos[n.id] && narrow) { pos[n.id] = { x: k % 2 ? 0.72 : 0.28, y: (Math.floor(k / 2) + 0.5) / rows * 0.86 + 0.07 + (k % 2 ? 0.04 : 0) }; return; }
      if (!pos[n.id]) { const ang = (k / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2; pos[n.id] = { x: 0.5 + Math.cos(ang) * 0.33, y: 0.48 + Math.sin(ang) * 0.32 }; }
    });
    render();
    suggestions();
  }
  function xy(n) { const r = board.getBoundingClientRect(); return [pos[n.id].x * r.width, pos[n.id].y * r.height]; }
  function render() {
    if (!nodes.length) {
      cardsBox.innerHTML = '<div class="status cv-empty"><span class="big-emoji">🧩</span>Tuvalin boş. Aşağıdan bir konu ekleyerek başla.</div>';
      svg.innerHTML = '';
      return;
    }
    cardsBox.innerHTML = nodes.map((n, k) => `<div class="cv-card${n.learned ? ' learned' : ''}" data-id="${esc(n.id)}" style="animation-delay:${k * 40}ms" tabindex="0" role="button" aria-label="${esc(n.label)} haberleri">
      <span class="cv-emoji">${n.emoji}</span><b>${esc(n.label)}</b><small>${n.items.length} haber${n.learned ? ' · sık okuyorsun' : ''}</small>
      <button class="cv-x" data-x aria-label="${n.learned ? 'Takibe al' : 'Kaldır'}">${n.learned ? '＋' : '×'}</button></div>`).join('');
    cardsBox.querySelectorAll('.cv-card').forEach(bindCard);
    layout();
  }
  function layout() {
    const r = board.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    const max = Math.max(1, ...edges.map((e) => e.n));
    svg.innerHTML = edges.map((e, k) => { const [x1, y1] = xy(e.a), [x2, y2] = xy(e.b); return `<line class="${e.n ? '' : 'weak'}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke-width:${e.n ? 1.5 + (e.n / max) * 5 : 1.5}; animation-delay:${k * 30}ms"/>`; }).join('');
    cardsBox.querySelectorAll('.cv-card').forEach((c) => { const n = nodes.find((x) => x.id === c.dataset.id); const [x, y] = xy(n); c.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`; });
    cardsBox.querySelectorAll('.cv-link').forEach((b) => b.remove());
    edges.forEach((e, k) => {
      if (!e.n) return;
      const [x1, y1] = xy(e.a), [x2, y2] = xy(e.b);
      cardsBox.insertAdjacentHTML('beforeend', `<button class="cv-link" data-e="${k}" style="left:${(x1 + x2) / 2}px; top:${(y1 + y2) / 2}px" title="${esc(e.a.label)} + ${esc(e.b.label)}">${e.n}</button>`);
    });
    cardsBox.querySelectorAll('.cv-link').forEach((b) => {
      b.onclick = () => {
        const e = edges[+b.dataset.e];
        const tags = [e.a, e.b].filter((n) => n.tag).map((n) => n.tag), kw = [e.a, e.b].find((n) => n.kw)?.kw || '';
        goFeed({ tags, q: kw }, close);
        toast(`🔗 ${e.a.label} + ${e.b.label}`);
      };
    });
  }
  function bindCard(c) {
    const n = nodes.find((x) => x.id === c.dataset.id);
    let start = null, moved = false;
    c.addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-x]')) return;
      start = { x: e.clientX, y: e.clientY, px: pos[n.id].x, py: pos[n.id].y }; moved = false;
      c.setPointerCapture(e.pointerId); c.classList.add('dragging');
    });
    c.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true;
      const r = board.getBoundingClientRect();
      pos[n.id] = { x: Math.max(0.06, Math.min(0.94, start.px + dx / r.width)), y: Math.max(0.08, Math.min(0.92, start.py + dy / r.height)) };
      layout();
    });
    const end = () => {
      if (!start) return;
      c.classList.remove('dragging');
      if (moved) store.set('haber.canvas', pos);
      else open();
      start = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', () => { start = null; c.classList.remove('dragging'); });
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    function open() { haptic(); goFeed(n.tag ? { tags: [n.tag] } : { q: n.kw }, close); toast(`${n.emoji} ${n.label}`); }
    c.querySelector('[data-x]').onclick = (e) => {
      e.stopPropagation(); haptic(); changed = true;
      if (n.learned) { prefs.followTags.push(n.tag); toast(`${n.label} takibe alındı`); }
      else if (n.tag) { prefs.followTags = prefs.followTags.filter((t) => t !== n.tag); aff.tags[n.tag] = Math.min(aff.tags[n.tag] || 0, 1); saveAff(); toast(`${n.label} tuvalden kaldırıldı`); }
      else { prefs.keywords = prefs.keywords.filter((k) => lc(k) !== lc(n.kw)); toast(`"${n.kw}" kaldırıldı`); }
      savePrefs(); build();
    };
  }
  // Öneriler: tuvaldeki konularla aynı haberlerde en sık geçen, henüz eklenmemiş konular
  function suggestions() {
    const have = new Set(nodes.map((n) => n.tag).filter(Boolean));
    const counts = new Map();
    const base = nodes.length ? nodes.flatMap((n) => n.items) : pool;
    for (const i of base) for (const t of i.tags) if (!have.has(t) && !prefs.muteTags.includes(t) && tagMap[t]) counts.set(t, (counts.get(t) || 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    el.querySelector('#cv-sugs').innerHTML = (top.length ? `<small>${nodes.length ? 'Bağlantılı konular' : 'Popüler konular'}</small>` : '') +
      top.map(([t]) => `<button class="tag-chip" data-t="${t}">＋ ${esc(tagLabel(t))}</button>`).join('');
    el.querySelectorAll('#cv-sugs [data-t]').forEach((b) => { b.onclick = () => add({ tag: b.dataset.t }); });
  }
  function add({ tag, kw }) {
    haptic(); changed = true;
    if (tag) { prefs.followTags = [...new Set([...prefs.followTags, tag])]; prefs.muteTags = prefs.muteTags.filter((t) => t !== tag); }
    if (kw && !prefs.keywords.some((k) => lc(k) === lc(kw))) prefs.keywords.push(kw);
    savePrefs();
    // Yeni kart, en güçlü bağlantısının yanına düşer
    const id = tag ? 't:' + tag : 'k:' + lc(kw);
    const test = nodeMatch({ tag, kw });
    const near = nodes.map((n) => [n, n.items.filter(test).length]).sort((a, b) => b[1] - a[1])[0];
    // Bağlandığı kartın yakınında, diğer kartlarla çakışmayan en uygun boş yer
    const r = board.getBoundingClientRect();
    const anchor = near && near[1] && pos[near[0].id] ? pos[near[0].id] : { x: 0.5, y: 0.5 };
    let best = null;
    for (let gx = 0.12; gx <= 0.88; gx += 0.04) for (let gy = 0.1; gy <= 0.9; gy += 0.04) {
      const clear = Math.min(1e9, ...nodes.map((n) => Math.hypot((pos[n.id].x - gx) * r.width / 150, (pos[n.id].y - gy) * r.height / 90)));
      const sc = Math.min(clear, 1.4) * 10 - Math.hypot(anchor.x - gx, anchor.y - gy) * 4;
      if (!best || sc > best.sc) best = { sc, x: gx, y: gy };
    }
    pos[id] = { x: best.x, y: best.y };
    store.set('haber.canvas', pos);
    build();
    cardsBox.querySelector(`[data-id="${CSS.escape(id)}"]`)?.classList.add('fresh');
  }
  el.querySelector('#cv-add').onsubmit = (e) => {
    e.preventDefault();
    const v = el.querySelector('#cv-input').value.trim();
    if (!v) return;
    const t = Object.values(tagMap).find((x) => lc(x.label) === lc(v) || (x.terms || []).some((w) => lc(w) === lc(v)));
    add(t ? { tag: t.id } : { kw: v });
    el.querySelector('#cv-input').value = '';
  };
  const onResize = () => nodes.length && layout();
  window.addEventListener('resize', onResize);
  el.addEventListener('closed', () => { window.removeEventListener('resize', onResize); if (changed) { renderTabs(); buildView(); } });
  requestAnimationFrame(build);
}

const LAB_OPEN = { predict: openPredict, timemachine: openTimeMachine, words: openWords, opinion: openOpinion, canvas: openCanvas };
window.LABS = LABS;
window.openLab = (id) => LAB_OPEN[id]?.();
// Atölyeyi henüz hiç açmadıysa Keşfet düğmesinde küçük bir "yeni" noktası
if (LABS.some((l) => !labSeen.has(l.id))) $('open-fun').classList.add('has-new');
