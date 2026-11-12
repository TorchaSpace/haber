// İyi haber tespiti: olumlu kelime var, olumsuz kelime yoksa "iyi haber" sayılır.
// Basit ama etkili; yeni kelime eklemek için listelere ekle.
const GOOD = [
  'rekor', 'keşif', 'keşfedil', 'buluş', 'kurtarıl', 'kurtardı', 'ödül', 'başarı', 'iyileş', 'tedavi bulundu', 'umut',
  'şampiyon', 'zafer', 'kazandı', 'galibiyet', 'mezun', 'bağış', 'yardım kampanyası', 'restore', 'yeniden açıldı', 'doğdu',
  'yavru', 'rescued', 'rescue', 'breakthrough', 'discover', 'record', 'wins', 'won', 'award', 'celebrat', 'cure', 'saved',
  'hope', 'first ever', 'milestone', 'success', 'triumph', 'champion', 'reunite', 'recover', 'heals', 'donat', 'volunteer',
  'restored', 'new species', 'yeni tür', 'born', 'baby', 'launch', 'fırlatıldı', 'festival', 'kutlama', 'inspir', 'joy',
];
const BAD = [
  'öldü', 'ölü', 'hayatını kaybet', 'yaralı', 'saldırı', 'savaş', 'deprem', 'kazada', 'kazası', 'kaza yap', 'kaza geçir', 'cinayet', 'öldürül', 'tutuklan', 'gözaltı',
  'yangın', 'sel felaket', 'selde', 'sel bask', 'sel sular', 'patlama', 'bomba', 'terör', 'kriz', 'skandal', 'iflas', 'işten çıkar', 'zam geldi', 'zamlandı', 'zammı', 'zam yap', 'zamlı', 'enflasyon', 'istifa', 'dava',
  'tehdit', 'şiddet', 'taciz', 'intihar', 'hastalık', 'salgın', 'dies', 'died', 'dead', 'death', 'killed', 'kill', 'war', 'attack',
  'crash', 'murder', 'shooting', 'shot', 'crisis', 'scandal', 'arrest', 'charged', 'lawsuit', 'fraud', 'flood', 'fire', 'strike',
  'protest', 'threat', 'abuse', 'cancer', 'outbreak', 'layoff', 'sued', 'banned', 'ban on', 'fears', 'warn', 'collapse', 'injur', 'victim',
  'spy', 'affair', 'homicide', 'torso', 'body found', 'police', 'polis', 'investigat', 'soruşturma', 'düştü', 'kaçırıl', 'hijack', 'bomb', 'terror', 'oust', 'fired', 'hoax', 'sanction', 'tariff', 'decline', 'loss', 'missile', 'drone', 'ceasefire', 'genocide',
];
const re = (list) => new RegExp(`(?<![\\p{L}])(${list.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'u');
const GOOD_RE = re(GOOD), BAD_RE = re(BAD);

export function moodOf(item) {
  const raw = `${item.title} ${item.summary || ''}`;
  const text = `${raw.toLocaleLowerCase('tr')} \n ${raw.toLowerCase()}`;
  if (BAD_RE.test(text)) return 'bad';
  if (GOOD_RE.test(text)) return 'good';
  return 'neutral';
}
