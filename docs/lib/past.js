// Haber zaman makinesi: bir konunun yıllar önce nasıl yazıldığını Google Haberler arşivinden getirir.
// Sunucu ve sunucusuz (iOS/web) sürüm aynı kodu kullanır; ağ isteği dışarıdan verilir (fetchText).

const cache = new Map();
const decode = (s) => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]) : ''; };

export function pastUrl(q, year, lang) {
  const query = `${q} after:${year}-01-01 before:${year + 1}-01-01`;
  const loc = lang === 'en' ? 'hl=en-US&gl=US&ceid=US:en' : 'hl=tr&gl=TR&ceid=TR:tr';
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${loc}`;
}

// q: konu, ago: kaç yıl önce, lang: tr|en. En fazla 8 haber döndürür.
export async function getPast({ q, ago, lang }, fetchText) {
  const year = new Date().getFullYear() - Math.max(1, Math.min(25, Number(ago) || 5));
  const key = `${lang}|${year}|${q.toLocaleLowerCase('tr')}`;
  if (cache.has(key)) return cache.get(key);
  const xml = await fetchText(pastUrl(q, year, lang));
  const seen = new Set();
  const items = (xml.match(/<item>[\s\S]*?<\/item>/g) || []).map((it) => {
    const source = tag(it, 'source');
    let title = tag(it, 'title');
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const d = new Date(tag(it, 'pubDate'));
    return { title, link: tag(it, 'link'), source, date: isNaN(d) ? null : d.toISOString() };
  })
    .filter((i) => i.title && i.link && !seen.has(i.title) && seen.add(i.title))
    .filter((i) => !i.date || new Date(i.date).getFullYear() === year)
    .slice(0, 8);
  const result = { year, items };
  if (items.length) cache.set(key, result);
  return result;
}
