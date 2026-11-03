# Kasa

Kasa; Midas, Paribu, banka hesapları ve fiziksel kasada dağınık duran yatırımları tek, sade bir TL görünümünde izlemek için geliştirilmiş local-first bir kişisel portföy uygulamasıdır.

Kasa bir alım-satım veya yatırım danışmanlığı uygulaması değildir. Fiyatlar gecikmeli, gün sonu veya temsilî olabilir.

## Özellikler

- Önce kullandığınız banka, yatırım uygulaması, kripto borsası veya fiziksel kasayı tanımlama; mevcut eski konumları otomatik hesap listesine taşıma
- TEFAS yatırım fonu, dinamik aramalı ABD hissesi ve ayrı ABD ETF türü, BIST hissesi, kripto, döviz; gram, ziynet, Cumhuriyet/Ata ve Reşat altını kaydı
- Bono, tahvil ve Eurobond için ISIN, vade, maliyet ve elle güncellenen birim TL değeri
- Her pozisyona 500 karaktere kadar isteğe bağlı düz metin not
- Virgül veya noktayla kesirli miktar; 8 basamaktan küçük kripto ve kesirli hisse miktarlarını görünür tutma
- Aynı varlığı farklı hesap/konumlarda ayrı izleme
- Toplam güncel değer, bilinen maliyet, kâr/zarar ve mümkünse günlük değişim
- Hesaba ve varlık türüne göre filtreleme/gruplama
- Varlık türü ve hesap dağılımları
- Manuel yenileme ve 15 dakikada bir otomatik fiyat kontrolü
- Kaynak hatasında son başarılı fiyatı koruma ve görünür hata durumu
- Tarayıcıda yerel saklama; JSON dışa/içe aktarma
- Masaüstü ve mobil uyumlu, Türkçe arayüz

## Hızlı kurulum

Gereksinimler:

- Node.js 22.12 veya üstü
- npm (Node.js ile birlikte gelir)

Projeyi GitHub'dan klonlayıp bağımlılıkları kilit dosyasına göre kurun:

```bash
git clone https://github.com/KULLANICI_ADINIZ/kasa.git
cd kasa
npm ci
npm run dev
```

Ardından [http://127.0.0.1:5173](http://127.0.0.1:5173) adresini açın.

`npm run dev` hem React arayüzünü hem de yerel fiyat aracısını tek süreçte başlatır. `.env`, veritabanı, API anahtarı veya üyelik gerekmez.

Node sürüm yöneticisi kullanıyorsanız proje kökündeki `.nvmrc` ile uyumlu sürümü seçebilirsiniz:

```bash
nvm use
```

## GitHub'a yükleme

Bu depo `main` dalıyla başlatılmaya hazırdır. GitHub'da boş bir depo oluşturduktan sonra:

```bash
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/KULLANICI_ADINIZ/kasa.git
git push -u origin main
```

İlk commit'ten önce Git yapılandırmanızdaki e-posta adresini kontrol edin. Kişisel e-postanızı commit geçmişinde göstermek istemiyorsanız GitHub hesabınızın sunduğu gizli/no-reply adresini kullanın.

`node_modules/`, üretim çıktıları, `.env` dosyaları ve `kasa-yedek-*.json` kişisel yedekleri `.gitignore` ile depo dışında tutulur. GitHub Actions her push ve pull request'te `npm ci` ile temiz kurulum yapar, ardından testleri ve üretim derlemesini çalıştırır.

### Üretim derlemesi

Önce statik istemci ve Node sunucusunu üretin, sonra yerel üretim sunucusunu başlatın:

```bash
npm run build
npm start
```

### Test ve doğrulama

```bash
npm test
```

Testleri ve üretim derlemesini birlikte doğrulamak için:

```bash
npm run check
```

### Sık karşılaşılan kurulum sorunları

- `node --version` çıktısı `v22.12.0` veya daha yeni olmalı.
- `5173` portu doluysa mevcut süreci kapatın veya `PORT=5174 npm run dev` kullanın.
- Fiyatlar gelmiyorsa internet bağlantısını ve üçüncü taraf kaynakların erişilebilirliğini kontrol edin; kişisel portföy verileri yine yerelde kalır.

## Gizlilik mimarisi

Portföy kayıtları, miktarlar, maliyetler, hesap adları ve notlar yalnızca tarayıcının `localStorage` alanında tutulur. JSON yedeği hem varlıkları hem tanımlı hesap listesini içerir; eski yedeklerde hesap listesi yoksa konumlar otomatik olarak hesaplara dönüştürülür. Notlar HTML olarak yorumlanmaz; React tarafından kaçışlanmış düz metin olarak, en fazla 500 karakter saklanır. Uygulamada kullanıcı hesabı, kimlik doğrulama, telemetri veya kişisel veri veritabanı yoktur.

`server/` altındaki küçük Express servisi yalnızca üçüncü taraf fiyat kaynaklarına aynı origin üzerinden istek gönderen bir fiyat aracısıdır. Kalıcı veri yazmaz. Fiyat isteği sırasında varlık türü ve sembolü bu yerel sürece aktarılır; miktar, maliyet ve hesap adı aktarılmaz. Sunucu belleğindeki 15 dakikalık fiyat önbelleği ve 6 saatlik halka açık TEFAS katalog önbelleği süreç kapanınca silinir.

JSON yedeği kişisel tutarlarınızı içerir. Bu dosyayı güvenli bir yerde saklayın.

## Fiyat kaynakları

| Varlık | Kaynak | Dönüşüm / gecikme |
|---|---|---|
| TEFAS fon kataloğu | `POST https://www.tefas.gov.tr/api/funds/fonGetiriBazliBilgiGetir` | Aktif yatırım (`YAT`), emeklilik (`EMK`) ve borsa yatırım (`BYF`) fonlarının kod/adları; yerel proxy'de 6 saat önbelleklenir. |
| TEFAS fon fiyatı | `POST https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir` | Resmî TEFAS sayfasındaki günlük fon fiyatı; eski `BindHistoryInfo` kullanılmaz. |
| ABD hissesi arama | Yahoo Finance Search | Dinamik sonuçlar yalnızca NASDAQ/NYSE `EQUITY` kayıtlarıyla sınırlandırılır; 10 dakika süreç belleğinde tutulur. Birkaç popüler sembol tam katalog gibi sunulmaz. |
| ABD hissesi fiyatı | `GET https://query2.finance.yahoo.com/v8/finance/chart/{sembol}` | Sembol canlı doğrulanır; gecikmeli USD fiyatı `TRY=X` kuru ile TL'ye çevrilir. |
| ABD ETF arama | Yahoo Finance Search | Yalnızca `quoteType: ETF` ve geçerli ABD ETF pazarları kabul edilir; NYSE Arca (`PCX`) dahildir. Sonuçlar 10 dakika süreç belleğinde tutulur. |
| ABD ETF fiyatı | Yahoo Finance Chart + `TRY=X` | Gecikmeli USD ETF fiyatı `× USD/TRY × miktar` ile TL portföy değerine çevrilir. |
| BIST hissesi | Yahoo Finance Chart `{kod}.IS` | Kullanıcı temiz BIST kodunu görür; `.IS` yalnızca sağlayıcı isteğinde eklenir. TRY fiyatı doğrudan TL değeridir. |
| Döviz | Yahoo Finance Chart (`TRY=X`, `EURTRY=X` vb.) | İlgili para birimi/TRY gecikmeli kuru. |
| Kripto | `GET https://api.coingecko.com/api/v3/simple/price` | TRY fiyatı ve 24 saatlik değişim; genel uç noktanın oran sınırlarına tabidir. |
| Saf gram altın göstergesi | Yahoo Finance Chart `GC=F` + `TRY=X` | Ons altın vadeli kontratı `× USD/TRY ÷ 31,1034768` ile yaklaşık TL/saf gram hesaplanır. |
| Altın ürünlerinin metal değeri | Darphane standart ağırlığı ve milyemi | Saf gram göstergesi `× brüt ağırlık × saflık`; adetle izlenen ürünlerde adet başına hesaplanır. |
| Bono / tahvil / Eurobond | Kullanıcının girdiği güncel birim TL değeri | Anahtarsız ve güvenilir ortak bir fiyat kaynağı olmadığı için otomatik fiyat üretilmez; günlük değişim gösterilmez. |

Kaynaklar ücretsiz ve API anahtarsız seçilmiştir. Bunun karşılığında hizmet sürekliliği garantisi yoktur:

- TEFAS 2026'da eski uçlarını kaldırdı. Kasa güncel `api/funds/fonGetiriBazliBilgiGetir` katalog ve `api/funds/fonFiyatBilgiGetir` fiyat uçlarını kullanır; resmî site yeniden değişirse arama veya fiyatlar geçici olarak çalışmayabilir.
- Bazı fiyatı yayımlanan fonlar aktif YAT/EMK/BYF katalog listelerinde bulunmayabilir. Örneğin 3 Kasım 2026 canlı kontrolünde TI1 katalogların hiçbirinde yokken fiyat ucu `İŞ PORTFÖY PARA PİYASASI (TL) FONU` adını ve güncel fiyat geçmişini döndürdü. Kasa tam fon kodunda fiyat ucuna başvurur, resmî adı doldurur ve katalog dışı durumu engelleyici olmayan bir uyarıyla gösterir; TI1'e özel sabit kayıt içermez. Katalog arama yanıtları tarayıcıda önbelleklenmez, katalog verisinin sunucu belleğindeki sürümü `2` olarak raporlanır.
- Yahoo Finance Search/Chart anahtarsız sağlayıcı uçlarıdır; NASDAQ, NYSE, NYSE Arca veya Borsa İstanbul'un resmî veri akışı değildir. Gecikme, oran sınırı veya uç değişikliği görülebilir. Arama/validasyon başarısızsa geçersiz menkul kıymet sessizce kaydedilmez. Midas'ın 24 saatlik işlem fiyatı farklı seansları veya kendi sağlayıcı/makasını içerebildiğinden Kasa fiyatıyla birebir eşleşmeyebilir.
- ABD şirket hisseleri `ABD Hissesi`, borsa yatırım fonları `ABD ETF` olarak ayrı saklanır, filtrelenir ve gruplanır. Böylece mevcut hisse kayıtları değişmeden kalırken ETF kartları açıkça ayırt edilir.
- 3 Kasım 2026 canlı Yahoo doğrulamasında NASA (`Tema Space Innovators ETF`), COPX (`Global X Copper Miners ETF`) ve VOO (`Vanguard S&P 500 ETF`) Search yanıtında `quoteType: ETF`, `exchange: PCX`, `exchDisp: NYSEArca`; Chart yanıtında `instrumentType: ETF` ve `currency: USD` olarak döndü. Üçü de sabit liste olmadan canlı arama ve sembol doğrulamasıyla eklenir.
- CoinGecko anahtarsız kullanımda oran sınırı uygulayabilir.
- Piyasa fiyatları gerçek zaman garantili değildir. Tatil ve hafta sonlarında son işlem günü görünür.
- Altın değeri spot kuyumcu veya banka alış/satış fiyatı değildir; `GC=F` vadeli ons altın fiyatından hesaplanan yaklaşık saf metal değeridir. İşçilik, sikke/ürün primi, makas ve komisyon içermez.
- Hiçbir kaynak yanıt vermediğinde Kasa sessizce örnek veya uydurma fiyat üretmez.
- Bono, tahvil ve Eurobond değerleri otomatik piyasa verisi gibi sunulmaz. Kullanıcının yazdığı birim TL değeri `miktar × birim değer` formülüyle hesaplanır; vade ve ISIN bilgi amaçlı saklanır.

### Kesirli miktar ve hassasiyet

Miktar alanı HTML `number` kısıtlarına bağlı değildir; `0,0000003` ve `0.0000003` aynı değere normalleştirilir. Bu ortak giriş kripto, fon, gram altın, BIST, ABD hissesi ve ABD ETF dahil kesirli miktarın anlamlı olduğu türlerde kullanılır; adetle izlenen ziynet/Ata/Reşat altınlarında tam sayı denetimi devam eder. Kartlar çok küçük ama sıfır olmayan miktarları ve kuruş altı değerleri `0` gibi göstermez.

Mevcut veri modeli JavaScript `Number` kullanır. Bu, `0,0000003` ve tipik portföy miktarlarını JSON dışa/içe aktarmada aynı sayısal değerle korur; yaklaşık 15–17 anlamlı basamağın ötesinde keyfi hassasiyetli muhasebe garantisi vermez. Form bilimsel gösterimi zorunlu kılmaz ve mevcut sayıları düzenlerken düz ondalık metne açar.

### Altın türleri ve resmî standartlar

Cumhuriyet ziynet ve sikke değerleri [Darphane'nin Cumhuriyet Altını Üretimi sayfasındaki](https://www.darphane.gov.tr/cumhuriyet-altini-uretimi) ağırlık ve 916,6 milyem standardına dayanır. Reşat birlik ve beşli ağırlıkları ile 22 ayar bilgisi [Darphane ve Damga Matbaası 2024 Faaliyet Raporu'nda](https://ms.hmb.gov.tr/uploads/sites/7/2025/07/baski-DARPHANE-ve-DAMGA-MATBAASI-GENEL-MUDURLUGU-2024-FAALIYET-RAPORU_-838a16a10da3804b.pdf) yayımlanmıştır. Hazine ve Maliye Bakanlığı'nın [Altın Tahvili Yatırımcı Kılavuzu](https://ms.hmb.gov.tr/uploads/2019/01/Alt%C4%B1n-Tahvili-Yat%C4%B1mc%C4%B1-K%C4%B1lavuzu-Aral%C4%B1k-2018.pdf) da Cumhuriyet altınları için aynı ağırlık/saflık yaklaşımını ve onsun 31,1035 grama çevrilmesini açıklar.

| Kasa türü | Birim | Brüt ağırlık | Saflık |
|---|---:|---:|---:|
| Gram altın (24 ayar) | gram | 1 g | 1,0000 |
| Çeyrek ziynet | adet | 1,754 g | 0,9166 |
| Yarım ziynet | adet | 3,508 g | 0,9166 |
| Tam ziynet | adet | 7,016 g | 0,9166 |
| Gremse / iki buçukluk ziynet | adet | 17,540 g | 0,9166 |
| Beşli ziynet | adet | 35,080 g | 0,9166 |
| Cumhuriyet / Ata lira | adet | 7,216 g | 0,9166 |
| Reşat birlik | adet | 7,216 g | 0,9166 |
| Reşat beşli | adet | 36,080 g | 0,9166 |

Değerleme formülü `yaklaşık metal değeri = saf gram altın gösterge fiyatı × brüt gram × saflık × miktar` şeklindedir. Gram altın miktarı gram; diğer türler tam sayı adet olarak girilir. Birim alış maliyeti de seçilen birime göre gram veya adet başına yazılır.

Önceki sürümden gelen ve `goldKind` alanı olmayan altın kayıtları açılışta otomatik olarak `gram` türüne taşınır; görünen ad, miktar, maliyet, konum, kimlik ve oluşturulma zamanı korunur. Yeni tür alanı JSON yedeklerinde dışa aktarılır ve eski yedekler içe alınırken aynı göç uygulanır.

## Proje yapısı

```text
src/
  App.tsx        Arayüz ve kullanıcı akışları
  accounts.ts    Kullanıcının banka/uygulama listesi ve eski konum göçü
  api.ts         Yerel fiyat servisi istemcisi ve son-başarılı fiyat birleştirme
  catalog.ts     Önerilen semboller ve arayüz metadatası
  bist.ts        BIST kodu ve Yahoo `.IS` normalizasyonu
  fixed-income.ts Bono, tahvil ve Eurobond türleri
  quantity.ts    Virgül/nokta kabul eden kesirli miktar normalizasyonu
  domain.ts      Portföy değerleme ve dağılım hesapları
  storage.ts     localStorage ile doğrulanan JSON içe/dışa aktarma
server/
  index.ts       Kayıtsız yerel Express fiyat aracısı
  fund-catalog.ts Güncel TEFAS aktif fon kataloğu, arama ve önbellek
  providers.ts   TEFAS, Yahoo Finance ve CoinGecko adaptörleri
```

İstemci Vite + React + TypeScript, yerel fiyat aracısı Express ile geliştirilmiştir. `npm run dev` tek süreçte hem Vite geliştirme katmanını hem API'yi açar. `npm run build` statik istemciyi ve Node sunucusunu üretir.

## Veri temizleme

Tarayıcı geliştirici araçlarından bu siteye ait depolamayı temizlemek tüm Kasa kayıtlarını siler. Önce arayüzdeki **Yedekle** düğmesiyle JSON yedeği almak önerilir.
# kasa
