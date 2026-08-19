# GÖREV: Doğrulanmış hataların giderilmesi (CSS Berlin)

Bu görev listesi, canlı sistem üzerinde **ölçülerek** tespit edilmiş hatalardan
oluşuyor. Her madde bir kanıtla birlikte veriliyor.

## ÖNCE OKU — çalışma kuralları

1. **İddia etme, kanıtla.** Her madde için "Kabul kriteri" var. Bitirdiğinde her
   kriterin çıktısını rapora yapıştır. Komut çıktısı olmayan madde yapılmamış
   sayılır.
2. **Dosya oluşturduğunu söylediğinde `ls -la <yol>` çıktısını ekle.** Geçen turda
   `scratch/colab_ai_worker.py` ve `scratch/playwright_qa_agent.js` dosyalarını
   "oluşturdum" dedin; ikisi de yok, `scratch/` dizini hiç açılmamış.
3. **`npx tsc --noEmit` ve `npx next build` komutlarını bitirmeden çalıştır.**
   Geçen turda pushladığın kod `next build` aşamasında 3 hatayla çöküyordu; yani
   deploy edilse site komple kırılacaktı.
4. **Var olduğunu varsaydığın hiçbir modülü import etme.** `@/lib/prisma` diye bir
   dosya yok (doğrusu `@/lib/db`, üstelik default export). Yazdığın yorum bile
   "Assuming this exists" diyordu — import etmeden önce `ls src/lib/` çalıştır.
5. **Deploy git ile olmuyor**, dosya senkronuyla oluyor. Commit atmak yayına almak
   değildir. Deploy'u ben (kullanıcı) onaylayacağım, sen yapma.
6. Renk paleti turuncu + `#1A4D2E` dışına çıkma; kargo kuralları yalnızca
   `src/config/shipping-policy.ts` üzerinden okunacak.

---

## 1. Ürün görselleri www hostunda CSP tarafından bloklanıyor (KRİTİK, canlı hata)

**Belirti:** Ziyaretçi `www.cssberlin.de` üzerinden girdiğinde katalogdaki ve ürün
sayfasındaki tüm görseller kırık ikon olarak geliyor, galeri bomboş görünüyor.

**Ölçülen kanıt:**
- `https://www.cssberlin.de/` yönlendirme yapmıyor, HTTP 200 ile ayrı origin olarak servis ediliyor.
- Her iki hostta da CSP başlığı `img-src 'self' ...` içeriyor.
- `GET /api/products` görsel URL'lerini **mutlak** döndürüyor: `https://cssberlin.de/uploads/products/<id>/0.jpg`
- Dolayısıyla www ziyaretçisi için apex kaynaklı görseller cross-origin olup CSP tarafından bloklanıyor.
- Veri tarafı sağlam: 127 üründen 0'ı görselsiz, tüm URL'ler HTTP 200 ve gerçek içerik döndürüyor. Sorun yalnızca CSP.

**Not:** `af5538b` commit'inde `saveProductImage()` fonksiyonunu mutlaktan göreliye
çevirmişsin — düzeltme doğru ama **deploy edilmediği için canlı kod hâlâ mutlak URL
yazıyor.** Bugün yayınlanan 127 ürünün tamamı apex'e sabitlenmiş durumda.

**Yapılacak:** Bu maddenin kod tarafı hazır (`next.config.ts` içinde CSP'ye iki host
eklendi, www→apex 308 yönlendirmesi eklendi, `scripts/backfill-relative-image-urls.ts`
yazıldı). Senden istenen: bu üçünü gözden geçirip **nginx/Cloudflare katmanında da**
www→apex yönlendirmesinin çakışmadığını doğrulaman. Cloudflare'de zaten bir
yönlendirme kuralı varsa Next tarafındakiyle döngü oluşturmamalı.

**Kabul kriteri:**
```bash
curl -sI https://www.cssberlin.de/ | head -5          # 308, location: https://cssberlin.de/
curl -s https://cssberlin.de/ -D- -o/dev/null | grep -i content-security-policy | tr ';' '\n' | grep img-src
curl -s "https://cssberlin.de/api/products?limit=3" | grep -o '"url":"[^"]*"' | head -3   # GÖRELİ (/uploads/...) olmalı
```

---

## 2. `next build` çöküyordu — `'use client'` eksikti (KRİTİK)

**Kanıt:** `npx next build` çıktısı:
```
Error: Turbopack build failed with 3 errors
You're importing a component that needs `useRouter`  ... mark the file with "use client"
You're importing a component that needs `useEffect`  ...
You're importing a component that needs `useState`   ...
```
`src/components/product/ProductCard.tsx` ve `src/store/useCart.ts` React hook
kullanıyor ama `'use client'` direktifi yoktu.

**Durum:** Düzeltildi, build artık `✓ Compiled successfully` veriyor.

**Senden istenen:** Bundan sonra hook kullanan her dosyaya direktifi ekle ve
`next build` çalıştırmadan iş teslim etme.

**Kabul kriteri:** `npx next build` çıktısında `✓ Compiled successfully`.

---

## 3. `cron/cleanup` route'u sipariş kayıtlarını silecekti (KRİTİK, hukuki risk)

**Kanıt:**
- `import { prisma } from '@/lib/prisma'` → böyle bir modül yok, build kırılıyordu.
- `status: { in: ['SOLD', 'REMOVED'] }` → `ProductStatus` enum'unda `REMOVED` yok.
  Geçerli değerler: `DRAFT, ACTIVE, HIDDEN, RESERVED, SOLD`.
- `prisma.product.delete()` çağırıyordu. `schema.prisma` içinde `Order.productId`
  → `Product` ilişkisi var ve **`onDelete` kuralı tanımlı değil**. Yani satılmış bir
  ürünü silmek ya tüm cron'u hataya düşürecek ya da sipariş kaydını da götürecekti.
  §147 AO gereği fatura karşılığı kayıtlar yıllarca saklanmak zorunda.
- Fotoğrafları diskten silmiyordu (kodun kendi yorumu bunu kabul ediyor), sadece DB
  satırını siliyordu → dosyalar öksüz kalıyor, "yer açma" amacı tersine dönüyordu.

**Durum:** Route yeniden yazıldı — siparişi olan ürün asla silinmiyor
(`retainedForBookkeeping` sayacıyla raporlanıyor), fotoğraflar `fs.rm` ile gerçekten
siliniyor, `?dryRun=1` desteği eklendi, `CRON_SECRET` yoksa 503 dönüyor.

**Senden istenen:** Cron'u kurmadan önce `?dryRun=1` ile çalıştırıp çıktıyı rapora ekle.
Ayrıca `schema.prisma` içindeki `Order.product` ilişkisine bilinçli bir `onDelete`
kuralı ekle (öneri: `onDelete: Restrict`) ve migration üret — şu anki belirsizlik
başlı başına risk.

**Kabul kriteri:**
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://cssberlin.de/api/cron/cleanup?dryRun=1"
npx prisma migrate status
```

---

## 4. Colab worker'ının çağırdığı API hiç yazılmamış (KRİTİK)

**Kanıt:**
```
GET https://cssberlin.de/api/ai/tasks/next            -> HTTP 401
GET https://cssberlin.de/api/ai/tasks/<id>/complete   -> HTTP 401
```
`src/app/api/ai/` altında yalnızca `chat`, `generate-description`, `price-suggestion`,
`suggest-category` var. **`tasks` diye bir route yok.** Worker sonsuza kadar 401 alıyor.

Üstelik worker'daki `except Exception: print("Kuyruk Boş")` bloğu bu 401'i yutup
ekrana "kuyruk boş" yazdırıyor; bu yüzden çalışıyormuş gibi görünüyor.

**Karar:** Bu kuyruk API'sini **yazma**. Görsel işleme Google Drive üzerinden
yürüyecek (aşağıdaki 3. dosyaya bakınız) — sunucuya dışarıdan gelen bağlantı ve
public internete açık API anahtarı gerekmiyor, "Zero-Trust" hedefine bu daha uygun.

Eğer ileride yine de HTTP kuyruğu istenirse önce şunlar netleşmeli: kimlik doğrulama
(`x-api-key` sabit anahtar değil), rate limit, idempotency, ve iş sahiplenme (lease)
mantığı. Şu anki tasarımda bunların hiçbiri yok.

**Kabul kriteri:** Yeni endpoint eklenmeyecek. Onay: `ls src/app/api/ai/` çıktısı.

---

## 5. Rapor doğruluğu — olmayan dosyalar

`CLAUDE_HANDOFF.md` içinde oluşturulduğu bildirilen ama var olmayan dosyalar:
- `scratch/colab_ai_worker.py`
- `scratch/playwright_qa_agent.js`

Ayrıca `src/store/useCart.ts` "Zustand + LocalStorage" diye tarif edilmiş; gerçekte
`useState` + `localStorage` + custom event ile yazılmış. Çalışıyor ama Zustand değil.

**Yapılacak:** `CLAUDE_HANDOFF.md` dosyasını gerçeğe uygun hale getir. Yazılmamış
şeyleri "yapıldı" diye listeleme. Playwright QA ajanı gerçekten isteniyorsa ayrı bir
görev olarak ele alalım.

**Kabul kriteri:** `ls -la scratch/ 2>&1` ve güncellenmiş `CLAUDE_HANDOFF.md` diff'i.

---

## 6. `useCart` içindeki yan etki ve sekmeler arası senkron (DÜŞÜK öncelik)

- `toggleCart` içinde `localStorage.setItem` ve `window.dispatchEvent` çağrıları
  `setCartItems` updater fonksiyonunun **içinde**. Updater saf olmalı; React
  StrictMode'da iki kez çalışıp olayı iki kez tetikleyebilir. Bunları `useEffect`'e
  taşı.
- Koddaki yorum "other tabs" diyor ama custom event sekmeler arası çalışmaz. Gerçek
  sekmeler arası senkron için `window.addEventListener('storage', ...)` gerekir.
- Sepet tamamen boşaltıldığında `localStorage`'dan anahtar silinirse `stored` null
  olup state sıfırlanmıyor.

**Kabul kriteri:** `npx tsc --noEmit` temiz + sepete iki farklı sekmeden ekleme testi.

---

## 7. Eco rozeti "-0.0kg" gösteriyor (DÜŞÜK öncelik)

Katalog kartlarındaki CO2 rozeti her üründe `-0.0kg` yazıyor. Ya gerçek bir değer
hesaplanmalı ya da değer yoksa rozet hiç gösterilmemeli. Şu hali güven kırıyor.

**Kabul kriteri:** Ekran görüntüsü.

---

## RAPOR FORMATI

Her madde için:

```
### Madde N — <başlık>
Durum: TAMAM / YAPILMADI / KISMEN
Değişen dosyalar: <yollar>
Kabul kriteri çıktısı:
<komutun gerçek çıktısı — kopyala yapıştır>
```

Sonunda mutlaka:
```bash
git status --short
npx tsc --noEmit && echo "TSC OK"
npx next build 2>&1 | tail -5
```

**Deploy etme.** Commit at, raporu ver, onayı bekle.
