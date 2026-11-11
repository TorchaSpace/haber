// Otomatik etiketleme: haberin başlığı ve özetinden niş konuları çıkarır.
// Yeni etiket eklemek için listeye bir satır ekle: [id, etiket, grup, emoji, [anahtar kelimeler]]
// Kısa (3 harf ve altı) kelimeler tam kelime olarak eşleşir; uzunlar Türkçe ekleri de yakalar (Galatasaray'ın, Galatasaraylı).

export const tagGroups = {
  konu: 'Konular',
  teknoloji: 'Teknoloji',
  spor: 'Spor',
  ekonomi: 'Ekonomi & Piyasalar',
  bolge: 'Ülkeler & Bölgeler',
  kultur: 'Kültür & Yaşam',
  bilim: 'Bilim & Sağlık',
};

const TAGS = [
  // Teknoloji
  ['yapay-zeka', 'Yapay Zeka', 'teknoloji', '🤖', ['yapay zeka', 'artificial intelligence', 'ai', 'chatgpt', 'openai', 'anthropic', 'claude', 'gemini', 'llm', 'machine learning', 'makine öğrenmesi', 'deepmind', 'copilot', 'nvidia']],
  ['apple', 'Apple', 'teknoloji', '🍎', ['apple', 'iphone', 'ipad', 'macbook', 'ios', 'macos', 'tim cook', 'airpods', 'vision pro']],
  ['google', 'Google', 'teknoloji', '🔎', ['google', 'android', 'alphabet', 'youtube', 'pixel', 'chrome']],
  ['microsoft', 'Microsoft', 'teknoloji', '🪟', ['microsoft', 'windows', 'xbox', 'azure', 'satya nadella']],
  ['samsung', 'Samsung', 'teknoloji', '📱', ['samsung', 'galaxy']],
  ['musk', 'Elon Musk & Tesla', 'teknoloji', '🚗', ['elon musk', 'musk', 'tesla', 'spacex', 'starlink', 'xai']],
  ['meta', 'Meta & Sosyal Medya', 'teknoloji', '💬', ['meta', 'facebook', 'instagram', 'whatsapp', 'tiktok', 'threads', 'sosyal medya', 'social media', 'twitter', 'bluesky']],
  ['akilli-telefon', 'Akıllı Telefonlar', 'teknoloji', '📲', ['akıllı telefon', 'smartphone', 'telefon', 'xiaomi', 'huawei', 'oneplus']],
  ['cip', 'Çipler & Donanım', 'teknoloji', '🧩', ['çip', 'chip', 'semiconductor', 'yarı iletken', 'tsmc', 'intel', 'amd', 'ekran kartı', 'gpu', 'işlemci', 'processor', 'qualcomm']],
  ['siber', 'Siber Güvenlik', 'teknoloji', '🛡️', ['siber', 'cyber', 'hacker', 'hack', 'ransomware', 'fidye yazılım', 'veri sızıntı', 'data breach', 'malware', 'zararlı yazılım', 'güvenlik açığı', 'vulnerability']],
  ['elektrikli-arac', 'Elektrikli Araçlar', 'teknoloji', '🔋', ['elektrikli araç', 'electric vehicle', 'togg', 'byd', 'rivian', 'batarya', 'battery']],
  ['girisim', 'Girişimler', 'teknoloji', '🚀', ['startup', 'girişim', 'funding round', 'yatırım turu', 'series a', 'series b', 'unicorn', 'venture capital']],

  // Spor
  ['futbol', 'Futbol', 'spor', '⚽', ['futbol', 'football', 'soccer', 'süper lig', 'premier league', 'la liga', 'serie a', 'bundesliga', 'teknik direktör', 'transfer']],
  ['galatasaray', 'Galatasaray', 'spor', '🟡', ['galatasaray', 'cimbom']],
  ['fenerbahce', 'Fenerbahçe', 'spor', '🟨', ['fenerbahçe', 'fenerbahce', 'kanarya']],
  ['besiktas', 'Beşiktaş', 'spor', '⚫', ['beşiktaş', 'besiktas', 'kara kartal']],
  ['trabzonspor', 'Trabzonspor', 'spor', '🔵', ['trabzonspor', 'bordo-mavili']],
  ['milli-takim', 'Milli Takım', 'spor', '🇹🇷', ['milli takım', 'a milli', 'ay-yıldızlı', 'montella', 'national team']],
  ['sampiyonlar-ligi', 'Şampiyonlar Ligi', 'spor', '🏆', ['şampiyonlar ligi', 'champions league', 'avrupa ligi', 'europa league', 'konferans ligi', 'uefa']],
  ['premier-league', 'Premier League', 'spor', '🦁', ['premier league', 'arsenal', 'chelsea', 'liverpool', 'manchester united', 'man utd', 'manchester city', 'man city', 'tottenham', 'newcastle', 'aston villa']],
  ['basketbol', 'Basketbol & NBA', 'spor', '🏀', ['basketbol', 'basketball', 'nba', 'euroleague', 'lebron', 'alperen şengün', 'şengün']],
  ['f1', 'Formula 1', 'spor', '🏎️', ['formula 1', 'formula one', 'f1', 'grand prix', 'verstappen', 'hamilton', 'leclerc', 'norris', 'ferrari', 'red bull racing', 'mclaren']],
  ['tenis', 'Tenis', 'spor', '🎾', ['tenis', 'tennis', 'wimbledon', 'djokovic', 'alcaraz', 'sinner', 'nadal', 'atp', 'wta']],
  ['amerikan-sporlari', 'NFL & MLB', 'spor', '🏈', ['nfl', 'mlb', 'super bowl', 'quarterback', 'baseball', 'beyzbol', 'nhl']],
  ['voleybol', 'Voleybol', 'spor', '🏐', ['voleybol', 'volleyball', 'filenin sultanları']],

  // Ekonomi
  ['borsa', 'Borsa & Hisseler', 'ekonomi', '📊', ['borsa', 'bist', 'hisse', 'stock', 'shares', 'nasdaq', 'dow jones', 's&p 500', 'wall street', 'endeks']],
  ['faiz', 'Faiz & Merkez Bankası', 'ekonomi', '🏦', ['faiz', 'interest rate', 'merkez bankası', 'central bank', 'fed', 'federal reserve', 'tcmb', 'ecb', 'powell', 'karahan']],
  ['enflasyon', 'Enflasyon', 'ekonomi', '📈', ['enflasyon', 'inflation', 'tüfe', 'cpi', 'hayat pahalılığı', 'cost of living']],
  ['doviz', 'Döviz & Altın', 'ekonomi', '💱', ['dolar', 'euro', 'döviz', 'altın', 'gold', 'gram altın', 'sterlin']],
  ['kripto', 'Kripto Para', 'ekonomi', '₿', ['kripto', 'crypto', 'bitcoin', 'btc', 'ethereum', 'blockchain', 'stablecoin', 'binance', 'coinbase']],
  ['petrol', 'Petrol & Enerji', 'ekonomi', '🛢️', ['petrol', 'oil', 'brent', 'opec', 'doğalgaz', 'natural gas', 'akaryakıt', 'benzin', 'motorin', 'enerji', 'energy']],
  ['emlak', 'Konut & Emlak', 'ekonomi', '🏠', ['konut', 'emlak', 'kira', 'housing', 'real estate', 'mortgage', 'ev fiyat']],
  ['is-dunyasi', 'Şirketler & İş Dünyası', 'ekonomi', '💼', ['şirket', 'ceo', 'merger', 'acquisition', 'satın al', 'birleşme', 'işten çıkar', 'layoff', 'earnings', 'bilanço', 'kâr']],
  ['ticaret', 'Ticaret & Gümrük', 'ekonomi', '🚢', ['gümrük', 'tariff', 'tarife', 'ihracat', 'ithalat', 'export', 'import', 'trade war', 'ticaret savaşı']],
  ['calisma', 'Maaş & Çalışma Hayatı', 'ekonomi', '👷', ['asgari ücret', 'maaş', 'emekli', 'memur', 'grev', 'strike', 'wage', 'salary', 'pension', 'işsizlik', 'unemployment', 'sendika']],

  // Bölgeler
  ['turkiye', 'Türkiye', 'bolge', '🇹🇷', ['türkiye', 'turkey', 'türkiye', 'ankara', 'istanbul', 'erdoğan', 'erdogan', 'tbmm', 'meclis']],
  ['abd', 'ABD', 'bolge', '🇺🇸', ['abd', 'amerika', 'united states', 'washington', 'white house', 'beyaz saray', 'trump', 'biden', 'congress', 'kongre', 'pentagon']],
  ['avrupa', 'Avrupa & AB', 'bolge', '🇪🇺', ['avrupa birliği', 'european union', 'brüksel', 'brussels', 'avrupa komisyonu', 'european commission', 'almanya', 'germany', 'fransa', 'france', 'ingiltere', 'britain', 'uk', 'italya', 'italy', 'ispanya', 'spain']],
  ['rusya-ukrayna', 'Rusya-Ukrayna', 'bolge', '🇺🇦', ['ukrayna', 'ukraine', 'rusya', 'russia', 'putin', 'zelensky', 'zelenskiy', 'kremlin', 'kiev', 'kyiv', 'moskova', 'moscow']],
  ['orta-dogu', 'Orta Doğu', 'bolge', '🕌', ['israel', 'israil', 'gazze', 'gaza', 'filistin', 'palestin', 'hamas', 'hizbullah', 'hezbollah', 'iran', 'tahran', 'suriye', 'syria', 'lübnan', 'lebanon', 'irak', 'iraq', 'suudi', 'saudi', 'yemen', 'netanyahu']],
  ['cin', 'Çin & Asya', 'bolge', '🇨🇳', ['çin', 'china', 'chinese', 'pekin', 'beijing', 'şi cinping', 'xi jinping', 'tayvan', 'taiwan', 'japonya', 'japan', 'hindistan', 'india', 'güney kore', 'south korea', 'kuzey kore', 'north korea']],
  ['afrika', 'Afrika', 'bolge', '🌍', ['afrika', 'africa', 'nijerya', 'nigeria', 'sudan', 'mısır', 'egypt', 'kenya', 'etiyopya', 'ethiopia', 'güney afrika', 'south africa', 'kongo', 'congo']],
  ['latin-amerika', 'Latin Amerika', 'bolge', '🌎', ['latin amerika', 'latin america', 'brezilya', 'brazil', 'arjantin', 'argentina', 'meksika', 'mexico', 'venezuela', 'kolombiya', 'colombia', 'şili', 'chile', 'milei', 'lula']],

  // Genel konular
  ['secim', 'Seçimler & Siyaset', 'konu', '🗳️', ['seçim', 'election', 'oy', 'vote', 'parti', 'party', 'muhalefet', 'opposition', 'cumhurbaşkanı', 'president', 'başbakan', 'prime minister', 'parlamento', 'parliament']],
  ['savas', 'Savaş & Savunma', 'konu', '🎖️', ['savaş', 'war', 'ordu', 'military', 'army', 'füze', 'missile', 'saldırı', 'airstrike', 'ateşkes', 'ceasefire', 'nato', 'savunma bakan', 'ministry of defence', 'defense secretary', 'drone', 'İHA', 'asker', 'troops']],
  ['afet', 'Deprem & Afetler', 'konu', '🌋', ['deprem', 'earthquake', 'sel', 'flood', 'yangın', 'wildfire', 'kasırga', 'hurricane', 'tsunami', 'fırtına', 'storm', 'afet', 'disaster', 'heyelan']],
  ['hukuk', 'Hukuk & Yargı', 'konu', '⚖️', ['mahkeme', 'court', 'dava', 'lawsuit', 'yargı', 'judge', 'hakim', 'tutuklama', 'arrest', 'savcı', 'prosecutor', 'gözaltı', 'trial', 'verdict']],
  ['goc', 'Göç & Mülteciler', 'konu', '🧳', ['göç', 'göçmen', 'migrant', 'migration', 'immigration', 'mülteci', 'refugee', 'sığınmacı', 'asylum']],
  ['egitim', 'Eğitim', 'konu', '🎓', ['eğitim', 'education', 'okul', 'school', 'üniversite', 'university', 'öğrenci', 'student', 'öğretmen', 'teacher', 'yks', 'lgs', 'sınav']],
  ['ulasim', 'Ulaşım & Havacılık', 'konu', '✈️', ['havalimanı', 'airport', 'havayolu', 'airline', 'thy', 'boeing', 'airbus', 'uçuş', 'flight', 'demiryolu', 'railway', 'metro', 'otoyol']],
  ['magazin', 'Magazin & Ünlüler', 'konu', '✨', ['ünlü', 'celebrity', 'magazin', 'kraliyet', 'royal', 'prens', 'prince', 'prenses', 'princess', 'taylor swift', 'beyoncé', 'kardashian']],

  // Bilim & Sağlık
  ['uzay', 'Uzay', 'bilim', '🪐', ['uzay', 'space', 'nasa', 'esa', 'rocket', 'roket', 'mars', 'ay görevi', 'moon', 'artemis', 'astronot', 'astronaut', 'galaksi', 'galaxy', 'teleskop', 'telescope', 'asteroid', 'exoplanet', 'gezegen', 'planet']],
  ['iklim', 'İklim & Çevre', 'bilim', '🌱', ['iklim', 'climate', 'küresel ısınma', 'global warming', 'karbon', 'carbon', 'emisyon', 'emission', 'cop30', 'cop31', 'yenilenebilir', 'renewable', 'güneş enerjisi', 'solar', 'rüzgar enerjisi', 'kuraklık', 'drought', 'çevre', 'environment', 'biyoçeşitlilik', 'biodiversity']],
  ['saglik-arastirma', 'Tıp & Araştırma', 'bilim', '🧬', ['kanser', 'cancer', 'alzheimer', 'tedavi', 'treatment', 'ilaç', 'drug', 'aşı', 'vaccine', 'klinik', 'clinical', 'gen', 'gene', 'dna', 'hastalık', 'disease', 'virüs', 'virus', 'salgın', 'pandemic', 'outbreak']],
  ['beslenme', 'Beslenme & Zindelik', 'bilim', '🥗', ['beslenme', 'diet', 'diyet', 'nutrition', 'obezite', 'obesity', 'egzersiz', 'exercise', 'uyku', 'sleep', 'kilo', 'weight loss', 'ozempic', 'fitness', 'zihinsel sağlık', 'mental health', 'depresyon', 'depression']],
  ['arkeoloji', 'Arkeoloji & Tarih', 'bilim', '🏺', ['arkeoloji', 'archaeolog', 'antik', 'ancient', 'fosil', 'fossil', 'kazı', 'excavation', 'dinozor', 'dinosaur', 'tarih öncesi', 'prehistoric']],
  ['hayvanlar', 'Hayvanlar & Doğa', 'bilim', '🐾', ['hayvan', 'animal', 'species', 'wildlife', 'yaban hayatı', 'kuş', 'bird', 'balina', 'whale', 'köpek', 'dog', 'kedi', 'cat', 'okyanus', 'ocean']],

  // Kültür
  ['sinema', 'Sinema & Dizi', 'kultur', '🎬', ['film', 'movie', 'sinema', 'cinema', 'dizi', 'series', 'netflix', 'disney', 'hbo', 'oscar', 'box office', 'gişe', 'yönetmen', 'director', 'oyuncu', 'actor', 'actress', 'fragman', 'marvel']],
  ['muzik', 'Müzik', 'kultur', '🎵', ['müzik', 'music', 'albüm', 'album', 'şarkı', 'song', 'konser', 'concert', 'tour', 'turne', 'spotify', 'grammy', 'rapper', 'band']],
  ['kitap', 'Kitap & Edebiyat', 'kultur', '📚', ['kitap', 'book', 'roman', 'novel', 'yazar', 'author', 'edebiyat', 'literature', 'şiir', 'poetry', 'booker', 'nobel edebiyat']],
  ['sanat', 'Sanat & Tasarım', 'kultur', '🎨', ['sanat', 'art', 'müze', 'museum', 'sergi', 'exhibition', 'ressam', 'painter', 'tiyatro', 'theatre', 'theater', 'opera', 'bale', 'ballet', 'mimari', 'architecture', 'moda', 'fashion']],
  ['oyunlar', 'Video Oyunları', 'kultur', '🎮', ['video oyun', 'oyun konsolu', 'video game', 'gaming', 'playstation', 'ps5', 'nintendo', 'switch 2', 'xbox', 'steam', 'gta', 'esports', 'espor', 'valve']],
];

const SHORT = 3;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compiled = TAGS.map(([id, label, group, emoji, terms]) => {
  const parts = terms.map((t) => {
    const e = esc(t.toLocaleLowerCase('tr'));
    return t.length <= SHORT ? `(?<![\\p{L}\\p{N}])${e}(?![\\p{L}\\p{N}])` : `(?<![\\p{L}\\p{N}])${e}`;
  });
  return { id, label, group, emoji, re: new RegExp(parts.join('|'), 'u') };
});

export const tagList = compiled.map(({ id, label, group, emoji }) => ({ id, label, group, emoji }));

// Kategoriden gelen doğal etiketler (kaynağın türü belli olduğunda)
const CATEGORY_TAGS = { oyun: ['oyunlar'], saglik: ['saglik-arastirma'] };

export function tagItem(item) {
  // Hem Türkçe hem İngilizce küçük harfe çevir (Türkçede "AI" → "aı" olur, İngilizce kelimeler kaçmasın)
  const both = (s) => `${s.toLocaleLowerCase('tr')} \n ${s.toLowerCase()}`;
  const text = both(` ${item.title} ${item.summary} `);
  const titleText = both(item.title);
  const hits = [];
  for (const t of compiled) {
    if (t.re.test(text)) hits.push({ id: t.id, inTitle: t.re.test(titleText) });
  }
  // Başlıkta geçenler önce: en alakalı etiketler kartta görünür
  hits.sort((a, b) => b.inTitle - a.inTitle);
  const ids = hits.map((h) => h.id);
  for (const extra of CATEGORY_TAGS[item.category] || []) if (!ids.includes(extra)) ids.push(extra);
  // Türkçe gündem haberleri zaten Türkiye ile ilgili; kalabalık etmesin diye en sona
  return ids.slice(0, 6);
}
