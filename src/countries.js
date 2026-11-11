// Ülke tespiti: haberde geçen ülkeleri bulur (harita ve hikaye gruplama için).
// id: ISO 3166 sayısal kodu (harita verisiyle aynı). Kısa adlar tam kelime olarak eşleşir.
const COUNTRIES = [
  ['792', 'Türkiye', ['türkiye', 'turkey', 'turkish', 'ankara', 'istanbul', 'erdoğan', 'erdogan']],
  ['840', 'ABD', ['abd', 'amerika birleşik', 'united states', 'washington', 'white house', 'beyaz saray', 'american', 'trump', 'pentagon']],
  ['826', 'Birleşik Krallık', ['ingiltere', 'birleşik krallık', 'britain', 'british', 'england', 'london', 'londra', 'starmer', 'uk']],
  ['276', 'Almanya', ['almanya', 'germany', 'german', 'berlin', 'merz', 'alman']],
  ['250', 'Fransa', ['fransa', 'france', 'french', 'paris', 'macron', 'fransız']],
  ['380', 'İtalya', ['italya', 'italy', 'italian', 'roma', 'rome', 'meloni']],
  ['724', 'İspanya', ['ispanya', 'spain', 'spanish', 'madrid', 'sánchez', 'barcelona']],
  ['643', 'Rusya', ['rusya', 'russia', 'russian', 'moskova', 'moscow', 'kremlin', 'putin', 'rus']],
  ['804', 'Ukrayna', ['ukrayna', 'ukraine', 'ukrainian', 'kiev', 'kyiv', 'zelensky', 'zelenskiy']],
  ['156', 'Çin', ['çin', 'china', 'chinese', 'pekin', 'beijing', 'xi jinping', 'şi cinping', 'şangay', 'shanghai']],
  ['392', 'Japonya', ['japonya', 'japan', 'japanese', 'tokyo']],
  ['356', 'Hindistan', ['hindistan', 'india', 'indian', 'yeni delhi', 'new delhi', 'modi']],
  ['376', 'İsrail', ['israil', 'israel', 'israeli', 'tel aviv', 'netanyahu', 'kudüs', 'jerusalem']],
  ['275', 'Filistin', ['filistin', 'palestin', 'gazze', 'gaza', 'batı şeria', 'west bank', 'hamas']],
  ['364', 'İran', ['iran', 'iranian', 'tahran', 'tehran', 'hamaney', 'khamenei']],
  ['368', 'Irak', ['irak', 'iraq', 'iraqi', 'bağdat', 'baghdad']],
  ['760', 'Suriye', ['suriye', 'syria', 'syrian', 'şam', 'damascus']],
  ['422', 'Lübnan', ['lübnan', 'lebanon', 'lebanese', 'beyrut', 'beirut', 'hizbullah', 'hezbollah']],
  ['682', 'Suudi Arabistan', ['suudi', 'saudi', 'riyad', 'riyadh']],
  ['818', 'Mısır', ['mısır', 'egypt', 'egyptian', 'kahire', 'cairo']],
  ['634', 'Katar', ['katar', 'qatar', 'doha']],
  ['784', 'BAE', ['birleşik arap', 'uae', 'emirates', 'dubai', 'abu dabi', 'abu dhabi']],
  ['887', 'Yemen', ['yemen', 'husi', 'houthi']],
  ['400', 'Ürdün', ['ürdün', 'jordan', 'amman']],
  ['300', 'Yunanistan', ['yunanistan', 'greece', 'greek', 'atina', 'athens']],
  ['196', 'Kıbrıs', ['kıbrıs', 'cyprus', 'kktc', 'lefkoşa', 'nicosia']],
  ['031', 'Azerbaycan', ['azerbaycan', 'azerbaijan', 'bakü', 'baku', 'aliyev']],
  ['051', 'Ermenistan', ['ermenistan', 'armenia', 'armenian', 'erivan', 'yerevan']],
  ['268', 'Gürcistan', ['gürcistan', 'georgia', 'tiflis', 'tbilisi']],
  ['616', 'Polonya', ['polonya', 'poland', 'polish', 'varşova', 'warsaw']],
  ['528', 'Hollanda', ['hollanda', 'netherlands', 'dutch', 'amsterdam']],
  ['056', 'Belçika', ['belçika', 'belgium', 'brüksel', 'brussels']],
  ['752', 'İsveç', ['isveç', 'sweden', 'swedish', 'stockholm']],
  ['578', 'Norveç', ['norveç', 'norway', 'norwegian', 'oslo']],
  ['246', 'Finlandiya', ['finlandiya', 'finland', 'finnish', 'helsinki']],
  ['208', 'Danimarka', ['danimarka', 'denmark', 'danish', 'kopenhag', 'copenhagen', 'grönland', 'greenland']],
  ['756', 'İsviçre', ['isviçre', 'switzerland', 'swiss', 'cenevre', 'geneva', 'zürih', 'zurich']],
  ['040', 'Avusturya', ['avusturya', 'austria', 'viyana', 'vienna']],
  ['348', 'Macaristan', ['macaristan', 'hungary', 'hungarian', 'budapeşte', 'budapest', 'orbán', 'orban']],
  ['642', 'Romanya', ['romanya', 'romania', 'bükreş', 'bucharest']],
  ['100', 'Bulgaristan', ['bulgaristan', 'bulgaria', 'sofya', 'sofia']],
  ['688', 'Sırbistan', ['sırbistan', 'serbia', 'belgrad', 'belgrade']],
  ['620', 'Portekiz', ['portekiz', 'portugal', 'lizbon', 'lisbon']],
  ['372', 'İrlanda', ['irlanda', 'ireland', 'irish', 'dublin']],
  ['124', 'Kanada', ['kanada', 'canada', 'canadian', 'ottawa', 'toronto', 'carney']],
  ['484', 'Meksika', ['meksika', 'mexico', 'mexican']],
  ['076', 'Brezilya', ['brezilya', 'brazil', 'brazilian', 'lula', 'são paulo', 'rio de janeiro']],
  ['032', 'Arjantin', ['arjantin', 'argentina', 'argentine', 'buenos aires', 'milei']],
  ['862', 'Venezuela', ['venezuela', 'maduro', 'caracas']],
  ['170', 'Kolombiya', ['kolombiya', 'colombia', 'bogota', 'petro']],
  ['152', 'Şili', ['şili', 'chile', 'santiago']],
  ['604', 'Peru', ['peru', 'lima']],
  ['192', 'Küba', ['küba', 'cuba', 'havana']],
  ['036', 'Avustralya', ['avustralya', 'australia', 'australian', 'sidney', 'sydney', 'canberra']],
  ['554', 'Yeni Zelanda', ['yeni zelanda', 'new zealand']],
  ['410', 'Güney Kore', ['güney kore', 'south korea', 'seul', 'seoul']],
  ['408', 'Kuzey Kore', ['kuzey kore', 'north korea', 'pyongyang', 'kim jong']],
  ['158', 'Tayvan', ['tayvan', 'taiwan', 'taipei']],
  ['586', 'Pakistan', ['pakistan', 'islamabad', 'karachi']],
  ['004', 'Afganistan', ['afganistan', 'afghanistan', 'kabil', 'kabul', 'taliban']],
  ['050', 'Bangladeş', ['bangladeş', 'bangladesh', 'dakka', 'dhaka']],
  ['360', 'Endonezya', ['endonezya', 'indonesia', 'cakarta', 'jakarta']],
  ['608', 'Filipinler', ['filipinler', 'philippines', 'manila']],
  ['704', 'Vietnam', ['vietnam', 'hanoi']],
  ['764', 'Tayland', ['tayland', 'thailand', 'bangkok']],
  ['458', 'Malezya', ['malezya', 'malaysia', 'kuala lumpur']],
  ['566', 'Nijerya', ['nijerya', 'nigeria', 'lagos', 'abuja']],
  ['710', 'Güney Afrika', ['güney afrika', 'south africa', 'johannesburg', 'cape town']],
  ['404', 'Kenya', ['kenya', 'nairobi']],
  ['231', 'Etiyopya', ['etiyopya', 'ethiopia', 'addis ababa']],
  ['729', 'Sudan', ['sudan', 'hartum', 'khartoum', 'darfur']],
  ['434', 'Libya', ['libya', 'trablus', 'tripoli']],
  ['012', 'Cezayir', ['cezayir', 'algeria']],
  ['504', 'Fas', ['morocco', 'rabat', 'fas']],
  ['788', 'Tunus', ['tunus', 'tunisia']],
  ['180', 'Kongo', ['kongo', 'congo', 'kinşasa', 'kinshasa']],
  ['398', 'Kazakistan', ['kazakistan', 'kazakhstan', 'astana']],
  ['860', 'Özbekistan', ['özbekistan', 'uzbekistan', 'taşkent', 'tashkent']],
  ['112', 'Belarus', ['belarus', 'minsk', 'lukaşenko', 'lukashenko']],
];

const SHORT = 3;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compiled = COUNTRIES.map(([id, name, terms]) => ({
  id, name,
  re: new RegExp(terms.map((t) => {
    const e = esc(t.toLocaleLowerCase('tr'));
    return t.length <= SHORT ? `(?<![\\p{L}\\p{N}])${e}(?![\\p{L}\\p{N}])` : `(?<![\\p{L}\\p{N}])${e}`;
  }).join('|'), 'u'),
}));

export const countryList = compiled.map(({ id, name }) => ({ id, name }));

export function detectCountries(item) {
  const raw = ` ${item.title} ${item.summary} `;
  const text = `${raw.toLocaleLowerCase('tr')} \n ${raw.toLowerCase()}`;
  return compiled.filter((c) => c.re.test(text)).map((c) => c.id).slice(0, 5);
}
