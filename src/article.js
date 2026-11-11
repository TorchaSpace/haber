// Haberin tamamını kaynağından çekip okunabilir, temiz HTML'e çevirir (uygulama içi okuyucu için).
import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';
import createDOMPurify from 'dompurify';

const cache = new Map(); // url -> { at, data }
const CACHE_MS = 60 * 60 * 1000;
const purify = createDOMPurify(new JSDOM('').window);

export async function getArticle(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
      'Accept-Language': 'tr,en;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Kaynak ${res.status} döndürdü`);
  const html = await res.text();

  const dom = new JSDOM(html, { url: res.url, virtualConsole: new VirtualConsole() });
  const doc = dom.window.document;
  // Tembel yüklenen görselleri gerçek adreslerine çevir
  doc.querySelectorAll('img').forEach((img) => {
    const lazy = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
    if (lazy) img.setAttribute('src', lazy);
    if (img.getAttribute('src')) img.setAttribute('src', new URL(img.getAttribute('src'), res.url).href);
    img.removeAttribute('srcset');
  });
  const parsed = new Readability(doc).parse();
  if (!parsed?.content || parsed.textContent.trim().length < 200) throw new Error('Haber metni çıkarılamadı');

  const content = purify.sanitize(parsed.content, {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'svg'],
    FORBID_ATTR: ['style', 'class', 'id', 'width', 'height'],
  });
  const data = {
    title: parsed.title,
    byline: parsed.byline,
    siteName: parsed.siteName,
    content,
    minutes: Math.max(1, Math.round(parsed.textContent.trim().split(/\s+/).length / 200)),
    url: res.url,
  };
  cache.set(url, { at: Date.now(), data });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return data;
}
