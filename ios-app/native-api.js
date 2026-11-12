// Sunucusuz motor: RSS'leri doğrudan cihazdan çeker (Capacitor HTTP ile CORS yok), etiketler, gruplar, ayrıştırır.
import { sources, categories } from './sources.js';
import { tagItem, tagList, tagGroups } from './tags.js';
import { countryList, detectCountries } from './countries.js';
import { clusterStories } from './stories.js';
import { moodOf } from './mood.js';
import { getOnThisDay } from './onthisday.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const CACHE_MS = 10 * 60 * 1000;
let cache = { at: 0, items: [] };

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('zaman aşımı')), ms))]);
const text = (el, sel) => el.getElementsByTagName(sel)[0]?.textContent?.trim() || '';
const plain = (html) => new DOMParser().parseFromString(html || '', 'text/html').body.textContent.replace(/\s+/g, ' ').trim();
const upscale = (url) => url?.replace(/&#0?38;|&amp;/g, '&').replace(/\/ace\/standard\/\d+\//, '/ace/standard/976/') ?? null;

function pickImage(it, html) {
  const media = [...it.getElementsByTagName('media:content'), ...it.getElementsByTagName('media:thumbnail')]
    .filter((m) => m.getAttribute('url') && (!m.getAttribute('medium') || m.getAttribute('medium') === 'image'))
    .sort((a, b) => (Number(b.getAttribute('width')) || 0) - (Number(a.getAttribute('width')) || 0));
  if (media[0]) return media[0].getAttribute('url');
  const enc = it.getElementsByTagName('enclosure')[0];
  if (enc?.getAttribute('url') && /image/.test(enc.getAttribute('type') || 'image')) return enc.getAttribute('url');
  const m = (html || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function parseFeed(xml, src) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const nodes = [...doc.getElementsByTagName('item'), ...doc.getElementsByTagName('entry')];
  return nodes.map((it) => {
    const linkEl = it.getElementsByTagName('link')[0];
    const link = (linkEl?.getAttribute('href') || linkEl?.textContent || '').trim();
    const encoded = text(it, 'content:encoded') || text(it, 'content');
    const desc = text(it, 'description') || text(it, 'summary') || encoded;
    const raw = text(it, 'pubDate') || text(it, 'dc:date') || text(it, 'published') || text(it, 'updated');
    const d = raw ? new Date(raw) : null;
    return {
      id: text(it, 'guid') || text(it, 'id') || link,
      title: plain(text(it, 'title')),
      link,
      summary: plain(desc).slice(0, 320),
      date: d && !isNaN(d) ? d.toISOString() : null,
      image: upscale(pickImage(it, encoded || desc)),
      source: src.name, sourceId: src.id, lang: src.lang, category: src.category,
    };
  });
}

async function fetchSource(src) {
  try {
    const res = await withTimeout(fetch(src.url), 12000);
    if (!res.ok) throw new Error(res.status);
    return parseFeed(await res.text(), src);
  } catch (err) {
    console.warn(`[feeds] ${src.name} alınamadı: ${err.message}`);
    return [];
  }
}

async function getAllNews(force) {
  if (!force && Date.now() - cache.at < CACHE_MS && cache.items.length) return cache.items;
  const results = await Promise.all(sources.map(fetchSource));
  const seen = new Set();
  const items = results.flat()
    .filter((i) => i.title && i.link && !seen.has(i.link) && seen.add(i.link))
    .map((i) => ({ ...i, tags: tagItem(i), countries: detectCountries(i), mood: moodOf(i) }))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  clusterStories(items);
  cache = { at: Date.now(), items };
  return items;
}

async function getArticle(url) {
  const res = await withTimeout(fetch(url), 15000);
  if (!res.ok) throw new Error(`Kaynak ${res.status} döndürdü`);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const abs = (u) => { try { return new URL(u, url).href; } catch { return u; } };
  doc.querySelectorAll('img').forEach((img) => {
    const lazy = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
    if (lazy) img.setAttribute('src', lazy);
    if (img.getAttribute('src')) img.setAttribute('src', abs(img.getAttribute('src')));
    img.removeAttribute('srcset');
  });
  const parsed = new Readability(doc).parse(); // eslint-disable-line no-undef
  if (!parsed?.content || parsed.textContent.trim().length < 200) throw new Error('Haber metni çıkarılamadı');
  const content = DOMPurify.sanitize(parsed.content, { // eslint-disable-line no-undef
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'svg'],
    FORBID_ATTR: ['style', 'class', 'id', 'width', 'height'],
  });
  return { title: parsed.title, byline: parsed.byline, siteName: parsed.siteName, content,
    minutes: Math.max(1, Math.round(parsed.textContent.trim().split(/\s+/).length / 200)), url };
}

export async function handle(u) {
  const q = u.searchParams;
  const list = (v) => (v ? String(v).split(',').filter(Boolean) : null);
  try {
    if (u.pathname === '/api/meta') {
      return json({ categories, tagGroups, tags: tagList, countries: countryList, sources: sources.map(({ id, name, lang, category }) => ({ id, name, lang, category })) });
    }
    if (u.pathname === '/api/news') {
      let items = await getAllNews(q.get('refresh') === '1');
      const cats = list(q.get('categories')), langs = list(q.get('langs')), srcs = list(q.get('sources')), tags = list(q.get('tags'));
      const s = (q.get('q') || '').toLocaleLowerCase('tr');
      if (cats) items = items.filter((i) => cats.includes(i.category));
      if (langs) items = items.filter((i) => langs.includes(i.lang));
      if (srcs) items = items.filter((i) => srcs.includes(i.sourceId));
      if (tags) items = items.filter((i) => tags.some((t) => i.tags.includes(t)));
      if (s) items = items.filter((i) => `${i.title} ${i.summary}`.toLocaleLowerCase('tr').includes(s));
      const limit = Math.min(Number(q.get('limit')) || 100, 3000);
      return json({ count: items.length, items: items.slice(0, limit) });
    }
    if (u.pathname === '/api/onthisday') {
      try { return json({ items: await getOnThisDay() }); } catch { return json({ items: [] }); }
    }
    if (u.pathname === '/api/article') {
      const url = q.get('url') || '';
      if (!/^https?:\/\//.test(url)) return json({ error: 'Geçersiz adres' }, 400);
      try { return json(await getArticle(url)); } catch (err) { return json({ error: err.message }, 502); }
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
  return json({ error: 'Bulunamadı' }, 404);
}
