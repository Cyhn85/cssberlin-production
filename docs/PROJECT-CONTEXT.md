# PROJE BAĞLAMI — tüm resim, tek yerde (bir kez oku, tekrar açıklama)

> Bu dosya OTOMATİK yüklenmez. Büyük resmi bilmen gerektiğinde bir kez oku.
> Günlük iş için `CLAUDE.md` + `HANDOFF.md` yeter. Bu dosya nadiren değişir.

## AMAÇ
Kullanıcı birbirine bağlı gerçek işletmeler kuruyor. Nihai hedef: ikinci-el arbitraj
gelirini otomatikleştirip sürdürülebilir bir gelir hattı (Berlin'de ev hedefi).

## 4 PROJE
| Proje | Ne | Konum | Durum |
|---|---|---|---|
| **cssberlin.de** | Vinted-tarzı ikinci-el pazaryeri (Next.js 16 + Prisma + Postgres) | yerel `Desktop/websitenew`, canlı Hetzner `/opt/cssberlin-v2` | CANLI |
| **TATANGA** | Kazıma/arbitraj hub'ı (FastAPI+Selenium+curl_cffi+aiosqlite) | `Desktop/tatanga/T11_HUB` | çalışıyor |
| **Buchhalter** | Muhasebe uygulaması (Alman Kleinunternehmer) | `Desktop/Buchhalter` | ayrı, büyük ölçüde bağımsız |
| **Pamiundmami** | Gelecek eğitim SaaS'ı (alan adı `pamiundmami.de` alındı) | — | ileride |

## KÖPRÜLER (nasıl bağlanıyorlar)
1. **TATANGA → cssberlin**: `publish_product()` → `POST https://cssberlin.de/api/products/import`
   (x-api-key, multipart görsel). Kâr filtresini geçen ürünler kategori kategori yayınlanır.
2. **Talep zekâsı → kazıma**: `logic/observation_store.py` (kategori-bazlı TSV + SQLite,
   satır ~93 bayt) + `demand_intel/demand_stats` (Wilson güven aralığı, Thompson örnekleme)
   → NE kazınacağını belirler. `category_plan.py` keşif/sömürü dengesiyle tur planlar.
3. **rate_guard**: platform-başına hız sınırı; engellenen platformu soğutur (eBay/Leboncoin
   üst üste istekle yakıldı — ders alındı).
4. **videocu → ViMax** (gelecek): sosyal medya videosu, avatar/kıyafet tutarlılığı; Colab GPU
   ile. Kazımadan SONRA. (Buchhalter memory `project_videocu_vimax_plani.md`)

## KARARLAR & İPTAL EDİLENLER (dead-end'ler — tekrar deneme)
- **Google Trends/PyTrends**: Nisan 2025'te arşivlendi, resmî API kapılı → KULLANILMADI.
  Onun yerine eBay `LH_Sold=1` satılmış-arşivi + kendi deep-liveness verimiz (sell-through).
- **pensive-bohr dalı** (eski cssberlin): terk edildi; canlıya `websitenew` geçti. Hetzner'de
  dokunulmadan duruyor (güvenlik ağı).
- **Colab ajanları (talep zekâsı için)**: GPU gereksiz, sadece HTTP+aritmetik → Hetzner'de
  çalışacak, Colab DEĞİL. Colab yalnız videocu/ViMax için (gerçek GPU lazım).
- **Vinted domainleri ayrı platform sanmak**: .de/.fr/.be/.pl/.co.uk AYNI pazaryeri →
  görsel-hash ile tekilleştirme (URL değil, dosya içeriği; ölçüldü).
- **shadcn üstüne 2. UI kütüphanesi**: reddedildi — "hiçbir özellik bozulmasın" ile çelişir.
- **OmniRoute/Headroom vb. proxy eklentileri**: reddedildi — makinede gerçek sırlar var
  (SSH/OAuth/DB), trafik-dinleyici proxy sızma riski.

## ŞU ANKİ DURUM (özet)
- cssberlin CANLI: login döngüsü düzeltildi, kategori şeridi + kapsam, header hizalama
  (Antigravity katkısı denetlendi+düzeltildi), layout-audit 0 kritik.
- TATANGA: 9 platform çalışıyor (Vinted×5, Kleinanzeigen, Marktplaats, Tradera, Leboncoin);
  eBay 403 soğumada; Depop/Sellpy/Percentil endpoint araştırması bekliyor. DB'de ~3454 ürün.
- Talep deposu: 3454 gözlem indeksli, ilk çapraz sorgular alındı (henüz karar için erken,
  deep-liveness haftalar gerektirir).

## HEDEFLER (sıra)
1. **Kategori doldurma** (ŞİMDİ): kâr filtresini geçen ürünleri kategori kategori yayınla.
   Boş katalog = organik müşteri kaçar. Site dolunca profesyonel görünür.
2. Ölü kazıyıcıları (Depop/Sellpy/Percentil) endpoint bulup onar.
3. Talep zekâsını otomatik tura sok (Hetzner cron, keşif/sömürü).
4. Kalan cila: ProductCard/Header sabit-yükseklik temizliği, Stripe (en son).

## RİSKLER / SINIRLAR
- Gmail app-password ve OAuth secret bu projede ifşa oldu → kullanıcı ROTATE etmeli.
- Aynı repo iki ajanla paylaşılıyor: sıra disiplinini bozma (HANDOFF + git).
- eBay'i zorlama (engeli uzatır). Kazımada CAPTCHA/otomatik-login yok (etik sınır).
