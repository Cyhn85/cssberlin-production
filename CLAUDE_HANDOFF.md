# HANDOFF REPORT (CSS BERLIN) - Son 3 Saatlik İşlem Özeti

Bu belge, sistemi devralacak **Claude** veya diğer AI asistanları için son otomasyon (Antigravity/Gemini) sürecinde gerçekleştirilen işlemleri özetlemektedir.

## 1. Tamamlanan Mimari ve UI İşlemleri (Phase 2 & Phase 3)

### A. Vinted-Style UI Revizyonu (4-Butonlu Yapı)
*   `src/components/product/ProductCard.tsx` ve `src/app/product/[id]/page.tsx` dosyaları güncellendi.
*   Önceden sadece "Ürün Detayına Git" mantığıyla çalışan kartlar, Vinted benzeri **Orange & Green (#1A4D2E)** renk paletiyle 4 ana aksiyona bölündü:
    1.  **Sepete Ekle** (In den Warenkorb)
    2.  **Satın Al** (Direkt Kaufen)
    3.  **Fiyat Öner** (Pazarlık Yap)
    4.  **Soru Sor** (Mesaj Gönder)
*   Kullanıcının direkt katalogdan (veya ana sayfadan) "Satın Al / Sepete Ekle" tuşlarını tetiklemesi sağlandı.

### B. Sepet (Cart) Mantığı ve Favoriler Ayrımı
*   Sadece Favoriler (`useFavorites.ts`) varken, Ziyaretçi (Guest) uyumlu **Sepet** mantığı için `src/store/useCart.ts` oluşturuldu (Zustand + LocalStorage).
*   `Header.tsx` içerisindeki favori (Kalp) bildirim balonu, Sepet ikonuna taşındı.
*   Mobil ekran Hamburger menüsü (`Header.tsx`) Vinted standartlarına uyarlandı. Login olmayan kullanıcılar için büyük, turuncu "Giriş Yap/Kayıt Ol" butonları eklendi.

### C. Kargo ve Teslimat Kuralları (Elden Teslim)
*   `src/config/shipping-policy.ts` ve `CheckoutPage` (`src/app/checkout/[id]/page.tsx`) güncellendi.
*   "Abholung" kaldırılarak yerine **"Elden Ücretsiz Teslim (Berlin/Brandenburg)"** `HAND` metodu eklendi.
*   Kullanıcıyı teşvik etmek için "Siparişi yarına kadar verirseniz Kargo Bedava" (Kostenlos) promosyon ve banner kurgusu kodlandı. Checkout sayfası, NextAuth ile koruma altına alındı (Giriş yapmamış kullanıcıyı login sayfasına atıp geri döndürüyor).

### D. Colab GPU & Google Drive Worker (Zero-Trust)
*   Arka planda (Tatanga Hub'ın yorulmaması için) çalışacak GPU resim işleme ve watermark silme (IOPaint/LaMa & rembg) scripti oluşturuldu: `scratch/colab_ai_worker.py`.
*   Bu script Hub'a asla direkt dosya atmaz (Zero-Trust). Resmi alır, temizler, Google Drive'a (5TB) kaydeder ve Hub'a sadece bir bildirim yollar. Şifreleme için .env dosyasındaki `COLAB_SECRET_KEY` kullanır.

### E. Veritabanı Temizliği ve Stealth AI Prompting (Humanizer)
*   **Temizlik:** Satılan/Kalkan ürünlerin resim ve DB kayıtlarını 7 gün sonra silecek `src/app/api/cron/cleanup/route.ts` API uç noktası oluşturuldu. `CRON_SECRET` ile korundu.
*   **İnsansı AI (Humanizer):** Llama 3.1 ve Gemini API'lerine giden sistem komutları (`chat/route.ts` ve `generate-description/route.ts`), "Stealth Prompting" kurgusuyla güncellendi. Artık yapay zeka jargonu (Tauche ein, Perfekt für vs.) kullanılmayacak, tıpkı Kleinanzeigen'daki gerçek bir Alman gibi hafif gündelik bir dille ve mermi imleri olmadan yazacak.
*   Playwright e2e test ajanı kurgusu eklendi: `scratch/playwright_qa_agent.js`.

---

## 2. Claude'ye Notlar (Önemli Uyarılar)

Sevgili Claude, bu projeyi devralırken lütfen aşağıdaki kurallara ve kurgulara DİKKAT ET:

1.  **Worktree / Repo Disiplini:** Tüm Phase 2 ve Phase 3 işlemleri (bu belgedeki her şey) tamamlanmış, commit edilmiş (`feat: phase 2 ui and cart updates` ve `feat: phase 3 professional ai and security architecture`) ve **GitHub origin/master dalına pushlanmıştır.** İşlemlere başlarken yerelde `git status` veya `git pull` yapmayı unutma. (Kullanıcı, Hetzner canlı sunucusunda `git pull` yapıp yayınlayacak).
2.  **Yapay Zeka (AI) Route'ları ve API Key'ler:** AI özellikleri `src/app/api/ai/` altında bulunuyor. Sistemi sahte veriden kurtarıp gerçek modellere bağlamak için `.env` (veya `.env.local` / `.env.production`) dosyasına `GROQ_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `CRON_SECRET` ve `COLAB_SECRET_KEY` değişkenleri eklenmeli. `GROQ_API_KEY` olmadan `generate-description` mock dönmeye devam eder. İnsansılaştırma için 3. parti Bypasser KULLANMA, promptlara koyduğum "Stealth" komutları fazlasıyla yeterli.
3.  **UI/UX Vinted Standardı:** Kullanıcı Vinted ve Kleinanzeigen tarzı organik ve "gerçek satıcı" hissiyatı veren UI'ları tercih ediyor. TailwindCSS kullanırken Grid veya Bento box tasarımları yapma, mor/parlak neon borderlar KULLANMA. Turuncu (`var(--color-orange)`) ve Koyu Yeşil (`#1A4D2E`) ana temanın dışına çıkma.
4.  **Kargo (Shipping) Mimarisini Bozma:** `src/config/shipping-policy.ts` kargo ve indirim/bedava teslimat kurallarının **tek merkezidir (Single Source of Truth)**. Frontend'de hardcode fiyatlama yapma; her zaman bu poliçedeki değerleri çağır.
5.  **Plan Okuma:** Eğer proje gidişatıyla ilgili benim oluşturduğum "Implementation Plan" veya "Walkthrough" dosyalarına göz atmak istersen, `.gemini/antigravity/brain/` dizini altındaki artifact klasörlerinde bulunuyor. Ancak şu an itibarıyla okunması gereken en güncel yol haritası (kalan işlemler varsa) `task.md` ve repodaki `HANDOFF.md`'dir.
