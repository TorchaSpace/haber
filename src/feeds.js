import Parser from 'rss-parser';
import { sources } from './sources.js';
import { tagItem } from './tags.js';

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) HaberApp/0.2' },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});
const CACHE_MS = 10 * 60 * 1000;
let cache = { at: 0, items: [] };

// Haberin görselini farklı RSS biçimlerinden bulmaya çalışır
function pickImage(it) {
  const media = [...(it.mediaContent || []), ...(it.mediaThumbnail || [])]
    .map((m) => m?.$)
    .filter((m) => m?.url && (!m.medium || m.medium === 'image'))
    .sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0));
  if (media[0]) return media[0].url;
  if (it.enclosure?.url && /image/.test(it.enclosure.type || 'image')) return it.enclosure.url;
  const html = it.contentEncoded || it.content || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

// BBC küçük görselleri büyük boyutla değiştir
const upscale = (url) => url?.replace(/&#0?38;|&amp;/g, '&').replace(/\/ace\/standard\/\d+\//, '/ace/standard/976/') ?? null;

async function fetchSource(src) {
  try {
    const feed = await parser.parseURL(src.url);
    return (feed.items || []).map((it) => ({
      id: it.guid || it.link,
      title: (it.title || '').trim(),
      link: it.link,
      summary: (it.contentSnippet || '').replace(/\s+/g, ' ').trim().slice(0, 320),
      date: it.isoDate || it.pubDate || null,
      image: upscale(pickImage(it)),
      source: src.name,
      sourceId: src.id,
      lang: src.lang,
      category: src.category,
    }));
  } catch (err) {
    console.warn(`[feeds] ${src.name} alınamadı: ${err.message}`);
    return [];
  }
}

export async function getAllNews({ force = false } = {}) {
  if (!force && Date.now() - cache.at < CACHE_MS && cache.items.length) return cache.items;
  const results = await Promise.all(sources.map(fetchSource));
  const seen = new Set();
  const items = results
    .flat()
    .filter((i) => i.title && i.link && !seen.has(i.link) && seen.add(i.link))
    .map((i) => ({ ...i, tags: tagItem(i) }))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  cache = { at: Date.now(), items };
  return items;
}
