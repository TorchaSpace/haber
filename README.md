# Haber

Dünyadaki haberleri tek çatı altında toplayan, kişisel zevklerine göre filtreleyip sıralayan bir haber uygulaması. Şu an başlangıç iskeleti aşamasında.

## Özellikler (v0.1)

- Türkçe ve İngilizce RSS kaynaklarından haberleri toplar (BBC, DW, Al Jazeera, The Guardian, The Verge, Ars Technica…)
- Kategori ve dil tercihine göre filtreleme
- İlgi alanı anahtar kelimeleri: eşleşen haberler en üstte, vurgulu gösterilir
- Haberlerde arama
- Tercihler tarayıcıda saklanır, açık/koyu tema otomatik

## Çalıştırma

Node.js 18 veya üstü gerekir.

```bash
npm install
npm start
```

Ardından http://localhost:3000 adresini aç. Geliştirirken `npm run dev` dosya değişikliklerinde sunucuyu yeniden başlatır.

## Yapı

```
src/
  server.js    Express sunucusu ve API (/api/news, /api/meta)
  feeds.js     RSS kaynaklarını çeker, birleştirir, 10 dk önbellekler
  sources.js   Haber kaynakları ve kategoriler (yeni kaynak buraya eklenir)
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
