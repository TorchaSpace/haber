// Haber kaynakları (RSS). Yeni kaynak eklemek için bu listeye bir satır eklemen yeterli.
// category: gundem | dunya | teknoloji | ekonomi | spor | bilim | kultur
export const sources = [
  { id: 'bbc-turkce', name: 'BBC Türkçe', url: 'https://feeds.bbci.co.uk/turkce/rss.xml', lang: 'tr', category: 'gundem' },
  { id: 'dw-turkce', name: 'DW Türkçe', url: 'https://rss.dw.com/rdf/rss-tur-all', lang: 'tr', category: 'gundem' },
  { id: 'bbc-world', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', lang: 'en', category: 'dunya' },
  { id: 'aljazeera', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', lang: 'en', category: 'dunya' },
  { id: 'guardian-world', name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', lang: 'en', category: 'dunya' },
  { id: 'bbc-business', name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', lang: 'en', category: 'ekonomi' },
  { id: 'theverge', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', lang: 'en', category: 'teknoloji' },
  { id: 'ars', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', lang: 'en', category: 'teknoloji' },
  { id: 'bbc-science', name: 'BBC Science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', lang: 'en', category: 'bilim' },
  { id: 'bbc-sport', name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml', lang: 'en', category: 'spor' },
  { id: 'guardian-culture', name: 'Guardian Culture', url: 'https://www.theguardian.com/culture/rss', lang: 'en', category: 'kultur' },
];

export const categories = {
  gundem: 'Gündem',
  dunya: 'Dünya',
  teknoloji: 'Teknoloji',
  ekonomi: 'Ekonomi',
  spor: 'Spor',
  bilim: 'Bilim',
  kultur: 'Kültür & Sanat',
};
