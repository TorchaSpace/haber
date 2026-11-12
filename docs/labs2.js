// Haber — Keşif atölyesi, ikinci bölüm: Gelecek takvimi, Sesli bülten, Ruh hali, Kapanış notu, Haber sohbeti.
// labs.js'in kabuğunu (labShell, coach, goFeed) ve ortak durumu kullanır. Hepsi cihazda, haber metinlerinden çalışır.

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const DAYS_TR = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi'];
const DAYS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS_TR = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
const MONTHS_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const sentencesOf = (text) => String(text || '').split(/(?<=[.!?…])\s+(?=[\p{Lu}“"'‘(])/u).map((s) => s.trim()).filter((s) => s.length > 25);

// =============== 1) Gelecek takvimi ===============
// Haberde "yarın", "cuma günü", "18 Kasım" gibi bir zaman ve gelecek anlatımı varsa, olayı o güne yerleştirir.
const FUTURE_RE = /(acak|ecek|acağı|eceği|bekleniyor|başlıyor|karşılaşıyor|düzenleniyor|\bwill\b|set to|scheduled|expected|\bdue\b|upcoming|plans? to|to (?:meet|face|host|announce|vote|visit|unveil|release|launch|hold|decide)|next week|önümüzdeki)/u;

function eventOf(item) {
  const raw = `${item.title}. ${item.summary || ''}`;
  const t = item.lang === 'en' ? raw.toLowerCase() : lc(raw);
  if (!FUTURE_RE.test(t)) return null;
  const b0 = dayStart(new Date(item.date || Date.now()));
  let day = null;
  if (/(?<![\p{L}])yarın(?![\p{L}])|\btomorrow\b/u.test(t)) day = addDays(b0, 1);
  else if (/bu akşam|bu gece|\btonight\b/u.test(t)) day = b0;
  if (!day) {
    let m = t.match(new RegExp(`(?<![\\d.])(\\d{1,2})\\s*(${MONTHS_TR.join('|')})`, 'u'));
    if (m) { const d = new Date(b0.getFullYear(), MONTHS_TR.indexOf(m[2]), +m[1]); if (d.getDate() === +m[1]) day = d; }
    else if ((m = t.match(new RegExp(`(?<![\\p{L}])(${MONTHS_EN.join('|')})[a-z]*\\.?\\s+(\\d{1,2})(?!\\d)`, 'u')))) {
      const d = new Date(b0.getFullYear(), MONTHS_EN.indexOf(m[1]), +m[2]); if (d.getDate() === +m[2]) day = d;
    }
    if (day && day < addDays(b0, -1)) day = new Date(day.getFullYear() + 1, day.getMonth(), day.getDate());
  }
  if (!day) {
    const m = t.match(/(?<![\p{L}])(pazartesi|salı|çarşamba|perşembe|cumartesi|cuma|pazar|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?![\p{L}])/u);
    if (m) {
      const idx = Math.max(DAYS_TR.indexOf(m[1]), DAYS_EN.indexOf(m[1]));
      day = addDays(b0, (idx - b0.getDay() + 7) % 7 || 7);
    } else if (/hafta sonu|weekend/u.test(t)) day = addDays(b0, (6 - b0.getDay() + 7) % 7 || 7);
  }
  const soon = !day && /(next week|önümüzdeki hafta|gelecek hafta|haftaya)/u.test(t);
  if (!day && !soon) return null;
  const tm = t.match(/saat\s*(\d{1,2})[.:](\d{2})|(?<![\d.])(\d{1,2}):(\d{2})(?!\d)/u);
  const hh = tm ? +(tm[1] ?? tm[3]) : null, mm = tm ? tm[2] ?? tm[4] : null;
  return { day, soon, time: hh != null && hh < 24 ? `${String(hh).padStart(2, '0')}:${mm}` : '' };
}

function openAgenda() {
  const today0 = dayStart(new Date());
  const mine = (i) => i.tags.some((t) => prefs.followTags.includes(t)) || matchedKeywords(i).length > 0 || prefs.categories.includes(i.category);
  const events = [];
  for (const i of freshPool(96)) {
    const e = eventOf(i);
    if (!e) continue;
    if (e.day && (e.day < today0 || e.day > addDays(today0, 13))) continue;
    events.push({ ...e, item: i, mine: mine(i) });
  }
  const { el, body } = labShell('agenda', { wide: true });
  if (!events.length) {
    body.innerHTML = '<div class="quiz-end"><span class="big-emoji">🗓️</span><h3 class="small">Takvim şimdilik boş</h3><p>Haberlerde "yarın", "cuma günü" gibi tarihli bir olay geçince burada belirir.</p></div>';
    return;
  }
  const days = Array.from({ length: 7 }, (_, k) => addDays(today0, k));
  let scope = events.some((e) => e.mine) ? 'mine' : 'all';
  let sel = null;
  const inScope = (e) => scope === 'all' || e.mine;
  body.innerHTML = `
    <div class="seg ag-seg" id="ag-seg"><span class="seg-thumb"></span><button data-v="mine">Sana özel</button><button data-v="all">Hepsi</button></div>
    <div class="ag-days" id="ag-days" role="tablist"></div>
    <div class="ag-list" id="ag-list"></div>
    <p class="hint ag-note">Etkinlikler haber başlıklarından çıkarılır, resmî bir takvim değildir.</p>`;
  const seg = el.querySelector('#ag-seg');
  const thumb = () => { const on = seg.querySelector('button.on'), th = seg.querySelector('.seg-thumb'); th.style.width = on.offsetWidth + 'px'; th.style.transform = `translateX(${on.offsetLeft - 3}px)`; };
  const evOf = (k) => events.filter((e) => inScope(e) && (k === 'soon' ? e.soon : e.day && sameDay(e.day, days[k])));
  function render() {
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === scope));
    requestAnimationFrame(thumb);
    if (sel == null || (sel !== 'soon' && !evOf(sel).length && days.some((_, k) => evOf(k).length))) sel = Math.max(0, days.findIndex((_, k) => evOf(k).length));
    const strip = days.map((d, k) => ({ k, n: evOf(k).length, d }));
    const soonN = evOf('soon').length;
    el.querySelector('#ag-days').innerHTML = strip.map(({ k, n, d }) => `<button class="ag-day${sel === k ? ' on' : ''}${n ? '' : ' empty'}" data-k="${k}" role="tab">
      <small>${k === 0 ? 'Bugün' : k === 1 ? 'Yarın' : d.toLocaleDateString('tr-TR', { weekday: 'short' })}</small><b>${d.getDate()}</b><i>${n || ''}</i></button>`).join('')
      + (soonN ? `<button class="ag-day wide${sel === 'soon' ? ' on' : ''}" data-k="soon" role="tab"><small>Yakında</small><b>⋯</b><i>${soonN}</i></button>` : '');
    const list = evOf(sel).sort((a, b) => b.mine - a.mine || (a.time || '99').localeCompare(b.time || '99'));
    el.querySelector('#ag-list').innerHTML = list.length ? list.map((e, k) => `<button class="ag-ev${e.mine ? ' mine' : ''}" data-link="${esc(e.item.link)}" style="animation-delay:${k * 40}ms">
        <span class="ag-time">${e.time ? esc(e.time) : '•'}</span>
        <span class="ag-main"><b>${esc(e.item.title)}</b><small>${e.mine ? '★ ' : ''}${esc(e.item.tags[0] ? tagLabel(e.item.tags[0]) : categories[e.item.category] || '')} · ${esc(e.item.source)}${e.item.storySize > 1 ? ` · ${e.item.storySize} kaynak` : ''}</small></span></button>`).join('')
      : `<div class="status ag-empty"><span class="big-emoji">🌤️</span>${scope === 'mine' ? 'Bu gün için ilgi alanlarında bir olay yok.<br>"Hepsi"ne bakabilirsin.' : 'Bu gün için haberlerde bir olay yok.'}</div>`;
    el.querySelectorAll('.ag-ev').forEach((b) => { b.onclick = () => { const it = allNews.find((x) => x.link === b.dataset.link); if (it) openSheet(it, null); }; });
  }
  el.querySelector('#ag-days').onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; sel = b.dataset.k === 'soon' ? 'soon' : +b.dataset.k; haptic(); render(); };
  seg.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b || b.dataset.v === scope) return; scope = b.dataset.v; sel = null; haptic(); render(); };
  render();
}

// =============== 2) Sesli bülten ===============
const ORD_TR = ['Birinci', 'İkinci', 'Üçüncü', 'Dördüncü', 'Beşinci', 'Altıncı', 'Yedinci', 'Sekizinci', 'Dokuzuncu', 'Onuncu'];
const ORD_EN = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

function bulletinScript() {
  const evening = new Date().getHours() >= 15;
  const lang = prefs.langs.length === 1 ? prefs.langs[0] : 'tr';
  const ranked = freshPool(18).map((i) => [i, score(i) + (i.storySize || 1) * 3]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  let pool = ranked.filter((i) => i.lang === lang);
  if (pool.length < 4) pool = ranked;
  const picks = [], per = {};
  let words = 0;
  for (const i of pool) {
    if ((per[i.category] || 0) >= 2) continue;
    const l = i.lang === 'en' ? 'en' : 'tr';
    const sum = (i.summary || '').trim();
    const head = i.title.replace(/[.!?…]+$/, '');
    const extra = sum && lc(sum).slice(0, 28) !== lc(head).slice(0, 28) ? sentencesOf(sum).slice(0, 1).join(' ').slice(0, 220) : '';
    const text = l === 'en'
      ? `Story ${ORD_EN[picks.length] || picks.length + 1}. ${head}. ${extra}${i.storySize > 1 ? ` Reported by ${i.storySize} outlets.` : ''}`
      : `${ORD_TR[picks.length] || picks.length + 1} haber. ${head}. ${extra}${i.storySize > 1 ? ` Bu haberi ${i.storySize} kaynak yazdı.` : ''}`;
    const w = text.split(/\s+/).length;
    if (picks.length >= 4 && words + w > 460) break;
    picks.push({ item: i, text, lang: l });
    per[i.category] = (per[i.category] || 0) + 1;
    words += w;
    if (picks.length >= 10) break;
  }
  const date = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
  const intro = { text: `${evening ? 'İyi akşamlar' : 'Günaydın'}. ${date}. İşte ${picks.length} önemli haberle günün bülteni.`, lang: 'tr', idx: -1 };
  const outro = { text: 'Bülten bu kadar. Yarın görüşmek üzere.', lang: 'tr', idx: picks.length };
  const segs = [intro, ...picks.flatMap((p, idx) => {
    const parts = p.text.split(/(?<=[.!?])\s+/).filter(Boolean);
    return parts.map((text) => ({ text, lang: p.lang, idx }));
  }), outro];
  return { picks, segs, minutes: Math.max(1, Math.round((words + 30) / 150)), evening };
}

function openBulletin() {
  const synth = window.speechSynthesis;
  const { el, body, close } = labShell('bulletin');
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
    body.innerHTML = '<div class="quiz-end"><span class="big-emoji">🔇</span><h3 class="small">Bu cihazda ses yok</h3><p>Sesli okuma bu cihazda desteklenmiyor.</p></div>';
    return;
  }
  const { picks, segs, minutes, evening } = bulletinScript();
  if (picks.length < 3) { body.innerHTML = '<div class="quiz-end"><span class="big-emoji">📻</span><h3 class="small">Bülten için haber az</h3><p>Biraz sonra tekrar dene.</p></div>'; return; }
  let si = 0, playing = false, tok = 0, rate = 1, voices = [];
  const loadVoices = () => { voices = synth.getVoices(); };
  loadVoices(); synth.addEventListener?.('voiceschanged', loadVoices);
  const voiceFor = (lang) => {
    const mine = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang));
    return mine.find((v) => v.localService) || mine[0] || null;
  };
  body.innerHTML = `
    <div class="bl-hero"><button class="bl-play" id="bl-play" aria-label="Oynat"><svg viewBox="0 0 24 24" class="i-play"><path d="M8 5v14l11-7z"/></svg><svg viewBox="0 0 24 24" class="i-pause"><path d="M7 5v14M17 5v14"/></svg></button>
      <div class="bl-meta"><b>${evening ? '🌙 Akşam' : '☀️ Sabah'} bülteni</b><small id="bl-sub">≈ ${minutes} dakika · ${picks.length} haber</small></div>
      <div class="bl-ctl"><button class="icon-btn" id="bl-prev" aria-label="Önceki haber">⏮</button><button class="icon-btn" id="bl-next" aria-label="Sonraki haber">⏭</button><button class="sort-btn" id="bl-rate" title="Hız">1×</button></div></div>
    <div class="bl-bar"><i id="bl-fill"></i></div>
    <ol class="bl-list" id="bl-list">${picks.map((p, k) => `<li><button class="bl-item" data-k="${k}"><span class="bl-n">${k + 1}</span><span><b>${esc(p.item.title)}</b><small>${esc(p.item.source)}${p.item.storySize > 1 ? ` · ${p.item.storySize} kaynak` : ''}</small></span></button></li>`).join('')}</ol>`;
  const playBtn = el.querySelector('#bl-play');
  function ui() {
    playBtn.classList.toggle('on', playing);
    playBtn.setAttribute('aria-label', playing ? 'Duraklat' : 'Oynat');
    el.querySelector('#bl-fill').style.width = `${Math.round((si / segs.length) * 100)}%`;
    const cur = segs[Math.min(si, segs.length - 1)].idx;
    el.querySelectorAll('.bl-item').forEach((b, k) => b.classList.toggle('on', k === cur));
    el.querySelector('#bl-sub').textContent = si >= segs.length ? 'Bitti' : playing ? 'Okunuyor…' : `≈ ${minutes} dakika · ${picks.length} haber`;
  }
  function stop() { tok++; try { synth.cancel(); } catch {} }
  function speak() {
    if (!playing) return;
    if (si >= segs.length) { playing = false; si = segs.length; ui(); stats.bulletins = (stats.bulletins || 0) + 1; saveStats(); confetti(40); return; }
    const my = ++tok, seg = segs[si];
    const u = new SpeechSynthesisUtterance(seg.text);
    u.lang = seg.lang === 'en' ? 'en-US' : 'tr-TR';
    const v = voiceFor(seg.lang); if (v) u.voice = v;
    u.rate = rate;
    u.onend = () => { if (my === tok && playing) { si++; speak(); } };
    u.onerror = (e) => { if (my !== tok || /interrupted|canceled/.test(e.error || '')) return; playing = false; ui(); toast('Ses çalınamadı'); };
    synth.speak(u);
    ui();
  }
  const toggle = () => {
    haptic();
    if (playing) { playing = false; stop(); ui(); return; }
    if (si >= segs.length) si = 0;
    playing = true; stop(); speak();
  };
  const jump = (k) => { // k: haber sırası; 0 öncesi giriş, sonrası kapanış
    const at = segs.findIndex((s) => s.idx === k);
    si = at < 0 ? 0 : at; haptic();
    if (playing) { stop(); speak(); } else ui();
  };
  playBtn.onclick = toggle;
  el.querySelector('#bl-prev').onclick = () => { const cur = segs[Math.min(si, segs.length - 1)].idx; jump(Math.max(0, cur - 1 < 0 ? 0 : cur - 1)); };
  el.querySelector('#bl-next').onclick = () => { const cur = segs[Math.min(si, segs.length - 1)].idx; jump(Math.min(picks.length, cur + 1)); };
  el.querySelector('#bl-rate').onclick = (e) => { rate = rate === 1 ? 1.2 : rate === 1.2 ? 0.85 : 1; e.currentTarget.textContent = `${rate}×`; if (playing) { stop(); speak(); } };
  el.querySelector('#bl-list').onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) jump(+b.dataset.k); };
  el.addEventListener('closed', () => { playing = false; stop(); synth.removeEventListener?.('voiceschanged', loadVoices); });
  ui();
}

// =============== 3) Ruh hali ===============
const MOOD_SET = {
  calm: { emoji: '🌿', title: 'Sakin', sub: 'Yumuşak, sakinleştirici', cats: { kultur: 4, bilim: 4, saglik: 3, oyun: 2 },
    tags: { hayvanlar: 3, muzik: 3, kitap: 3, sanat: 3, sinema: 2, beslenme: 3, arkeoloji: 3, uzay: 2 }, heavy: ['savas', 'afet', 'hukuk', 'siber', 'goc', 'secim', 'rusya-ukrayna', 'orta-dogu'] },
  curious: { emoji: '🔭', title: 'Merak', sub: 'Öğreten, düşündüren', cats: { bilim: 5, teknoloji: 4, kultur: 3, saglik: 2 },
    tags: { uzay: 3, arkeoloji: 3, 'yapay-zeka': 3, 'saglik-arastirma': 3, hayvanlar: 2, cip: 2, kitap: 2, iklim: 2, girisim: 2 }, heavy: ['magazin'] },
  energy: { emoji: '⚡', title: 'Enerji', sub: 'Hızlı, canlı, rekabetçi', cats: { spor: 5, oyun: 4, ekonomi: 3 },
    tags: { futbol: 3, f1: 3, basketbol: 3, tenis: 2, borsa: 3, kripto: 3, girisim: 2, 'elektrikli-arac': 2, 'sampiyonlar-ligi': 3 }, heavy: [] },
};
function moodScore(i, key) {
  const m = MOOD_SET[key];
  let s = (m.cats[i.category] || 0) + i.tags.reduce((a, t) => a + (m.tags[t] || 0), 0) - i.tags.filter((t) => m.heavy.includes(t)).length * 3;
  const ageH = (Date.now() - new Date(i.date || 0)) / 3.6e6;
  if (key === 'calm') s += i.mood === 'good' ? 4 : i.mood === 'bad' ? -100 : 0, s -= (i.storySize || 1) >= 4 ? 2 : 0;
  if (key === 'curious') s += Math.min(3, (i.storySize || 1) * 0.5) + ((i.summary || '').length > 160 ? 1 : 0) - (i.mood === 'bad' ? 1 : 0);
  if (key === 'energy') s += (ageH < 3 ? 3 : 0) + ((i.storySize || 1) >= 3 ? 2 : 0);
  return s + score(i) * 0.15 - ageH * 0.03;
}
function moodReasons(i, key) {
  const m = MOOD_SET[key], r = [];
  if (key === 'calm' && i.mood === 'good') r.push('☀️ İyi haber');
  if (key === 'energy' && Date.now() - new Date(i.date || 0) < 3 * 3.6e6) r.push('⚡ Taze');
  const t = i.tags.find((x) => m.tags[x]);
  r.push(t ? tagLabel(t) : categories[i.category] || '');
  if ((i.storySize || 1) >= 3 && key !== 'calm') r.push(`${i.storySize} kaynak`);
  return r.filter(Boolean).slice(0, 3);
}

function openMood() {
  let pick = store.get('haber.moodpick', null);
  const { el, body } = labShell('mood');
  body.innerHTML = `<p class="md-ask">Şu an nasıl bir okuma istiyorsun?</p>
    <div class="md-opts" id="md-opts" role="radiogroup">${Object.entries(MOOD_SET).map(([k, m]) => `<button class="md-opt" data-m="${k}" role="radio"><span>${m.emoji}</span><b>${m.title}</b><small>${m.sub}</small></button>`).join('')}</div>
    <div class="md-list" id="md-list"></div>`;
  function render() {
    el.querySelectorAll('.md-opt').forEach((b) => { b.classList.toggle('on', b.dataset.m === pick); b.setAttribute('aria-checked', b.dataset.m === pick); });
    const box = el.querySelector('#md-list');
    if (!pick) { box.innerHTML = '<p class="hint md-hint">Birini seç, listeyi ona göre dizelim.</p>'; return; }
    const per = {};
    const items = freshPool(36).map((i) => [i, moodScore(i, pick)]).filter(([, s]) => s > -50).sort((a, b) => b[1] - a[1]).map((x) => x[0])
      .filter((i) => (per[i.category] = (per[i.category] || 0) + 1) <= 3).slice(0, 8);
    box.innerHTML = items.length >= 2 ? items.map((i, k) => `<button class="md-item" data-link="${esc(i.link)}" style="animation-delay:${k * 45}ms">
        ${i.image ? `<span class="md-img" style="background-image:url('${esc(i.image)}')"></span>` : `<span class="md-img ph" style="--cat:${catColor(i.category)}">${esc(CAT_EMOJI[i.category] || '✦')}</span>`}
        <span class="md-txt"><b>${esc(i.title)}</b><small>${esc(i.source)} · ${timeAgo(i.date)}</small>
        <span class="md-tags">${moodReasons(i, pick).map((r) => `<em>${esc(r)}</em>`).join('')}</span></span></button>`).join('')
      : '<div class="status"><span class="big-emoji">🍃</span>Bu ruh haline uygun haber az, biraz sonra tekrar dene.</div>';
    box.querySelectorAll('.md-item').forEach((b) => { b.onclick = () => { const it = allNews.find((x) => x.link === b.dataset.link); if (it) openSheet(it, null); }; });
  }
  el.querySelector('#md-opts').onclick = (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    pick = b.dataset.m; store.set('haber.moodpick', pick); haptic(); render();
  };
  render();
}

// =============== 4) Günün kapanış notu ===============
function closingData() {
  const key = new Date().toDateString();
  const logs = readLog.filter((r) => new Date(r.t).toDateString() === key);
  const n = logs.length;
  if (!n) return { n: 0 };
  const count = (arr) => { const m = new Map(); for (const x of arr) if (x) m.set(x, (m.get(x) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const cats = count(logs.map((r) => r.cat)), tags = count(logs.flatMap((r) => r.tags || []).filter((t) => tagMap[t]));
  const srcs = new Set(logs.map((r) => r.src)).size, countries = new Set(logs.flatMap((r) => r.countries || [])).size;
  const bad = logs.filter((r) => r.mood === 'bad').length / n, good = logs.filter((r) => r.mood === 'good').length / n;
  const top = [...logs].sort((a, b) => (b.dwell || 0) - (a.dwell || 0))[0];
  const topItem = top && (allNews.find((i) => i.link === top.link) || saved.get(top.link));
  const readCats = new Set(logs.map((r) => r.cat));
  const unread = prefs.categories.find((c) => !readCats.has(c) && categories[c]);
  const catName = categories[cats[0]?.[0]] || 'çeşitli konular';
  const tagName = tags.find(([t]) => tagMap[t]?.label !== catName)?.[0];
  const s1 = n === 1 ? `Bugün bir haber okudun: ${catName} tarafındaydın.`
    : `Bugün ${n} haber okudun, ağırlığı ${catName}${tagName ? ` ve ${tagMap[tagName].label}` : ''} oluşturdu.`;
  const tone = bad >= 0.6 ? `gündem ağırdı (okuduklarının %${Math.round(bad * 100)}'i olumsuz)` : good >= 0.3 ? `umut veren haberler de vardı (%${Math.round(good * 100)}'i iyi haber)` : 'gündem dengeliydi';
  const s2 = `${srcs === 1 ? 'Tek bir kaynaktan' : `${srcs} farklı kaynaktan`}${countries ? `, ${countries} ülkeyi kapsayan` : ''} okudun ve ${tone}.`;
  const s3 = topItem && (top.dwell || 0) >= 8 ? `Seni en çok tutan haber: “${topItem.title.replace(/[.!?]+$/, '')}”.`
    : unread ? `Yarın ${categories[unread]} tarafına da göz atmaya ne dersin?` : 'Yarın sabah baskısı seni bekliyor.';
  return { n, text: `${s1} ${s2} ${s3}`, srcs, countries, minutes: Math.max(1, Math.round(logs.reduce((s, r) => s + (r.dwell || 0), 0) / 60)) };
}

function openClosing() {
  const d = closingData();
  const notes = store.get('haber.notes', []);
  const day = todayKey();
  const { el, body } = labShell('closing');
  const fmt = (k) => new Date(k + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
  const archived = () => notes.some((x) => x.day === day);
  function render() {
    body.innerHTML = (d.n ? `<article class="cn-card"><small>${fmt(day)}</small><p>${esc(d.text)}</p>
        <div class="cn-stats"><div><b>${d.n}</b><span>haber</span></div><div><b>${d.srcs}</b><span>kaynak</span></div><div><b>${d.minutes}</b><span>dakika</span></div></div></article>
      <div class="quiz-actions cn-actions"><button class="primary" id="cn-save" ${archived() ? 'disabled' : ''}>${archived() ? 'Arşivlendi ✓' : '📌 Arşivle'}</button><button class="secondary" id="cn-copy">Kopyala</button></div>`
      : `<div class="quiz-end"><span class="big-emoji">🌙</span><h3 class="small">Bugün henüz haber okumadın</h3><p>Birkaç haber oku, günün sonunda üç cümlelik notun burada olsun.</p></div>`)
      + (notes.length ? `<h4 class="cn-h">Önceki notların</h4><div class="cn-archive">${notes.map((x, k) => `<details class="cn-old"${x.day === day && k === 0 ? ' open' : ''}><summary>${esc(fmt(x.day))}<button class="cn-del" data-k="${k}" aria-label="Sil">×</button></summary><p>${esc(x.text)}</p></details>`).join('')}</div>` : '');
    body.querySelector('#cn-save')?.addEventListener('click', () => {
      const i = notes.findIndex((x) => x.day === day); if (i >= 0) notes.splice(i, 1);
      notes.unshift({ day, text: d.text, n: d.n }); notes.splice(120);
      store.set('haber.notes', notes); haptic(15); toast('📌 Notun arşivlendi'); render();
    });
    body.querySelector('#cn-copy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(d.text); toast('Kopyalandı'); } catch { toast('Kopyalanamadı'); } });
    body.querySelectorAll('.cn-del').forEach((b) => { b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); notes.splice(+b.dataset.k, 1); store.set('haber.notes', notes); render(); }; });
  }
  render();
}

// =============== 5) Haber sohbeti ===============
// Yapay zekâ uydurması değil: yanıtlar yalnızca haberin kendi metninden ve aynı olayı yazan kaynaklardan derlenir, her yanıtın kaynağı gösterilir.
const QSTOP = new Set('bu şu o bir ve ile için ne neden nasıl kim kimin nedir mi mı mu mü de da ki ama daha çok gibi var yok the a an is are was what why how who does did of to in on for and'.split(' '));
const ASK_CHIPS = [['why', 'Bu neden önemli?'], ['said', 'Kim ne dedi?'], ['others', 'Diğer kaynaklar ne yazıyor?'], ['back', 'Arka plan ne?'], ['next', 'Sırada ne var?']];

async function askArticleText(item) {
  try {
    const r = await fetch('/api/article?url=' + encodeURIComponent(item.link));
    const d = await r.json();
    if (!r.ok || d.error || !d.content) return '';
    const doc = new DOMParser().parseFromString(d.content, 'text/html');
    return [...doc.querySelectorAll('p,li')].map((p) => p.textContent.replace(/\s+/g, ' ').trim()).filter((t) => t.length > 40).slice(0, 40).join(' ');
  } catch { return ''; }
}

function openAsk() {
  const { el, body } = labShell('ask', { wide: true });
  const ranked = freshPool(36).map((i) => [i, (i.storySize || 1) * 3 + score(i)]).sort((a, b) => b[1] - a[1]).map((x) => x[0]).slice(0, 8);
  if (ranked.length < 2) { body.innerHTML = '<div class="quiz-end"><span class="big-emoji">💬</span><h3 class="small">Sohbet için haber az</h3><p>Biraz sonra tekrar dene.</p></div>'; return; }
  body.innerHTML = `<p class="md-ask">Hangi haber hakkında soru sormak istersin?</p><div class="md-list" id="ask-pick">${ranked.map((i, k) => `<button class="md-item" data-k="${k}" style="animation-delay:${k * 40}ms">
      <span class="md-txt"><b>${esc(i.title)}</b><small>${esc(i.source)}${i.storySize > 1 ? ` · ${i.storySize} kaynak yazdı` : ''}</small></span></button>`).join('')}</div>`;
  el.querySelector('#ask-pick').onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) { haptic(); chat(ranked[+b.dataset.k]); } };

  function chat(item) {
    const group = storyMap.get(item.storyId) || [item];
    let article = null; // metin gelince dolar
    const ready = askArticleText(item).then((t) => { article = t; });
    body.innerHTML = `<div class="ask-top"><div><small>${group.length > 1 ? `${group.length} kaynak yazdı` : esc(item.source)}</small><b>${esc(item.title)}</b></div><button class="secondary" id="ask-back">Değiştir</button></div>
      <div class="ask-log" id="ask-log" aria-live="polite"><div class="ask-msg bot">Merhaba! Bu haber hakkında soru sorabilirsin. Yanıtları yalnızca haberin kendi metninden ve aynı olayı yazan kaynaklardan derlerim, hangi kaynaktan aldığımı da gösteririm.</div></div>
      <div class="ask-chips" id="ask-chips">${ASK_CHIPS.map(([k, t]) => `<button class="tag-chip" data-i="${k}">${t}</button>`).join('')}</div>
      <form class="cv-add ask-form" id="ask-form"><input id="ask-input" placeholder="Kendi sorunu yaz…" autocomplete="off" /><button class="primary" type="submit">Sor</button></form>`;
    el.querySelector('#ask-back').onclick = () => openAskAgain();
    const log = el.querySelector('#ask-log');

    const pieces = () => {
      const seen = new Set(), out = [];
      const add = (s, src, link) => { const k = lc(s).slice(0, 60); if (!seen.has(k)) { seen.add(k); out.push({ s, src, link }); } };
      sentencesOf(article).forEach((s) => add(s, item.source, item.link));
      for (const g of group) { sentencesOf(g.summary).forEach((s) => add(s, g.source, g.link)); add(g.title, g.source, g.link); }
      return out;
    };
    const srcChips = (links) => `<div class="ask-srcs">${[...new Map(links.filter(Boolean).map((l) => [l.link, l])).values()].slice(0, 4).map((l) => `<button class="ask-src" data-link="${esc(l.link)}">↗ ${esc(l.src)}</button>`).join('')}</div>`;

    const answers = {
      why() {
        const f = [], links = [{ link: item.link, src: item.source }];
        if (group.length > 1) { f.push(`<b>${group.length} farklı kaynak</b> aynı olayı yazıyor (${group.slice(0, 4).map((g) => esc(g.source)).join(', ')}), yani tek bir kaynağın öne çıkardığı bir haber değil.`); group.slice(0, 3).forEach((g) => links.push({ link: g.link, src: g.source })); }
        const fol = item.tags.filter((t) => prefs.followTags.includes(t));
        if (fol.length) f.push(`Takip ettiğin <b>${esc(tagMap[fol[0]]?.label || fol[0])}</b> konusunu ilgilendiriyor.`);
        else if (item.tags[0]) f.push(`Konusu: <b>${esc(tagLabel(item.tags[0]))}</b>.`);
        if (item.countries?.length) f.push(`Etkilenen yerler: ${item.countries.slice(0, 3).map((c) => esc(countryMap[c] || c)).join(', ')}.`);
        const age = (Date.now() - new Date(item.date || 0)) / 3.6e6;
        if (age < 6) f.push('Son saatlerde yayımlanmış, gelişmeye devam edebilir.');
        const lead = sentencesOf(article)[0] || sentencesOf(item.summary)[0];
        if (lead) f.push(`Haberin özü: “${esc(lead.slice(0, 220))}”`);
        return { html: f.map((x) => `<p>${x}</p>`).join('') || '<p>Haberden önem hakkında çıkarabildiğim bir şey yok.</p>', links };
      },
      said() {
        const q = sentencesOf(article).filter((s) => /["“”]|\b(dedi|söyledi|açıkladı|belirtti|ifade etti|kaydetti|said|says|told|added|stated)\b/iu.test(s)).slice(0, 3);
        return q.length ? { html: q.map((s) => `<p>${/^["“]/.test(s) ? esc(s.slice(0, 260)) : `“${esc(s.slice(0, 260))}”`}</p>`).join(''), links: [{ link: item.link, src: item.source }] }
          : { html: '<p>Haber metninde tırnak içinde bir açıklama bulamadım.</p>', links: [{ link: item.link, src: item.source }] };
      },
      others() {
        if (group.length < 2) return { html: '<p>Bu olayı şu an yalnızca bir kaynak yazıyor, karşılaştıracak başka başlık yok.</p>', links: [{ link: item.link, src: item.source }] };
        const wc = group.map((g) => new Set(lc(g.title).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 4)));
        return { html: group.slice(0, 5).map((g, k) => {
          const uniq = [...wc[k]].find((w) => !wc.some((o, j) => j !== k && [...o].some((x) => x.slice(0, 5) === w.slice(0, 5))));
          return `<p><b>${esc(g.source)}:</b> ${esc(g.title)}${uniq ? ` <em class="ask-em">(“${esc(uniq)}” vurgusu)</em>` : ''}</p>`;
        }).join(''), links: group.slice(0, 5).map((g) => ({ link: g.link, src: g.source })) };
      },
      async back() {
        const cands = (item.title.split(/\s+/).slice(1).map((w) => w.replace(/['’].*$/, '').replace(/[^\p{L}]/gu, '')).filter((w) => w.length >= 4 && /^\p{Lu}/u.test(w)));
        const terms = [...new Set([...cands, ...item.tags.slice(0, 2).map((t) => tagMap[t]?.label).filter(Boolean)])].slice(0, 3);
        for (const t of terms) {
          const w = await wikiSummary(t, item.lang === 'en' ? 'en' : 'tr');
          if (w) return { html: `<p><b>${esc(t)}</b>: ${esc(w.text.length > 380 ? w.text.slice(0, 380).replace(/\s\S*$/, '') + '…' : w.text)}</p>`, links: w.link ? [{ link: w.link, src: 'Vikipedi' }] : [] };
        }
        return { html: '<p>Bu haber için güvenilir bir arka plan özeti bulamadım.</p>', links: [] };
      },
      next() {
        const s = pieces().filter((p) => FUTURE_RE.test(lc(p.s))).slice(0, 2);
        const ev = group.map(eventOf).find(Boolean);
        const bits = s.map((p) => `<p>“${esc(p.s.slice(0, 240))}”</p>`);
        if (ev?.day) bits.unshift(`<p>Haberlere göre ilgili gelişme <b>${ev.day.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}</b>${ev.time ? ` saat ${ev.time}` : ''} civarında.</p>`);
        return bits.length ? { html: bits.join(''), links: s.map((p) => ({ link: p.link, src: p.src })).concat([{ link: item.link, src: item.source }]) }
          : { html: '<p>Haberde bir sonraki adım belirtilmemiş. Hikâyeyi takibe alırsan yeni gelişmeler gelince haber verilir.</p>', links: [] };
      },
      free(q) {
        const words = lc(q).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !QSTOP.has(w)).map((w) => w.slice(0, 5));
        if (!words.length) return null;
        const hit = pieces().map((p) => [p, words.filter((w) => lc(p.s).includes(w)).length]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 2);
        return hit.length ? { html: hit.map(([p]) => `<p>“${esc(p.s.slice(0, 280))}”</p>`).join(''), links: hit.map(([p]) => ({ link: p.link, src: p.src })) } : null;
      },
    };
    const route = (q) => /neden önemli|önemi|önemli mi|why .*matter|ne anlama/iu.test(q) ? 'why'
      : /ne dedi|açıklama|söyle|who said|what did .* say|quote/iu.test(q) ? 'said'
      : /diğer kaynak|başka kaynak|farklı kaynak|other sources|nasıl yazdı/iu.test(q) ? 'others'
      : /arka plan|geçmiş|background|nedir|kimdir|what is|who is|ne demek/iu.test(q) ? 'back'
      : /sırada|ne olacak|sonra ne|what happens|what next|what's next/iu.test(q) ? 'next' : 'free';

    async function ask(kind, label) {
      log.insertAdjacentHTML('beforeend', `<div class="ask-msg me">${esc(label)}</div><div class="ask-msg bot typing" id="ask-typing"><i></i><i></i><i></i></div>`);
      log.scrollTop = log.scrollHeight;
      await ready;
      let r = await (kind === 'free' ? answers.free(label) : answers[kind]());
      if (!r) r = { html: '<p>Bu soruya haberlerde dayanak bulamadım. Soruyu başka kelimelerle ya da yukarıdaki hazır sorularla deneyebilirsin.</p>', links: [] };
      el.querySelector('#ask-typing')?.remove();
      log.insertAdjacentHTML('beforeend', `<div class="ask-msg bot">${r.html}${r.links.length ? srcChips(r.links) : ''}</div>`);
      log.scrollTop = log.scrollHeight;
      stats.asks = (stats.asks || 0) + 1; saveStats();
    }
    el.querySelector('#ask-chips').onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) { haptic(); ask(b.dataset.i, b.textContent); } };
    el.querySelector('#ask-form').onsubmit = (e) => {
      e.preventDefault();
      const inp = el.querySelector('#ask-input'), q = inp.value.trim();
      if (!q) return;
      inp.value = ''; ask(route(q), q);
    };
    log.addEventListener('click', (e) => { const b = e.target.closest('.ask-src'); if (b) openOriginal(b.dataset.link); });
  }
  function openAskAgain() { el.querySelector('[data-close]').click(); setTimeout(openAsk, 380); }
}

// ---------- Kayıt: atölye listesine ekle, gruplara ayır ----------
LABS.push(
  { id: 'agenda', emoji: '🗓️', title: 'Gelecek takvimi', sub: () => 'Önümüzdeki günlerin olayları',
    steps: [['🔎', 'Haberlerde geçen "yarın", "cuma günü", "18 Kasım" gibi zamanları buluruz.'], ['📅', 'Üstten bir gün seç, o günün olayları ilgi alanına göre sıralanır.'], ['★', 'Yıldızlılar senin konularından. Dokununca haberi açarsın.']] },
  { id: 'bulletin', emoji: '📻', title: 'Sesli bülten', sub: () => '3 dakikada günün özeti',
    steps: [['▶️', 'Tek bir düğmeye bas, bülten okunmaya başlasın.'], ['⏭️', 'İstediğin habere atla, hızı değiştir ya da duraklat.'], ['🎧', 'Ekrana bakmana gerek yok; yürürken ya da yemek yaparken dinle.']] },
  { id: 'mood', emoji: '🌗', title: 'Ruh hali', sub: () => 'Sakin, merak ya da enerji',
    steps: [['🌿', 'Sakin: iyi ve yumuşak haberler.'], ['🔭', 'Merak: bilim, teknoloji, öğreten hikâyeler.'], ['⚡', 'Enerji: spor, piyasa ve taze gelişmeler. Seçimin hatırlanır.']] },
  { id: 'closing', emoji: '🌙', title: 'Günün kapanış notu', sub: () => { const n = store.get('haber.notes', []).length; return n ? `${n} notun arşivde` : 'Günün üç cümlesi'; },
    steps: [['📖', 'O gün okuduklarından üç cümlelik kişisel bir not çıkarılır.'], ['📌', 'Beğenirsen arşivle, istediğin zaman geri dön.'], ['🔒', 'Her şey yalnızca bu cihazda kalır.']] },
  { id: 'ask', emoji: '💬', title: 'Haber sohbeti', sub: () => 'Habere soru sor',
    steps: [['📰', 'Bir haber seç.'], ['❓', 'Hazır sorulardan birine dokun ya da kendi sorunu yaz.'], ['🔗', 'Yanıtlar yalnızca haberin kendi metninden ve diğer kaynaklardan derlenir; kaynağı hep gösterilir.']] },
);
Object.assign(LAB_OPEN, { agenda: openAgenda, bulletin: openBulletin, mood: openMood, closing: openClosing, ask: openAsk });
const LAB_GROUPS = [
  ['Bugün için', ['agenda', 'bulletin', 'mood', 'closing']],
  ['Oyna ve öğren', ['predict', 'words', 'timemachine']],
  ['Anla ve sor', ['opinion', 'canvas', 'ask']],
];
for (const [name, ids] of LAB_GROUPS) for (const id of ids) LABS.find((l) => l.id === id).group = name;
LABS.sort((a, b) => LAB_GROUPS.findIndex((g) => g[0] === a.group) - LAB_GROUPS.findIndex((g) => g[0] === b.group) || LAB_GROUPS.find((g) => g[0] === a.group)[1].indexOf(a.id) - LAB_GROUPS.find((g) => g[0] === b.group)[1].indexOf(b.id));
if (LABS.some((l) => !labSeen.has(l.id))) $('open-fun').classList.add('has-new');
