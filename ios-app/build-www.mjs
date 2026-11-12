// iOS uygulamasının web dosyalarını üretir: ../public arayüzü + cihazda çalışan haber motoru (sunucusuz).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const www = process.env.OUT ? path.resolve(process.env.OUT) : path.join(here, 'www');
const pub = path.join(here, '..', 'public');
const src = path.join(here, '..', 'src');

fs.rmSync(www, { recursive: true, force: true });
fs.cpSync(pub, www, { recursive: true });
fs.mkdirSync(path.join(www, 'lib'), { recursive: true });
fs.mkdirSync(path.join(www, 'vendor'), { recursive: true });

// Sunucu ile ortak saf mantık (kaynaklar, etiketler, ülkeler, hikaye gruplama, ruh hali, tarihte bugün)
for (const f of ['sources', 'tags', 'countries', 'stories', 'mood', 'onthisday']) {
  let code = fs.readFileSync(path.join(src, f + '.js'), 'utf8');
  if (f === 'stories') {
    // node:crypto yerine tarayıcıda çalışan basit özet
    code = code
      .replace("import { createHash } from 'node:crypto';", "const hash12 = (s) => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } return ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')).slice(0, 12); };")
      .replace(/createHash\('sha1'\)\.update\((.*?)\)\.digest\('hex'\)\.slice\(0, 12\)/, 'hash12($1)');
    if (code.includes('createHash')) throw new Error('stories.js dönüştürülemedi');
  }
  fs.writeFileSync(path.join(www, 'lib', f + '.js'), code);
}
fs.copyFileSync(path.join(here, 'native-api.js'), path.join(www, 'lib', 'native-api.js'));
fs.copyFileSync(path.join(here, 'native.js'), path.join(www, 'native.js'));
fs.copyFileSync(path.join(here, 'node_modules/@mozilla/readability/Readability.js'), path.join(www, 'vendor', 'Readability.js'));
fs.copyFileSync(path.join(here, 'node_modules/dompurify/dist/purify.min.js'), path.join(www, 'vendor', 'purify.min.js'));

// Sunucu çağrılarını (/api/...) cihazdaki motora yönlendiren betik, uygulamadan önce yüklenir
const idx = path.join(www, 'index.html');
let html = fs.readFileSync(idx, 'utf8');
html = html.replace('<script src="app.js"></script>',
  '<script src="vendor/Readability.js"></script>\n  <script src="vendor/purify.min.js"></script>\n  <script src="native.js"></script>\n  <script src="app.js"></script>');
if (!html.includes('native.js')) throw new Error('index.html güncellenemedi');
fs.writeFileSync(idx, html);
console.log('www hazır');
