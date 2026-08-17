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

## SON DURUM (en son güncelleyen: Claude Code — 2026-08-17)
- Site CANLI: https://cssberlin.de (Hetzner /opt/cssberlin-v2, Docker Compose)
- Deploy git ile DEĞİL, dosya-senkronu ile → git yalnızca checkpoint/görünürlük için.
- Yerel = deploy edilmiş (son deploy bu commit'i içeriyor).
- Son biten: Antigravity'nin header hizalama + cat-nav-link işi denetlendi, 3 eksik
  düzeltildi (mobil dark-toggle, ölü product-card-hover, offset uyumu), deploy edildi.

## SONRAKİ ADIM (sıradaki ajan bunu yapsın)
- **Kategori doldurma:** TATANGA'da 3454 ürün hazır, sitede ~1. Kâr filtresini geçen
  (recommendation='buy' + condition_score≥3 + gpsr_ready=1) ürünleri kategori kategori
  cssberlin'e yayınla. Önce `Herren > jacken`'den ~30 ürün, dry-run sonra gerçek.
- TATANGA API: `POST http://<hub>:8501/api/product/{id}/publish` (çalışıyor, kanıtlı).
- Temizlik borcu: `ProductCard.tsx` ve `Header.tsx:488` sabit yükseklikleri (kritik değil).

## AÇIK RİSKLER
- Aynı repo (`websitenew`) iki ajanla paylaşılıyor. Sıra disiplinini bozmayın.
- eBay kazıması 403 (soğumada) — zorlama, engeli uzatır.
