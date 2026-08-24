# Yedek ve felaket kurtarma

Bu dosya iki soruya cevap verir: yedek nasıl alınıyor, ve sunucu tamamen
kaybedilirse site nasıl geri getirilir.

## Neden yeniden yazıldı

23 Ağustos 2026'da ölçüldü: `/opt/cssberlin-v2/backups/` içindeki tek yedek
dosyası **0 bayttı** (`cssberlin_2026-08-12_09-14-47.dump`, 12 Ağustos'tan).
Sebep: `ops/backup-postgres.sh` varsayılan olarak `docker-compose.cloudflare.yml`
kullanıyordu, ama canlı stack `docker-compose.yml` (çalışan konteynerin
`com.docker.compose.project.config_files` etiketiyle doğrulandı). Yanlış stack'e
`exec` edildiği için `pg_dump` hiçbir şey yazmadı, yönlendirme boş dosya
oluşturdu ve **hiçbir kontrol olmadığı için 11 gün boyunca yedek var sanıldı.**

`ops/backup-offsite.sh` bu yüzden dump'ı hem boyutuna hem içeriğine göre
doğruluyor ve 1 KB'tan küçükse ya da `Product` tablosunu listelemiyorsa dosyayı
silip hata veriyor.

## Kapsam

| Ne | Nerede | Boyut |
|---|---|---|
| Postgres | Docker volume | 22 MB (sıkıştırılmış dump ~2-5 MB) |
| Ürün fotoğrafları | `/opt/cssberlin-v2/uploads` | 107 MB |

**Önemli:** Görseller Uploadthing'de değil, sunucunun kendi diskinde.
`https://cssberlin.de/uploads/products/<id>/0-thumb.webp` doğrudan bu klasörden
servis ediliyor. Sadece veritabanını yedeklemek siparişleri kurtarır ama bütün
ürün fotoğraflarını kaybettirir.

## Günlük yedek

```
15 4 * * * /opt/cssberlin-v2/ops/backup-offsite.sh >> /var/log/cssberlin-backup.log 2>&1
```

Saat 04:15 seçildi: bu sunucu paylaşımlı ve `/opt/fbref-predictions` cron'ları
03:00'te yoğun çalışıyor.

Saklama: yerelde 3 gün (disk sebebiyle), uzakta 30 gün.

## Şu anki durum: LOCAL ONLY

rclone sunucuda **kurulu değil**, dolayısıyla yedek şu an sadece yerel diskte.
Script bunu log'a açıkça yazar:

```
LOCAL ONLY - off-site backup NOT taken (rclone is not installed)
```

**Bu felaket kurtarma değildir.** Sunucu ölürse yedek de onunla ölür. Aşağıdaki
kurulum tamamlanana kadar durum budur.

## Google Drive'ı devreye alma

Script hazır; sadece rclone remote'u tanımlanacak. Kodda değişiklik gerekmez.

**1. Sunucuya rclone kur**

```bash
curl https://rclone.org/install.sh | sudo bash
```

**2. Yetkilendirme — bu adımı hesap sahibi yapar**

Sunucuda tarayıcı yok. rclone'un headless akışı: yetkilendirmeyi tarayıcısı olan
bir makinede yapıp çıkan token'ı sunucuya taşıyorsun.

Kendi bilgisayarında (rclone kurulu olmalı):

```bash
rclone authorize "drive"
```

Tarayıcı açılır, Google hesabınla izin verirsin, terminale uzun bir JSON token
basılır.

Sonra sunucuda:

```bash
rclone config
```

- `n` (new remote) → isim: **`gdrive`** (script bu ismi bekliyor)
- storage: `drive`
- client_id / client_secret: boş bırak
- scope: `1` (full access) veya `3` (yalnızca rclone'un oluşturduğu dosyalar)
- `Use auto config?` → **`n`** ← kritik, sunucuda tarayıcı yok
- Üstteki token'ı yapıştır

Google hesabı yetkilendirmesi ve token senin elinde kalır; bu adım
otomatikleştirilmez.

**3. Doğrula**

```bash
rclone listremotes                          # gdrive: görünmeli
/opt/cssberlin-v2/ops/backup-offsite.sh     # artık "off-site backup complete" yazmalı
rclone ls gdrive:cssberlin-backups/db/
```

## Geri yükleme (felaket kurtarma)

**1. Yedeği indir**

```bash
rclone copy gdrive:cssberlin-backups/db/cssberlin_<tarih>.dump /tmp/
rclone sync gdrive:cssberlin-backups/uploads/ /opt/cssberlin-v2/uploads/
```

**2. Veritabanını geri yükle**

```bash
/opt/cssberlin-v2/ops/restore-postgres.sh /tmp/cssberlin_<tarih>.dump --force
```

`--force` zorunlu: script hedef veritabanının `public` şemasını **düşürüp**
yeniden oluşturur. Yanlışlıkla çalıştırılmaya karşı bilinçli bir engel.

**3. Uygulamayı ayağa kaldır**

```bash
cd /opt/cssberlin-v2
docker compose --env-file .env.production up -d --build app
```

## Restore tatbikatı (yedeğin işe yaradığının tek kanıtı)

Alınan bir yedek, geri yüklendiği kanıtlanana kadar yedek sayılmaz. Ayda bir,
**canlı veritabanına dokunmadan**:

```bash
cd /opt/cssberlin-v2
U=$(grep -E '^POSTGRES_USER=' .env.production | cut -d= -f2)

# Ayrı bir test veritabanı
docker compose --env-file .env.production exec -T postgres \
  psql -U "$U" -d postgres -c 'DROP DATABASE IF EXISTS cssberlin_restore_test;'
docker compose --env-file .env.production exec -T postgres \
  psql -U "$U" -d postgres -c 'CREATE DATABASE cssberlin_restore_test;'

# Son dump'ı oraya yükle
LATEST=$(ls -t backups/*.dump | head -1)
docker compose --env-file .env.production exec -T postgres \
  pg_restore --no-owner --no-privileges -U "$U" -d cssberlin_restore_test < "$LATEST"

# Sayılar tutuyor mu
docker compose --env-file .env.production exec -T postgres \
  psql -U "$U" -d cssberlin_restore_test -c 'SELECT count(*) FROM "Product";'
docker compose --env-file .env.production exec -T postgres \
  psql -U "$U" -d cssberlin -c 'SELECT count(*) FROM "Product";'

# Temizle
docker compose --env-file .env.production exec -T postgres \
  psql -U "$U" -d postgres -c 'DROP DATABASE cssberlin_restore_test;'
```

İki sayı tutuyorsa yedek gerçekten geri yüklenebilir demektir.

## Disk

Sunucu paylaşımlı: cssberlin + Buchhalter + `/opt/fbref-predictions`. 38 GB kök
disk 23 Ağustos'ta %100 doldu ve bir deploy'u ENOSPC ile düşürdü.

- `ops/post-deploy-cleanup.sh` her deploy sonunda build cache ve sahipsiz
  imajları temizler, gerekirse journald'ı budar.
- `docker system prune -af` **kullanılmaz**: bu makinede başka projeler var ve
  `-a` bir önceki cssberlin imajını (rollback yolumuz) da siler.
- Volume prune **kullanılmaz**: Postgres verisi volume'da.
