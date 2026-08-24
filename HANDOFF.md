# BATON — Ajanlar arası devir dosyası

> İki ajan (Claude Code + Antigravity) SIRAYLA çalışır, asla aynı anda değil.
> Bu dosya "eldeki bayrak". Yeni başlayan ajan ÖNCE bunu okur, sonra iş yapar.

## KURALLAR (ikinize de)
1. **Başlarken:** `git log --oneline -5` + bu dosyayı oku. Başka hiçbir şey okuma. (~0 token)
2. **Bir iş bitip DEPLOY edince:** `git add -A && git commit -m "kısa mesaj"` → sonra bu
   dosyanın "SON DURUM" + "SONRAKİ ADIM" satırlarını güncelle. Deploy'suz commit yok.
3. **Devir:** Sen dururken son commit + bu dosya = karşı ajanın tek ihtiyacı.
4. **Aynı dosyaya aynı anda dokunmayın.** Aynı klasör olduğu için git çakışması olmaz;
   tek risk eşzamanlı düzenleme — o yüzden sıra sende değilken düzenleme yapma.
5. **Deploy komutu (kanıtlanmış):**
   `tar → scp → ssh "cd /opt/cssberlin-v2 && cp -r src /tmp/src_yedek_$(date +%s) && tar -xzf ... && docker compose --env-file .env.production up -d --build app"`

## SON DURUM (en son güncelleyen: Claude Code — 2026-08-23)
- Site CANLI: https://cssberlin.de (Hetzner /opt/cssberlin-v2, Docker Compose)
- Deploy git ile DEĞİL, dosya-senkronu ile → git yalnızca checkpoint/görünürlük için.
- Antigravity'nin Faz 1/2/7 turu **denetlendi ve tamamlandı**. Kabuk işi duruyor,
  altındaki kırıklar giderildi. Ayrıntı: bu turda yapılanlar listesi aşağıda.
- **DEPLOY EDİLMEDİ.** Yerelde `tsc --noEmit` temiz. `next build` için önce
  `src/middleware.ts` SİLİNMELİ (aşağıya bak) — Next 16 aynı anda middleware ve
  proxy dosyası olmasını reddediyor.

## BU TURDA YAPILANLAR (Claude Code — 2026-08-23, 2. tur)
1. **Oversell kilidi (risk A2) KAPANDI.** `create-session`'ın dev dalında
   transaction vardı ama **parayı alan Stripe dalında hiç kilit yoktu** — iki
   alıcı aynı saniyede iki ödeme sayfası alıyordu. Kilit artık `updateMany`'nin
   WHERE'inde (koşullu UPDATE atomik; oku-sonra-yaz READ COMMITTED altında kilit
   değil). `Product.reservedUntil` + `reservedById` eklendi: rezervasyonun
   süresi ve sahibi olmadan ilk yarım kalan ödeme ürünü kalıcı kilitlerdi.
   Stripe `expires_at` aynı ana sabitlendi. Süresi dolanlar hem gecelik cron'da
   hem katalog okuma yolunda (dakikada bir, bloklamadan) serbest bırakılıyor —
   30 dk'lık rezervasyonu gecelik cron'a bırakmak ürünü sabaha kadar gizlerdi.
2. **PAngV / MwSt (risk A3) KAPANDI.** `business-profile.ts` → `priceDisclosure`
   tek kaynak (§19 Kleinunternehmer dalıyla). Ürün kartı, ürün detayı (AGB kargo
   linkiyle) ve checkout toplamında görünüyor.
3. **`reservedById` sızıntısı yakalandı ve kapatıldı.** Deploy sonrası canlı API
   ölçümünde anonim çağrıya dönüyordu — hangi kullanıcının neyi almakta olduğunu
   yayınlıyordu. Sebep: ürün sorguları `include` kullanıyor, şemaya eklenen her
   kolon ertesi gün public JSON'da. Çağrı yerlerini tek tek düzeltmek bir
   sonraki kolonu yine açıkta bırakırdı → Prisma client'ta global `omit`
   (`omitApi` preview). Aynı tuzağa 3072'lik görsel embedding'i de düşmüştü.
4. Sipariş **zaman tüneli**: `components/order/OrderTimeline.tsx`, purchases ve
   sales detayında ortak. Bağlantı çizgisi her satırın kendi içinde çiziliyor —
   tek parça rail sabit satır yüksekliği isterdi (sihirli sayı yasağı).
5. **Satıcı profili**: 3. sekme (Über mich) + `verifications` rozetleri artık
   çiziliyor (hesaplanıp atılıyordu). "Folgen" `variant="glow"` — beyaz yazı
   turuncu üzerinde 3.3:1 ölçülüyordu, AA sınırı 4.5:1.
6. **Pazarlık kartları** (InboxThread): ürün küçük resmi, büyük teklif fiyatı,
   üstü çizili liste fiyatı; widget kendi açık zeminini kullanıyor (kendi
   baloncuğun yeşil, üstü çizili gri fiyat orada okunmuyordu). Butonlar 44px.
7. **Ürün detayı sekmeli** (Beschreibung / Details / Versand & Rückgabe).
   Açıklama `hidden lg:block` idi — telefonda ürün açıklaması hiç görünmüyordu.
8. **Transaktionen kabuğu**: purchases + sales ortak sekme çubuğu.
9. `button.tsx` artık ölü kod değil. `glow` varyantının gradyanı `-z-10`'da
   opak zeminin arkasındaydı, hiç görünmüyordu — düzeltildi. Ana sayfa ve
   checkout CTA'larına varyant DEĞİL sadece halka verildi; varyantın tabanı
   `bg-background`, iki dönüşüm butonunu soluklaştırırdı.
10. **Sunucu diski %100 doluydu** (163 MB boş) — build bu yüzden ENOSPC ile
    düştü. `docker builder prune` + dangling imaj temizliği ile %84'e indi.
    Volume'lara dokunulmadı. Bu tekrar edecek; disk izlenmeli.

## ALTYAPI — disk ve yedek (2026-08-24)

**Yedek artık gerçekten var ve geri yüklendiği KANITLANDI.**
- Öncesinde tek yedek dosyası **0 bayttı** (12 Ağustos'tan). `backup-postgres.sh`
  varsayılan olarak canlı olmayan `docker-compose.cloudflare.yml`'ye `exec`
  ediyordu; hiçbir kontrol olmadığı için 11 gün yedek var sanıldı. Aynı yanlış
  varsayılan 6 ops betiğinde vardı, hepsi düzeltildi.
- `ops/backup-offsite.sh`: pg_dump + boyut kontrolü + `pg_restore --list` ile
  içerik kontrolü. Ölçüm: **2.8 MB, doğrulandı.**
- **Restore tatbikatı yapıldı:** ayrı `cssberlin_restore_test` veritabanına geri
  yüklendi, `Product/User/Order` = **153/8/0**, canlıyla birebir aynı. Test DB
  silindi. Canlı veritabanına dokunulmadı.
- Kapsam veritabanı **ve** `uploads/`. Görseller Uploadthing'de DEĞİL, sunucunun
  diskinde (107 MB, `cssberlin.de/uploads/...` oradan servis ediliyor).
- **Şu an LOCAL ONLY** — rclone kurulu değil, yani off-site yedek YOK. Script
  bunu her çalıştığında log'a açıkça yazıyor. Google Drive'ı devreye almak için
  `ops/restore-offsite.md` → tek eksik adım rclone OAuth (hesap sahibi yapacak).

**Bozuk cron onarıldı.** `/opt/cssberlin-v2/cron-cleanup.sh` içindeki curl satırı
escape bozukluğuyla yazılmıştı (secret yok, URL kapanmamış, `-s` hatayı gizliyor).
`/var/log/cssberlin-cleanup.log` hiç oluşmamıştı → kurulduğundan beri tek kez bile
çalışmamış. `ops/cron-cleanup.sh` ile değiştirildi, test edildi:
`OK 200: {"message":"No obsolete products...","releasedReservations":0}`.

**Disk kendi kendini temizliyor.**
- `.dockerignore`'a `uploads` eklendi. Build context: **225.91 MB → 54.67 kB**
  (ölçüldü). ENOSPC'nin kök nedeni buydu — Next.js standalone trace'i 107 MB
  ürün fotoğrafını imaja kopyalamaya çalışıyordu.
- `ops/post-deploy-cleanup.sh` her deploy sonunda çalışır (build cache + dangling
  imaj, gerekirse journald). Test: **%87 → %84.**
- **`docker system prune -af` KULLANILMIYOR:** sunucu paylaşımlı (Buchhalter +
  fbref-predictions) ve `-a` bir önceki cssberlin imajını, yani rollback
  yolumuzu da siler. Volume prune da yok — Postgres verisi volume'da.

**Cron (root):**
```
15 4 * * * /opt/cssberlin-v2/ops/cron-cleanup.sh   >> /var/log/cssberlin-cleanup.log 2>&1
30 4 * * * /opt/cssberlin-v2/ops/backup-offsite.sh >> /var/log/cssberlin-backup.log  2>&1
```
`logrotate.d/cssberlin` ile bu log'lar haftalık döner. Saat 04:xx seçildi çünkü
fbref cron'ları 03:00'te yoğun.

**Açık risk:** disk 38 GB ve üç proje paylaşıyor (`/var/lib/docker` 15 GB,
`/var/log` 1.5 GB'ı büyük ölçüde fbref). Otomatik temizlik bunu geciktirir ama
çözmez; kalıcı çözüm disk büyütmek veya projeleri ayırmak.

## DEPLOY GERÇEKLERİ (kanıtlanmış)
- Aktif compose: **`docker-compose.yml`** (düz). Konteyner etiketiyle doğrulandı:
  `com.docker.compose.project.config_files=/opt/cssberlin-v2/docker-compose.yml`.
  Dosya başındaki yanıltıcı "cloudflare olanı kullanın" yorumu silindi.
- Şema değişince `src` yetmez: **`prisma/` de senkronlanmalı**, yoksa Docker
  imajındaki Prisma client eski şemadan üretilir.
- Canlı DB'nin `_prisma_migrations` tablosu **yok** (db push ile kurulmuş).
  `migrate deploy` bu durumda reddeder; ayrıca `db-setup` seed script'ini de
  tetikler. Bu turda kolonlar doğrudan `ALTER TABLE ... IF NOT EXISTS` ile
  eklendi. `ops/run-db-setup.sh` baseline yapacak şekilde hazır ama
  ÇALIŞTIRILMADI — çalıştırılacaksa `RUN_DB_SEED=0` zorunlu.
- SSH build'i **arka plana alma**: oturum kopunca build ölür. Sunucuda
  `setsid nohup ... > /tmp/cssb_build.log` ile başlat, log'u poll et.

## YAYIN ÖNCESİ ZORUNLU ADIMLAR (HER ÜRÜN İÇİN — BYPASS YOKTUR)
Publish fonksiyonu bu kontrolleri ENFORCE eder — skip_checks kaldırıldı.
1. `POST /api/product/{id}/generate-seo` → Almanca başlık + açıklama (Groq/Llama)
2. `POST /api/product/{id}/remove-bg` → BG kaldır + organik varyasyon + watermark
3. **İnceleme**: favori listesinde gör, fiyat/başlık/resim kontrol et
4. `POST /api/product/{id}/publish` → 1-2 tamamlanmamışsa HTTP 400 döner, yayın OLMAZ

## SONRAKİ ADIM (sıradaki ajan bunu yapsın)
- Faz 3-6 HÂLÂ AÇIK: satıcı künyesi/sekmeleri, Transaktionen kabuğu, kargo
  timeline'ı, mesajlaşma ve pazarlık kartlarının yeniden tasarımı.
- `src/components/ui/button.tsx` sitede HİÇBİR YERDE kullanılmıyor (0 import).
  Faz 1'in 44px ve `glow` çalışması bu yüzden siteye değmiyor. Ya bileşene
  geçilecek ya da dosya kaldırılacak — arada bırakılmayacak.
- E2 açık: Google ile girişte popup'ta takılma raporu doğrulanmadı.
- Risk raporlarındaki A2 (oversell kilidi) ve A3 (PAngV "inkl. MwSt") maddeleri
  hâlâ kodda karşılıksız.

## AÇIK RİSKLER
- Aynı repo (`websitenew`) iki ajanla paylaşılıyor. Sıra disiplinini bozmayın.
- eBay kazıması 403 (soğumada) — zorlama, engeli uzatır.
- **Google Lens riski**: Vinted'den alınan resimleri İŞLEMEDEN yayınlama. Organik
  varyasyon + BG kaldırma + watermark ZORUNLU.
