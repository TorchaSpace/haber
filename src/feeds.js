import Parser from 'rss-parser';
import { sources } from './sources.js';

const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'HaberApp/0.1' } });
const CACHE_MS = 10 * 60 * 1000;
let cache = { at: 0, items: [] };

async function fetchSource(src) {
  try {
    const feed = await parser.parseURL(src.url);
    return (feed.items || []).map((it) => ({
      id: it.guid || it.link,
      title: (it.title || '').trim(),
      link: it.link,
      summary: (it.contentSnippet || '').slice(0, 280),
      date: it.isoDate || it.pubDate || null,
      image: it.enclosure?.url || null,
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
  const items = results
    .flat()
    .filter((i) => i.title && i.link)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  cache = { at: Date.now(), items };
  return items;
}
