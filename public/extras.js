// Haber — eğlenceli modlar: kaydırarak ayıklama, dünya haritası, haftalık özet.
// app.js'teki ortak durumu (view, allNews, prefs, learn, openSheet…) kullanır.

function overlay(cls, html) {
  const el = document.createElement('div');
  el.className = `overlay ${cls}`;
  el.innerHTML = html;
  document.body.appendChild(el);
  document.body.classList.add('locked');
  requestAnimationFrame(() => el.classList.add('open'));
  const close = () => {
    el.classList.remove('open');
    el.classList.add('closing');
    document.body.classList.remove('locked');
    setTimeout(() => el.remove(), 350);
    el.dispatchEvent(new Event('closed'));
  };
  el.querySelector('[data-close]')?.addEventListener('click', close);
  return { el, close };
}

// =============== 1) Kaydırarak hızlı ayıklama ===============
function openSwipe() {
  const deck = (view.length ? view : allNews).filter((i) => !readSet.has(i.link)).slice(0, 50);
  if (!deck.length) { toast('Ayıklanacak yeni haber yok 🎉'); return; }
  let idx = 0, kept = 0;
  const { el, close } = overlay('swipe', `
    <div class="ov-head">
      <span class="ov-title">Hızlı ayıkla</span>
      <span class="swipe-count" id="swipe-count"></span>
      <button class="icon-btn" data-close aria-label="Kapat"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <div class="swipe-stack" id="swipe-stack"></div>
    <div class="swipe-actions">
      <button class="sw-btn skip" data-a="left" title="Geç (←)">✕</button>
      <button class="sw-btn read" data-a="up" title="Şimdi oku (↑)">↑</button>
      <button class="sw-btn keep" data-a="right" title="Kaydet (→)">♥</button>
    </div>
    <p class="swipe-hint">Sağa kaydır: kaydet · Sola: geç · Yukarı: hemen oku</p>`);
  const stack = el.querySelector('#swipe-stack');

  function cardHtml(item) {
    return `
      ${item.image ? `<div class="sw-img" style="background-image:url('${esc(item.image)}')"></div>` : `<div class="sw-img fallback" style="--cat:${catColor(item.category)}"><span>${esc(item.source)}</span></div>`}
      <div class="sw-body">
        <div class="meta" style="--cat:${catColor(item.category)}"><span class="cat-pill">${esc(categories[item.category] || '')}</span><span class="dot"></span>${esc(item.source)}<span class="dot"></span>${timeAgo(item.date)}</div>
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.summary || '')}</p>
        ${item.storySize > 1 ? `<span class="story-badge">${item.storySize} kaynak yazdı</span>` : ''}
      </div>
      <span class="stamp stamp-keep">KAYDET</span><span class="stamp stamp-skip">GEÇ</span><span class="stamp stamp-read">OKU</span>`;
  }

  function render() {
    stack.innerHTML = '';
    el.querySelector('#swipe-count').textContent = idx < deck.length ? `${idx + 1} / ${deck.length}` : '';
    if (idx >= deck.length) {
      stack.innerHTML = `<div class="sw-done"><span class="big-emoji">🎉</span><h3>Hepsi bu kadar!</h3><p>${deck.length} haberi ayıkladın, ${kept} tanesini kaydettin.</p><button class="primary" data-close2>Akışa dön</button></div>`;
      stack.querySelector('[data-close2]').onclick = close;
      return;
    }
    for (let k = Math.min(idx + 2, deck.length - 1); k >= idx; k--) {
      const c = document.createElement('article');
      c.className = 'sw-card';
      c.style.setProperty('--depth', k - idx);
      c.innerHTML = cardHtml(deck[k]);
      stack.appendChild(c);
    }
    bindDrag(stack.lastElementChild);
  }

  function decide(dir) {
    const card = stack.querySelector('.sw-card:last-child');
    const item = deck[idx];
    if (!card || !item) return;
    haptic(dir === 'right' ? 14 : 8);
    if (dir === 'right') { if (!saved.has(item.link)) toggleSave(item, null); kept++; }
    if (dir === 'left') learn(item, -0.8);
    const fly = { right: 'translate(140%, -10%) rotate(24deg)', left: 'translate(-140%, -10%) rotate(-24deg)', up: 'translate(0, -130%) scale(.9)' }[dir];
    card.classList.add('flying', `go-${dir}`);
    card.style.transform = fly;
    card.style.opacity = '0';
    idx++;
    setTimeout(() => {
      render();
      if (dir === 'up') { readSet.add(item.link); saveRead(); openSheet(item, null); }
    }, 260);
  }

  function bindDrag(card) {
    let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;
    card.addEventListener('pointerdown', (e) => { dragging = true; sx = e.clientX; sy = e.clientY; card.setPointerCapture(e.pointerId); card.classList.add('dragging'); });
    card.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
      card.style.setProperty('--keep', Math.max(0, Math.min(1, dx / 120)));
      card.style.setProperty('--skip', Math.max(0, Math.min(1, -dx / 120)));
      card.style.setProperty('--read', Math.max(0, Math.min(1, -dy / 140)) * (Math.abs(dx) < 80 ? 1 : 0));
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      card.classList.remove('dragging');
      if (dx > 110) decide('right');
      else if (dx < -110) decide('left');
      else if (dy < -130 && Math.abs(dx) < 80) decide('up');
      else { card.style.transform = ''; card.style.setProperty('--keep', 0); card.style.setProperty('--skip', 0); card.style.setProperty('--read', 0); }
      dx = dy = 0;
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  }

  el.querySelector('.swipe-actions').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) decide(b.dataset.a); });
  const onKey = (e) => {
    if ($('sheet').classList.contains('open')) return;
    if (e.key === 'ArrowRight') decide('right');
    else if (e.key === 'ArrowLeft') decide('left');
    else if (e.key === 'ArrowUp') { e.preventDefault(); decide('up'); }
    else if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  el.addEventListener('closed', () => { document.removeEventListener('keydown', onKey); buildView(); });
  render();
}

// =============== 2) Dünya haritası + haber pasaportu ===============
const loadScript = (src) => new Promise((ok, fail) => {
  if (document.querySelector(`script[src="${src}"]`)) return ok();
  const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s);
});
let worldCache = null;

async function openMap() {
  const { el, close } = overlay('mapview', `
    <div class="ov-head">
      <span class="ov-title">Dünya haritası</span>
      <span class="map-sub" id="map-sub"></span>
      <button class="icon-btn" data-close aria-label="Kapat"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <div class="map-wrap">
      <div class="map-canvas" id="map-canvas"><div class="status"><span class="big-emoji">🗺️</span>Harita yükleniyor…</div></div>
      <aside class="map-side">
        <h4>En çok haber çıkan ülkeler</h4>
        <div id="map-top"></div>
        <h4>🛂 Haber pasaportun</h4>
        <div id="map-passport"></div>
      </aside>
    </div>
    <div class="map-tip" id="map-tip"></div>`);

  // Ülke başına haber sayısı (gizlenen kaynak/konular hariç)
  const base = allNews.filter((i) => !prefs.muteSources.includes(i.sourceId) && !i.tags.some((t) => prefs.muteTags.includes(t)) && (!prefs.langs.length || prefs.langs.includes(i.lang)));
  const counts = new Map();
  for (const i of base) for (const c of i.countries || []) counts.set(c, (counts.get(c) || 0) + 1);
  const visited = new Map();
  for (const r of readLog) for (const c of r.countries || []) visited.set(c, (visited.get(c) || 0) + 1);

  const pick = (id) => { activeCountry = id; activeTags = []; close(); if (activeTab === 'stories' || activeTab === 'saved') selectTab('all'); else { window.scrollTo({ top: 0, behavior: 'instant' }); buildView(); } toast(`📍 ${countryMap[id]} haberleri`); };

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = top[0]?.[1] || 1;
  el.querySelector('#map-top').innerHTML = top.map(([id, n]) => `<button class="map-row" data-id="${id}"><span>${esc(countryMap[id] || id)}</span><i style="--w:${Math.round((n / max) * 100)}%"></i><b>${n}</b></button>`).join('');
  el.querySelectorAll('.map-row').forEach((b) => { b.onclick = () => pick(b.dataset.id); });
  const total = Object.keys(countryMap).length;
  el.querySelector('#map-passport').innerHTML = `<div class="passport"><b>${visited.size}</b><span>/ ${total} ülkeden haber okudun</span></div>
    <div class="stamps">${[...visited.keys()].slice(0, 30).map((id) => `<span class="stamp-chip">${esc(countryMap[id] || id)}</span>`).join('') || '<p class="hint">Haber okudukça okuduğun ülkeler burada damgalanır ve haritada çerçevelenir.</p>'}</div>`;
  el.querySelector('#map-sub').textContent = `${counts.size} ülkeden ${base.length} haber · bir ülkeye dokun`;

  try {
    await loadScript('https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js');
    worldCache ||= await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json').then((r) => r.json());
  } catch {
    el.querySelector('#map-canvas').innerHTML = '<div class="status"><span class="big-emoji">📡</span>Harita yüklenemedi (internet bağlantısı gerekli).</div>';
    return;
  }
  const box = el.querySelector('#map-canvas');
  const W = box.clientWidth, H = box.clientHeight;
  const geo = topojson.feature(worldCache, worldCache.objects.countries);
  const projection = d3.geoNaturalEarth1().fitSize([W, H], geo);
  const path = d3.geoPath(projection);
  const color = d3.scaleSqrt().domain([0, max]).range([0.08, 1]);
  box.innerHTML = '';
  const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${W} ${H}`);
  const tip = el.querySelector('#map-tip');
  svg.append('g').selectAll('path').data(geo.features).join('path')
    .attr('d', path)
    .attr('class', (d) => `land${counts.has(d.id) ? ' has' : ''}${visited.has(d.id) ? ' visited' : ''}`)
    .style('--a', (d) => (counts.has(d.id) ? color(counts.get(d.id)) : 0))
    .style('animation-delay', (d, i) => `${(i % 40) * 12}ms`)
    .on('mousemove', (e, d) => {
      const n = counts.get(d.id) || 0;
      tip.innerHTML = `<b>${esc(countryMap[d.id] || d.properties.name)}</b> · ${n} haber${visited.has(d.id) ? ' · 🛂 okudun' : ''}`;
      tip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
      tip.classList.add('show');
    })
    .on('mouseleave', () => tip.classList.remove('show'))
    .on('click', (e, d) => { if (counts.has(d.id)) pick(d.id); });
}

// =============== 3) Haftalık okuma özeti ===============
function openWeek() {
  const now = Date.now(), WEEK = 7 * 864e5;
  const week = readLog.filter((r) => now - r.t < WEEK);
  const prev = readLog.filter((r) => now - r.t >= WEEK && now - r.t < 2 * WEEK);
  const minutes = Math.round(week.reduce((s, r) => s + Math.min(r.dwell || 0, 900), 0) / 60);
  const count = (arr, key) => { const m = new Map(); for (const r of arr) for (const k of [].concat(r[key] || [])) m.set(k, (m.get(k) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const tags = count(week, 'tags').slice(0, 6);
  const srcs = count(week, 'src').slice(0, 5);
  const cats = count(week, 'cat');
  const countries = count(week, 'countries');
  const hours = new Array(24).fill(0); for (const r of week) hours[new Date(r.t).getHours()]++;
  const favHour = hours.indexOf(Math.max(...hours));
  // Seri: bugünden geriye kaç gün üst üste okudun
  const days = new Set(readLog.map((r) => new Date(r.t).toDateString()));
  let streak = 0; for (let d = new Date(); days.has(d.toDateString()); d.setDate(d.getDate() - 1)) streak++;
  const diff = prev.length ? Math.round(((week.length - prev.length) / prev.length) * 100) : null;
  const maxTag = tags[0]?.[1] || 1;
  const persona = !week.length ? '' : cats[0] ? ({ spor: 'Tribün müdavimi ⚽', teknoloji: 'Teknoloji kurdu 💻', ekonomi: 'Piyasa takipçisi 📈', dunya: 'Dünya vatandaşı 🌍', gundem: 'Gündem bekçisi 📰', bilim: 'Meraklı kâşif 🔭', saglik: 'Sağlık bilinçlisi 🩺', oyun: 'Oyuncu ruhu 🎮', kultur: 'Kültür insanı 🎭' }[cats[0][0]] || 'Haber kurdu') : '';

  const { el } = overlay('weekview', `
    <div class="week-card">
      <div class="ov-head">
        <span class="ov-title">Haftan</span>
        <button class="icon-btn" data-close aria-label="Kapat"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      ${!week.length ? '<div class="status"><span class="big-emoji">📖</span>Bu hafta henüz haber okumadın. Birkaç haber oku, özetin burada belirsin.</div>' : `
      ${persona ? `<div class="persona">Bu haftaki unvanın<b>${persona}</b></div>` : ''}
      <div class="stats">
        <div class="stat"><b data-count="${week.length}">0</b><span>haber okudun${diff !== null ? ` <em class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} %${Math.abs(diff)}</em>` : ''}</span></div>
        <div class="stat"><b data-count="${minutes}">0</b><span>dakika okuma</span></div>
        <div class="stat"><b data-count="${countries.length}">0</b><span>ülke gezdin</span></div>
        <div class="stat"><b data-count="${streak}">0</b><span>gün seri 🔥</span></div>
      </div>
      <h4>En çok okuduğun konular</h4>
      ${tags.map(([t, n], i) => `<div class="bar-row" style="animation-delay:${i * 80}ms"><span>${esc(tagLabel(t))}</span><i style="--w:${Math.round((n / maxTag) * 100)}%"></i></div>`).join('') || '<p class="hint">Henüz yeterli veri yok.</p>'}
      <div class="week-grid">
        <div><h4>Favori kaynakların</h4><ol>${srcs.map(([s, n]) => `<li>${esc(s)} <span>${n}</span></li>`).join('')}</ol></div>
        <div><h4>En sevdiğin saat</h4><div class="hours">${hours.map((h, i) => `<i style="--h:${h ? Math.max(8, Math.round((h / Math.max(...hours)) * 100)) : 4}%" class="${i === favHour ? 'fav' : ''}" title="${i}:00"></i>`).join('')}</div><p class="hint">En çok ${String(favHour).padStart(2, '0')}:00 civarı okuyorsun</p></div>
      </div>`}
    </div>`);
  // Sayılar sıfırdan yukarı sayarak gelir
  el.querySelectorAll('[data-count]').forEach((b) => {
    const target = +b.dataset.count, t0 = performance.now(), dur = 900;
    const step = (t) => { const p = Math.min(1, (t - t0) / dur); b.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  el.addEventListener('click', (e) => { if (e.target === el) el.querySelector('[data-close]').click(); });
}

$('open-swipe').onclick = () => { haptic(); openSwipe(); };
$('open-map').onclick = () => { haptic(); openMap(); };
$('open-week').onclick = () => { haptic(); openWeek(); };
