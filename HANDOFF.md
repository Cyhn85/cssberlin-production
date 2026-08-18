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

## SON DURUM (en son güncelleyen: Claude Code — 2026-08-18)
- Site CANLI: https://cssberlin.de (Hetzner /opt/cssberlin-v2, Docker Compose)
- Deploy git ile DEĞİL, dosya-senkronu ile → git yalnızca checkpoint/görünürlük için.
- **Antigravity 18 ürün yayınladı AMA hepsi HATALI** — İngilizce başlıklar, boş açıklama
  (sadece GPSR notu), işlenmemiş resimler (Google Lens riski), aşırı fiyatlar. SİLİNECEK.
- Demo ürünler de silinecek (22 adet).
- TATANGA'ya publish güvenlik kontrolü EKLENDİ: SEO başlığı + açıklaması + işlenmiş
  görsel olmadan publish YAPILAMAZ (skip_checks=true ile zorlanabilir ama önerilmez).

## YAYIN ÖNCESİ ZORUNLU ADIMLAR (HER ÜRÜN İÇİN — BYPASS YOKTUR)
Publish fonksiyonu bu kontrolleri ENFORCE eder — skip_checks kaldırıldı.
1. `POST /api/product/{id}/generate-seo` → Almanca başlık + açıklama (Groq/Llama)
2. `POST /api/product/{id}/remove-bg` → BG kaldır + organik varyasyon + watermark
3. **İnceleme**: favori listesinde gör, fiyat/başlık/resim kontrol et
4. `POST /api/product/{id}/publish` → 1-2 tamamlanmamışsa HTTP 400 döner, yayın OLMAZ

## SONRAKİ ADIM (sıradaki ajan bunu yapsın)
- cssberlin DB temizliği (kullanıcı SQL çalıştıracak)
- Hub restart (Antigravity bitince)
- Kategori-bazlı kazıma turu başlat (`/api/scrape/category-round` eklendi)
- Kazınan ürünler → SEO → BG kaldır → inceleme → yayın

## AÇIK RİSKLER
- Aynı repo (`websitenew`) iki ajanla paylaşılıyor. Sıra disiplinini bozmayın.
- eBay kazıması 403 (soğumada) — zorlama, engeli uzatır.
- **Google Lens riski**: Vinted'den alınan resimleri İŞLEMEDEN yayınlama. Organik
  varyasyon + BG kaldırma + watermark ZORUNLU.
