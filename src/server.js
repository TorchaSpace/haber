import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getAllNews } from './feeds.js';
import { sources, categories } from './sources.js';

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

app.use(express.static(publicDir));

// Kaynak ve kategori listesi (tercih ekranı için)
app.get('/api/meta', (_req, res) => {
  res.json({ categories, sources: sources.map(({ id, name, lang, category }) => ({ id, name, lang, category })) });
});

// Haberler: ?categories=dunya,teknoloji&langs=tr,en&sources=bbc-world&q=yapay+zeka&limit=100
app.get('/api/news', async (req, res) => {
  const list = (v) => (v ? String(v).split(',').filter(Boolean) : null);
  const cats = list(req.query.categories);
  const langs = list(req.query.langs);
  const srcs = list(req.query.sources);
  const q = (req.query.q || '').toString().toLocaleLowerCase('tr');
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  let items = await getAllNews();
  if (cats) items = items.filter((i) => cats.includes(i.category));
  if (langs) items = items.filter((i) => langs.includes(i.lang));
  if (srcs) items = items.filter((i) => srcs.includes(i.sourceId));
  if (q) items = items.filter((i) => `${i.title} ${i.summary}`.toLocaleLowerCase('tr').includes(q));

  res.json({ count: items.length, items: items.slice(0, limit) });
});

app.listen(PORT, () => console.log(`Haber çalışıyor: http://localhost:${PORT}`));
