# Haber

Dünyadaki haberleri tek çatı altında toplayan, kişisel zevklerine göre filtreleyip sıralayan bir haber uygulaması. Şu an başlangıç iskeleti aşamasında.

## Özellikler (v0.1)

- 44 Türkçe ve İngilizce kaynaktan haber toplar (BBC, NTV, Hürriyet, AA, TRT, Bloomberg HT, Webtekno, Guardian, NYT, TechCrunch, ESPN, IGN…)
- Haberleri 60+ niş etikete otomatik ayırır: takımlar, şirketler, ülkeler, konular (`src/tags.js`)
- Filtre çubuğu: etiketleri birleştirerek daraltma, zaman aralığı (1 saat / bugün / hafta), sıralama
- Konuları takip etme veya tamamen gizleme, kaynakları açıp kapatma
- **Farklı gözler:** aynı olayı yazan haberler tek kartta; Türk ve dünya basınının başlıkları yan yana (`src/stories.js`)
- **Öğrenen akış:** okuduğun, kaydettiğin, geçtiğin haberlerden öğrenir; her haberde "Bunu neden görüyorum?"
- **Hikaye takibi:** gelişen bir olayı takibe al, yeni gelişmeler zaman çizelgesinde birikir ve bildirim gelir
- **Hızlı ayıkla:** kartları sağa (kaydet), sola (geç), yukarı (oku) kaydır
- **Dünya haritası ve haber pasaportu:** ülkelere göre haberler, okuduğun ülkeler damgalanır (`src/countries.js`)
- **Haftan:** haftalık okuma özeti, unvanın, serin
- **Story'ler:** her kategori için günün öne çıkanları, otomatik ilerleyen tam ekran hikayeler
- **Günlük baskı:** sabah ve akşam, gazete gibi sayfa çevrilen ve biten bir özet
- **Günün testi** ve **"Bu başlık kimin?"** tahmin oyunu
- **İyi haber modu:** tek dokunuşla sadece olumlu haberler (`src/mood.js`)
- **Bugün tarihte:** akışın arasında Vikipedi'den tarihte bugün kartları
- **Rozetler:** okuma alışkanlıklarına göre kazanılan 17 rozet
- **Keşif atölyesi** (Keşfet menüsünde, `public/labs.js`), her biri tek dokunuşla açılır ve ilk açılışta kısa yönlendirme gösterir:
  - **Sonucu tahmin et:** başlığın olanı anlatan kısmı gizli; iyi mi kötü mü bitti, tahmin et ve karşılaştır
  - **Zaman makinesi:** bir konunun 1, 5 ya da 10 yıl önce ve bugün nasıl yazıldığı yan yana (`/api/past`, `src/past.js`)
  - **Kelime avı:** başlıktaki önemli terimi harflerle tamamla, kısa Vikipedi açıklamasıyla öğren, kelime defterine ekle
  - **Görüş haritası:** okuduğun kaynaklar yerel ↔ küresel ve iyimser ↔ kötümser eksenlerinde; dengeleyecek farklı bir göz önerisi
  - **Konu tuvali:** ilgi alanların sürüklenebilir kartlarda, aynı haberlerde buluşan konular çizgiyle bağlı
- **Menü çubuğu:** Mac menü çubuğunda şu an en çok konuşulan haberler döner
- Kategori ve dil tercihine göre filtreleme
- İlgi alanı anahtar kelimeleri: eşleşen haberler en üstte, vurgulu gösterilir
- "Sana Özel" akışı, kategori sekmeleri, anlık arama (`/` kısayolu)
- Görselli manşet ve kart ızgarası, iskelet yükleme, kademeli kart girişi
- Kaydetme (sonra oku), okunan haberlerin soluklaşması, paylaşma
- Uygulama içi okuyucu: haberin tamamı kaynağından çekilip temiz bir okuma görünümünde gösterilir (`/api/article`)
- Aşağı sürükleyerek kapanan okuma paneli, ilk açılışta ilgi alanı seçimi
- Açık/koyu tema (dairesel geçiş), hareket azaltma tercihine saygı
- Tercihler ve kaydedilenler tarayıcıda saklanır

## Çalıştırma

Node.js 18 veya üstü gerekir.

### Mac uygulaması

Klasördeki **Haber.app**'e çift tıkla; tarayıcı gerekmez, kendi penceresinde açılır. Haber.app GitHub'a gönderilmez, her bilgisayarda bir kez derlenir:

```bash
npm install
npm run build:mac
```

Geliştirirken derlemeden denemek için `npm run app`.

### Web sürümü


```bash
npm install
npm start
```

Ardından http://localhost:3000 adresini aç. Geliştirirken `npm run dev` dosya değişikliklerinde sunucuyu yeniden başlatır.

## Yapı

```
electron/
  main.mjs     Masaüstü uygulaması (Electron): sunucuyu içeride başlatır, pencereyi açar
src/
  server.js    Express sunucusu ve API (/api/news, /api/meta)
  article.js   Haberin tam metnini çıkarır (Readability) ve temizler
  feeds.js     RSS kaynaklarını çeker, birleştirir, 10 dk önbellekler
  sources.js   Haber kaynakları ve kategoriler (yeni kaynak buraya eklenir)
  tags.js      Otomatik etiketleme kuralları (yeni etiket buraya eklenir)
public/
  index.html, style.css, app.js   Arayüz ve tercih ekranı
```

### API

- `GET /api/meta` kategoriler ve kaynak listesi
- `GET /api/news?categories=dunya,teknoloji&langs=tr,en&sources=bbc-world&q=yapay+zeka&limit=100`

## Yol haritası

- [ ] Daha fazla kaynak ve dil (otomatik çeviri)
- [ ] Kullanıcı hesabı, tercihlerin sunucuda saklanması
- [ ] Okunan haberlere göre öğrenen öneri sistemi
- [ ] Aynı haberin farklı kaynaklardaki versiyonlarını gruplama
- [ ] Mobil uygulama / PWA, bildirimler

## iPhone

PC/Mac sürümü (Electron ve `npm start`) aynen çalışır. iPhone uygulaması **sunucusuz**: haberleri doğrudan telefon çeker (Capacitor HTTP ile), etiketleme ve hikaye gruplama cihazda yapılır; ayarlar ve kaydedilenler telefonda tutulur.

Kurulum (Mac'te bir kez; Xcode ve ücretsiz Apple ID yeterli):
1. `git pull` sonra Terminal'de proje klasöründe `npm run ios` → Xcode açılır.
2. Xcode'da sol üstten **App** → *Signing & Capabilities* → *Team* olarak kendi Apple ID'ni (Personal Team) seç.
3. iPhone'u kabloyla bağla, üst çubuktan iPhone'unu seç, ▶ düğmesine bas.
4. İlk seferde iPhone'da Ayarlar → Genel → VPN ve Aygıt Yönetimi → geliştirici → **Güven**.

Ücretsiz Apple ID ile uygulama 7 günde süresi dolar (Xcode'dan tekrar ▶ ile yenilenir); kalıcı kurulum/App Store için ücretli Apple Developer hesabı (yıllık 99$) gerekir. Mac olmadan doğrudan iPhone'a uygulama kurulamaz.

Geliştirme: iOS arayüzü `public/` ile ortaktır; `ios-app/build-www.mjs` onu ve `src/` içindeki ortak mantığı birleştirir, `/api/*` çağrılarını `ios-app/native-api.js` karşılar.

## Yol haritası

- [ ] Daha fazla kaynak ve dil (otomatik çeviri)
- [ ] Kullanıcı hesabı, tercihlerin sunucuda saklanması
- [ ] Okunan haberlere göre öğrenen öneri sistemi
- [ ] Aynı haberin farklı kaynaklardaki versiyonlarını gruplama
- [ ] Mobil uygulama / PWA, bildirimler

## iPhone

**En kolay yol: yayınla, telefonda adresi aç.** Repo'daki `render.yaml` ile Render'da ücretsiz yayınlanır:
https://render.com/deploy?repo=https://github.com/TorchaSpace/haber — GitHub ile giriş yap, *Apply* de. Birkaç dakika sonra `https://haber-xxxx.onrender.com` gibi bir adres verir; iPhone Safari'de aç → Paylaş → **Ana Ekrana Ekle**. Mac'in açık olması gerekmez. (Ücretsiz planda uygulama kullanılmayınca uyur, ilk açılış ~30 sn sürer.)

PC/Mac sürümü (Electron ve `npm start`) aynen çalışmaya devam eder. iPhone için iki yol var; ikisi de sunucunun çalıştığı bir adrese bağlanır.

**1) Hızlı yol: ana ekrana ekle (Xcode ve geliştirici hesabı gerekmez)**
1. Mac'te `npm run phone` çalıştır; terminalde `iPhone için: http://192.168.x.x:3000` yazar.
2. iPhone aynı Wi-Fi'deyken Safari'de bu adresi aç.
3. Paylaş düğmesi → **Ana Ekrana Ekle**. Haber, tam ekran uygulama gibi açılır.

**2) Yerel iOS uygulaması (Capacitor, Xcode gerekir)**
1. `npm run ios` (Mac'te; Xcode kurulu olmalı) → Xcode `ios-app/ios/App` projesini açar.
2. Xcode'da *App* hedefi → *Signing & Capabilities* → kendi Apple ID'ni (Personal Team) seç.
3. iPhone'u kabloyla bağla, üstten cihazını seç, ▶ ile çalıştır. (İlk seferde iPhone'da Ayarlar → Genel → VPN ve Aygıt Yönetimi'nden geliştiriciye güven.)
4. Uygulama açılınca sunucu adresini gir (`npm run phone` çıktısındaki adres). Ücretsiz hesapla uygulama 7 gün sonra süresi dolar; kalıcı/App Store dağıtımı için ücretli Apple Developer hesabı (yıllık 99$) gerekir.

Mac kapalıyken de kullanmak istersen sunucuyu bir yere yayınlayıp (Render, Fly.io vb. `npm start`, `HOST=0.0.0.0`, `PORT`) o https adresini gir.
