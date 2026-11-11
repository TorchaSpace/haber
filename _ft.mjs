import Parser from 'rss-parser';
const p = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0 HaberApp/0.2' } });
const urls = process.argv.slice(2);
await Promise.all(urls.map(async (u) => {
  try { const f = await p.parseURL(u); const it = f.items[0] || {};
    console.log('OK', f.items.length, u, '|', !!(it.enclosure || it['media:content']), (it.contentSnippet||'').length);
  } catch (e) { console.log('FAIL', u, e.message.slice(0, 50)); }
}));
