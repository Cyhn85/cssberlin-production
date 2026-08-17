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

## Gizli bilgiler NEREDE (asla commit'e girmez)
- `.env.production` yalnız Hetzner'de. Yerelde `.env*` gitignore'da. SSH: root@195.201.146.224.
