import { createHash } from 'node:crypto';

// Hikaye gruplama: aynı olayı yazan haberleri farklı kaynaklardan bulup bir araya getirir.
// Yöntem: başlık + özet kelimelerinden TF-IDF vektörü, ülke ve etiketler de "kelime" olarak eklenir
// (böylece "İsrail" ve "Israel" gibi farklı dillerdeki haberler de eşleşebilir). Her haber, zaman
// penceresi içindeki en benzer hikayenin ortalamasına yeterince yakınsa ona katılır, değilse yeni hikaye açar.

const STOP = new Set(`
a an the and or but of to in on at for from by with as is are was were be been being it its this that these those
has have had will would can could may might not no yes over after before into about than then out up down new says
said say his her their they them he she we you our your who what when where why how which more most also just
amid against during under between while all any some one two three first last year years week day days time
ve ile bir bu şu o da de ki mi mu mı için gibi daha çok en ama fakat ancak veya ya hem ise olan olarak oldu olduğu
sonra önce kadar göre ilgili açıklama açıkladı dedi yeni son büyük ilk iki üç yıl gün saat nasıl neden ne kim
her hiç tüm bütün var yok şimdi bugün dün yarın üzerine karşı arasında haber haberi haberleri video foto canlı live
`.trim().split(/\s+/));

// Diller arası eşleşme için küçük sözlük (Türkçe kök → İngilizce kök, ikisi de 6 harfe kırpılır)
const TR_EN = {
  azil: 'impeach', grev: 'strike', bomba: 'bomb', okul: 'school', deprem: 'earthq', seçim: 'electi', savaş: 'war',
  ateşke: 'ceasef', saldır: 'attack', öldü: 'killed', hayatı: 'killed', tutukl: 'arrest', gözalt: 'detain', mahkem: 'court',
  dava: 'lawsui', yargıç: 'judge', hakim: 'judge', bakan: 'minist', başkan: 'presid', cumhur: 'presid', başbak: 'prime',
  meclis: 'parlia', senato: 'senate', faiz: 'rate', enflas: 'inflat', merkez: 'centra', banka: 'bank', borsa: 'stock',
  petrol: 'oil', doğalg: 'gas', iklim: 'climat', yangın: 'fire', sel: 'flood', fırtın: 'storm', kasırg: 'hurric',
  protes: 'protes', gösteri: 'protes', konut: 'housin', kira: 'rent', ücret: 'wage', vergi: 'tax', gümrük: 'tariff',
  ihraca: 'export', ithala: 'import', anlaşm: 'deal', zirve: 'summit', görüşm: 'talks', yaptır: 'sancti', füze: 'missil',
  asker: 'troops', ordu: 'army', yardım: 'aid', mülteci: 'refuge', göçmen: 'migran', hastan: 'hospit', aşı: 'vaccin',
  kanser: 'cancer', uzay: 'space', roket: 'rocket', yapay: 'ai', istifa: 'resign', kovuld: 'fired', görevd: 'oust',
  casus: 'spy', soruşt: 'invest', şampiy: 'champi', transf: 'transf', teknik: 'manage', maç: 'match', galibi: 'win',
  kazand: 'win', kaybet: 'lose', kral: 'king', kraliç: 'queen', prens: 'prince', papa: 'pope', ölüm: 'death',
};

const WINDOW_MS = 72 * 3600 * 1000;
const THRESHOLD = 0.32;

// Kelimeleri ayıkla: Türkçe ekleri kırp (apostroftan sonrası, uzun kelimelerde ilk 6 harf)
function tokenize(text) {
  const out = [];
  const words = text.toLocaleLowerCase('tr').normalize('NFC').split(/[^\p{L}\p{N}'’]+/u);
  for (let w of words) {
    w = w.split(/['’]/)[0];
    if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue;
    w = w.length > 6 ? w.slice(0, 6) : w;
    out.push(TR_EN[w] || w);
  }
  return out;
}

function vectorOf(item) {
  const v = new Map();
  const add = (k, w) => v.set(k, (v.get(k) || 0) + w);
  for (const t of tokenize(item.title)) add(t, 2);
  for (const t of tokenize((item.summary || '').slice(0, 160))) add(t, 0.6);
  for (const c of item.countries || []) add(`#c${c}`, 1.2);
  for (const t of item.tags || []) add(`#t${t}`, 0.4);
  return v;
}

const norm = (v) => Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0)) || 1;

export function clusterStories(items) {
  // IDF: nadir kelimeler daha belirleyici
  const vecs = items.map(vectorOf);
  const df = new Map();
  for (const v of vecs) for (const k of v.keys()) df.set(k, (df.get(k) || 0) + 1);
  const N = items.length;
  const idf = (k) => Math.log(1 + N / (df.get(k) || 1));
  const weighted = vecs.map((v) => {
    const w = new Map();
    for (const [k, x] of v) if ((df.get(k) || 0) < N * 0.08) w.set(k, x * idf(k)); // çok yaygın kelimeleri at
    return w;
  });

  // En yeni haberden başlayarak hikayelere dağıt
  const order = items.map((_, i) => i).sort((a, b) => new Date(items[b].date || 0) - new Date(items[a].date || 0));
  const stories = []; // { centroid: Map, n, members: [idx], latest }
  const index = new Map(); // kelime -> hikaye numaraları
  for (const i of order) {
    const v = weighted[i];
    if (!v.size) { stories.push({ centroid: v, members: [i] }); continue; }
    const t = new Date(items[i].date || 0).getTime();
    const cands = new Set();
    for (const k of v.keys()) for (const s of index.get(k) || []) cands.add(s);
    let best = -1, bestSim = 0;
    const nv = norm(v);
    for (const s of cands) {
      const st = stories[s];
      if (st.latest - t > WINDOW_MS) continue;
      if (st.members.some((m) => items[m].sourceId === items[i].sourceId)) continue; // aynı kaynak iki kez olmasın
      let dot = 0;
      for (const [k, x] of v) dot += x * (st.centroid.get(k) || 0) / st.n;
      const sim = dot / (nv * st.cn);
      if (sim > bestSim) { bestSim = sim; best = s; }
    }
    if (best >= 0 && bestSim >= THRESHOLD) {
      const st = stories[best];
      for (const [k, x] of v) {
        if (!st.centroid.has(k)) (index.get(k) || index.set(k, []).get(k)).push(best);
        st.centroid.set(k, (st.centroid.get(k) || 0) + x);
      }
      st.n++;
      st.members.push(i);
      // ortalama vektörün uzunluğu
      st.cn = norm(new Map([...st.centroid].map(([k, x]) => [k, x / st.n])));
    } else {
      const id = stories.length;
      stories.push({ centroid: new Map(v), n: 1, cn: nv, members: [i], latest: t });
      for (const k of v.keys()) (index.get(k) || index.set(k, []).get(k)).push(id);
    }
  }

  // İkinci geçiş: birbirine çok benzeyen ve ortak kaynağı olmayan hikayeleri birleştir (çoğunlukla TR + EN grupları)
  const live = stories.filter((st) => st.n);
  const mean = (st) => new Map([...st.centroid].map(([k, x]) => [k, x / st.n]));
  for (let a = 0; a < live.length; a++) {
    const A = live[a];
    if (!A.n) continue;
    const ma = mean(A);
    for (let b = a + 1; b < live.length; b++) {
      const B = live[b];
      if (!B.n || Math.abs(A.latest - B.latest) > WINDOW_MS) continue;
      const srcA = new Set(A.members.map((m) => items[m].sourceId));
      if (B.members.some((m) => srcA.has(items[m].sourceId))) continue;
      const mb = mean(B);
      let dot = 0;
      for (const [k, x] of ma) dot += x * (mb.get(k) || 0);
      if (dot / (norm(ma) * norm(mb)) < THRESHOLD * 0.9) continue;
      for (const [k, x] of B.centroid) A.centroid.set(k, (A.centroid.get(k) || 0) + x);
      A.n += B.n; A.members.push(...B.members); A.latest = Math.max(A.latest, B.latest);
      B.n = 0; B.members = [];
    }
  }

  // Her habere hikaye kimliği ve hikayedeki kaynak sayısını yaz; anahtar kelimeleri sakla (takip için)
  for (const st of stories) {
    if (!st.members.length) continue;
    const members = st.members.map((m) => items[m]);
    const sid = 's' + createHash('sha1').update(members.map((m) => m.link).sort()[0]).digest('hex').slice(0, 12);
    const keys = [...st.centroid.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k]) => k);
    for (const m of members) {
      m.storyId = sid;
      m.storySize = members.length;
      m.storyLangs = [...new Set(members.map((x) => x.lang))];
    }
    for (let j = 0; j < st.members.length; j++) items[st.members[j]].keys = keys;
  }
  return items;
}

// Takip edilen hikaye için: yeni haber, saklanan anahtar kelimelerle ne kadar örtüşüyor?
export { tokenize };
