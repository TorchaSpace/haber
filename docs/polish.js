/* Cilalama katmanı: sürtünmesiz akış, klavye kısayolları, çevrimdışı durumu, boş durum eylemleri */
(() => {
  const $ = (id) => document.getElementById(id);

  // Boş / hata durumlarındaki eylem düğmeleri
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.status-btn');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'clear') $('clear-filters').click();
    else if (act === 'all') selectTab('all');
    else if (act === 'prefs') $('open-prefs').click();
    else if (act === 'retry') {
      b.disabled = true; b.textContent = 'Deneniyor…';
      loadNews(true).catch(() => {
        $('feed').querySelector('.status-btn')?.removeAttribute('disabled');
        const sb = $('feed').querySelector('.status-btn'); if (sb) sb.textContent = 'Tekrar dene';
        toast('Hâlâ ulaşılamıyor');
      });
    }
  });

  // Çevrimdışı şeridi + bağlantı gelince sessizce yenile
  const bar = document.createElement('div');
  bar.className = 'net-bar'; bar.setAttribute('role', 'status');
  bar.textContent = 'Çevrimdışısın. Kayıtlı haberlerin açık.';
  document.body.appendChild(bar);
  const sync = () => bar.classList.toggle('show', navigator.onLine === false);
  addEventListener('offline', sync);
  addEventListener('online', () => {
    sync(); toast('Tekrar çevrimiçisin');
    if (typeof allNews !== 'undefined' && !allNews.length) loadNews(true).catch(() => {});
  });
  sync();

  // Üst çubuğa kaydırma gölgesi (tek rAF, pasif dinleyici)
  const chrome = $('chrome');
  let tick = false;
  addEventListener('scroll', () => {
    if (tick) return; tick = true;
    requestAnimationFrame(() => { chrome.classList.toggle('scrolled', scrollY > 8); tick = false; });
  }, { passive: true });

  // Klavye: j/k kartlar arasında gezin, Enter oku, s kaydet
  let cur = null;
  const cards = () => [...document.querySelectorAll('#feed .card')];
  const focusCard = (el) => {
    cur?.classList.remove('kb');
    cur = el; if (!el) return;
    el.classList.add('kb');
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = document.activeElement?.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    if ($('sheet').classList.contains('open') || $('drawer').classList.contains('open') || document.body.classList.contains('locked')) return;
    const list = cards();
    if (!list.length) return;
    const i = cur ? list.indexOf(cur) : -1;
    if (e.key === 'j') { e.preventDefault(); focusCard(list[Math.min(list.length - 1, i + 1)]); }
    else if (e.key === 'k') { e.preventDefault(); focusCard(list[Math.max(0, i - 1)]); }
    else if (e.key === 'Enter' && cur && cur.isConnected) { e.preventDefault(); cur.click(); }
    else if (e.key === 's' && cur) { e.preventDefault(); cur.querySelector('.save')?.click(); }
  });
  document.addEventListener('pointerdown', () => { cur?.classList.remove('kb'); }, { passive: true });
})();
