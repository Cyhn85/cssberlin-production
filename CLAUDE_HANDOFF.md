# HANDOFF REPORT (CSS BERLIN) - Son İşlem Özeti

Bu belge, sistemi devralacak **Claude** veya diğer AI asistanları için son otomasyon (Antigravity/Gemini) sürecinde gerçekleştirilen işlemleri özetlemektedir.

## 1. Tamamlanan Mimari ve UI İşlemleri (Phase 2 & Phase 3)

### A. Vinted-Style UI Revizyonu (4-Butonlu Yapı)
*   `src/components/product/ProductCard.tsx` ve `src/app/product/[id]/page.tsx` dosyaları güncellendi.
*   Kartlar Vinted benzeri **Orange & Green (#1A4D2E)** renk paletiyle 4 ana aksiyona bölündü:
    1.  **Sepete Ekle** (In den Warenkorb)
    2.  **Satın Al** (Direkt Kaufen)
    3.  **Fiyat Öner** (Pazarlık Yap)
    4.  **Soru Sor** (Mesaj Gönder)

### B. Sepet (Cart) Mantığı ve Favoriler Ayrımı
*   `src/store/useCart.ts` oluşturuldu — **useState + localStorage + custom event** ile çalışıyor (Zustand DEĞİL).
*   `Header.tsx` içerisindeki favori (Kalp) bildirim balonu Sepet ikonuna taşındı.
*   Mobil Hamburger menü Vinted standartlarına uyarlandı.

### C. Kargo ve Teslimat Kuralları (Elden Teslim)
*   `src/config/shipping-policy.ts` ve `CheckoutPage` güncellendi.
*   "Abholung" kaldırılarak yerine **"Elden Ücretsiz Teslim (Berlin/Brandenburg)"** `HAND` metodu eklendi.
*   Checkout sayfası NextAuth ile koruma altına alındı.

### D. Yapay Zeka İnsansılaştırma (Stealth Prompting)
*   `src/app/api/ai/chat/route.ts` ve `src/app/api/ai/generate-description/route.ts` promptları güncellendi.
*   Robotik kelimeleri engelleyen ve doğal pazar yeri dili zorunlu kılan Stealth Prompting kuralları eklendi.
*   Üçüncü parti AI Bypasser servisi kullanılmıyor — tüm insansılaştırma prompt içinde yapılıyor.

### E. Veritabanı Temizliği (Cron)
*   `src/app/api/cron/cleanup/route.ts` oluşturuldu.
*   `CRON_SECRET` ile korundı. `?dryRun=1` desteği mevcut.
*   Siparişi olan ürünler asla silinmiyor (§147 AO uyumlu).
*   Fotoğraflar `fs.rm` ile diskten gerçekten siliniyor.

### F. CSP ve www→apex Yönlendirmesi
*   `next.config.ts` CSP'ye `https://cssberlin.de` ve `https://www.cssberlin.de` eklendi.
*   www→apex 308 yönlendirmesi `redirects()` ile eklendi.

---

## 2. ÖNEMLİ NOTLAR (Diğer AI Asistanları İçin)

1.  **Worktree / Repo:** Tüm commit'ler GitHub origin/master'a pushlanmıştır. Commit atmak deploy etmek değildir — deploy kullanıcının onayıyla dosya senkronuyla yapılır.
2.  **AI Route'ları:** `src/app/api/ai/` altında sadece `chat`, `generate-description`, `price-suggestion`, `suggest-category` var. `tasks` diye bir route **yoktur** — Colab worker doğrudan Google Drive üzerinden çalışacak şekilde kurgulanmalıdır.
3.  **Prisma import:** Doğru import `import prisma from '@/lib/db'` şeklindedir. `@/lib/prisma` diye bir modül **yoktur**.
4.  **UI Renk Paleti:** Turuncu (`var(--color-orange)`) ve Koyu Yeşil (`#1A4D2E`). Bu dışına çıkılmamalı.
5.  **Kargo Kuralları:** `src/config/shipping-policy.ts` tek kaynak. Frontend'de hardcode fiyatlama yapılmamalı.
6.  **Colab Worker:** `scratch/` dizini repo içinde yoktur. Colab worker kodu Antigravity artifact'lerinde tutulmuştur, repoya commitlenmemiştir.
7.  **Playwright QA:** Henüz yazılmamıştır. İstenirse ayrı bir görev olarak ele alınmalıdır.
