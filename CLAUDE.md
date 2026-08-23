# cssberlin.de — ajan kuralları (her oturum otomatik yüklenir, KÜÇÜK tut)

> Tam bağlam/tarih gerekirse: `docs/PROJECT-CONTEXT.md` (bir kez oku).
> Anlık durum + sıradaki adım: `HANDOFF.md` (her devirde güncellenir).

## Günlük kurallar
- **Aynı repoyu Antigravity ile paylaşıyoruz.** Sıra sende değilken düzenleme yapma.
  Başlarken: `HANDOFF.md` + `git log --oneline -5`. Bitince: commit + HANDOFF güncelle.
- **Deploy dosya-senkronu ile** (git ile değil). Kanıtlanmış komut:
  `tar -czf /tmp/s.tgz --exclude=node_modules --exclude=.next src && scp ... && ssh root@195.201.146.224 "cd /opt/cssberlin-v2 && cp -r src /tmp/y_$(date +%s) && tar -xzf /tmp/s.tgz && docker compose --env-file .env.production up -d --build app"`
- **TEK deploy**: tüm işler bitince, tek seferde. Ara deploy yok.
- **Renk kuralı**: turuncu→yeşil ("Climate Smart"). Yeni renk icat etme; `var(--color-*)` kullan.
- **Doğrulama ekran görüntüsüyle değil ölçümle**: `getBoundingClientRect`/`getComputedStyle`.
  Yerleşim şüphesinde `ops/layout-audit.js` çalıştır.
- **Gerçek veri**: test/sahte ürün yok. Sabit-kod sihirli sayı yok (offset'i ölç).

## Yayın kapsamı (giyim+ayakkabı+aksesuar)
- `src/config/launch-scope.ts` tek kaynak. 7 kök açık, 5 kapalı. Silme yok, gizle.

## Süreç hijyeni — HER görevde geçerli, hatırlatma beklenmez
- **Hiç bitmeyen komutu asılı bırakma.** `npm run dev`, `npx unlighthouse`,
  `Get-Content -Wait`, `tail -f` kendiliğinden bitmez. Kullandıysan işin bitince
  **sonlandır**. Görev listesinde asılı süreç = yarım kalmış iş.
- Log okumak için `-Wait` kullanma; tek seferlik `-Tail 50` yeterli.
- "Tamamladım" derken arkada çalışan süreç kalmamalı.

## Ölçüm ve rapor disiplini — HER denetimde geçerli
- **Selector doğrulanmadan ölçüm yok.** `docs/audit/selectors.json` sicilinde
  `dogrulandi: true` olmayan selector kullanılmaz.
- **`0` ve `N/A` yasak.** Ölçüm alınamadıysa `OLCULEMEDI: <sebep>` yaz; sebep
  spesifik olsun ("article 15sn icinde DOM'a gelmedi — istemci render").
- **`OLCULEMEDI` hesaba girmez** (medyan/ortalama/öneri). Geçerli veri 2'den
  azsa `YETERSIZ VERI` yaz, öneri üretme.
- **İddia ettiğin her `src/...` yolu diskte olmalı** — yazmadan önce kontrol et.
- **Test edemediğine TAMAM yazma.** `DOĞRULANMADI, şu sebeple` kabul edilir;
  yanlış TAMAM edilmez.
- **İstemci-render sayfalarda** (katalog, ürün listesi) ölçümden önce
  `waitForSelector` + `img.decode()` bekle — ilk HTML'de `<article>` yok.
- **Prompt'ta istenip raporda geçmeyen metrik** `KAPSANMADI: <metrik>` olarak
  listelenir. Sessizce atlama.

## Gizli bilgiler NEREDE (asla commit'e girmez)
- `.env.production` yalnız Hetzner'de. Yerelde `.env*` gitignore'da. SSH: root@195.201.146.224.
