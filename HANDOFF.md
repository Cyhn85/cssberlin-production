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

## BU TURDA YAPILANLAR (Claude Code)
1. `prisma/migrations/20240819000000_init/migration.sql` UTF-16 idi → UTF-8.
   Bu haliyle `prisma migrate deploy` sessizce bozuk SQL okuyordu.
2. Yeni migration: `20260823120000_product_image_variants`
   (`ProductImage.thumbUrl` + `mediumUrl`). Şema ve 6 API rotası bu kolonları
   kullanıyordu ama migration YOKTU → deploy anında checkout/favoriler/
   teklifler/siparişler 500 verecekti.
3. `ops/run-db-setup.sh` artık baseline yapıyor: canlı DB `db push` ile
   kurulduğu için `_prisma_migrations` boş; `migrate resolve --applied` ile
   init işaretlenip sonrasında `migrate deploy` sorunsuz çalışıyor.
4. `ProductCard`: ürün başlığı geri geldi (kaybolmuştu), kart gerçek `<a>`
   oldu (SEO + klavye + yeni sekmede aç), favori butonu çalışıyor,
   sepete ekle geri geldi, `aria-label` Almanca, oran 4:5'e döndü.
5. `useFavorites` modül-store'a çevrildi (useCart ile aynı kanıtlanmış desen) +
   giriş yapmış kullanıcıda `/api/favorites`'e senkron. Header'da favori rozeti
   artık gerçekten çiziliyor.
6. Header'daki **sahte kategori listesi silindi** ("Elektronik" kapsamda bile yok).
7. NextAuth `jwt` callback artık `role`/`isSuspended`'ı 60 sn'de bir DB'den
   tazeliyor. Öncesinde ban, oturumu açık kullanıcıyı 30 güne kadar etkilemiyordu.
8. Şifreli girişe brute-force limiti eklendi (IP+e-posta, AUTH tier).
   Öncesinde tek sınırsız kapı buydu.
9. `abuse-monitor` gerçekten bağlandı (mesaj + teklif) ve sayaç Redis'e taşındı;
   in-memory Map konteyner yeniden başlayınca sıfırlanıyordu.
10. `src/app/cart/page.tsx` yazıldı — header'ın sepet ikonu 404 veriyordu.
11. Checkout'taki **sahte kampanya bandı silindi** (Türkçe, her zaman görünen
    "yarın 23:59'a kadar kargo bedava" — UWG açısından yanıltıcı reklam).
    "Elden Ücretsiz Teslim" → "Kostenlose Selbstabholung".
12. Almanca umlaut/gramer taraması: 48 dosya, ~120 kelime (Verkaeufe→Verkäufe,
    moeglich→möglich, gemaess→gemäß …). URL slug'ları (`/ueber-uns`,
    `passwort-zuruecksetzen`) bilinçli olarak ASCII bırakıldı.
13. Renk kuralı: login logosu ve `glow` varyantındaki sabit hex'ler token'a
    bağlandı; `--color-primary-glow` eklendi (dark mode karşılığıyla).
14. Ana sayfa ızgarası katalogla aynı kırılıma alındı (`md:grid-cols-4`).

## DEPLOY ÖNCESİ ZORUNLU (bu sefer sadece `src` yetmez)
- `src/middleware.ts` SİL. Aynı işi `src/proxy.ts` zaten daha eksiksiz yapıyor
  (güvenlik başlıkları + korumalı API listesi dahil). İkisi bir arada
  `next build`'i kırıyor.
- Senkronlanacaklar: `src`, `prisma`, `ops`, `package.json`, `package-lock.json`.
- Sunucuda `db-setup` servisi ÇALIŞTIRILMALI (`RUN_DB_SEED=0` ile) — yeni
  migration onunla uygulanıyor.

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
