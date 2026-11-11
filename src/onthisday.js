// "Bugün tarihte": Vikipedi'nin Türkçe "tarihte bugün" verisi. Günde bir kez çekilir.
import { moodOf } from './mood.js';

let cache = { day: '', items: [] };

export async function getOnThisDay() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  const key = `${mm}-${dd}`;
  if (cache.day === key && cache.items.length) return cache.items;
  const get = (type) => fetch(`https://api.wikimedia.org/feed/v1/wikipedia/tr/onthisday/${type}/${mm}/${dd}`, {
    headers: { 'User-Agent': 'HaberApp/0.3 (https://github.com/TorchaSpace/haber)' },
    signal: AbortSignal.timeout(10000),
  }).then((r) => r.json()).catch(() => ({}));
  const [sel, ev] = await Promise.all([get('selected'), get('events')]);
  const all = [...(sel.selected || []), ...(ev.events || [])];
  const seen = new Set();
  const items = all
    .filter((e) => e.year && e.text && !seen.has(e.text) && seen.add(e.text))
    .map((e) => {
      const page = (e.pages || []).find((p) => p.thumbnail) || (e.pages || [])[0] || {};
      return {
        year: e.year,
        ago: d.getFullYear() - e.year,
        text: e.text,
        image: page.thumbnail?.source || null,
        link: page.content_urls?.desktop?.page || null,
        title: page.normalizedtitle || page.titles?.normalized || '',
      };
    })
    .filter((e) => e.ago > 0)
    .map((e) => ({ ...e, bad: moodOf({ title: e.text }) === 'bad' }))
    // Görselli ve "yuvarlak" yıl dönümleri öne
    .sort((a, b) => (a.bad - b.bad) || (!!b.image - !!a.image) || ((b.ago % 25 === 0) - (a.ago % 25 === 0)) || ((b.ago % 10 === 0) - (a.ago % 10 === 0)))
    .slice(0, 8);
  cache = { day: key, items };
  return items;
}
