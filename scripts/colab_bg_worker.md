# Colab GPU arka plan temizleyici — çalışan kurulum

Mimari değişikliği: **Drive kuyruk görevi görüyor.** HTTP kuyruğu yok, çünkü
`/api/ai/tasks/next` diye bir endpoint hiç yazılmamış (canlıda 401 dönüyor) ve
public internete açık sabit API anahtarı istemiyoruz.

```
MyDrive/cssberlin_ai/inbox/<urun_id>/0.jpg     <- TATANGA ham görseli koyar
MyDrive/cssberlin_ai/outbox/<urun_id>/0.png    <- Colab temizlenmişi yazar
MyDrive/cssberlin_ai/outbox/<urun_id>/_DONE    <- bitti işareti
```

Colab oturumu kapansa bile Drive'da kalan iş kaybolmaz; yeniden başlatınca
kaldığı yerden devam eder.

---

## Neden önceki kurulum döngüye giriyordu

1. `pip install "rembg[cpu]"` çalıştırıldığında log'da **`onnxruntime` hiç
   yüklenmemiş**. rembg'nin çalışma motoru o; bu yüzden `from rembg import remove`
   satırı `ModuleNotFoundError: No module named 'onnxruntime'` veriyordu.
2. "Oturumu yeniden başlat" uyarısının sebebi: Colab açılışta `numpy` ve `PIL`
   paketlerini zaten belleğe alıyor. rembg 2.0.81 `numpy>=2.3`, `pillow>=12.1`,
   `scikit-image>=0.26` istediği için bunları yükseltiyor ve çekirdek tutarsız
   kalıyor. **pip'i `subprocess` ile çağırmak bunu değiştirmez** — uyarı pip'in
   nasıl çağrıldığıyla değil, paketin bellekte yüklü olmasıyla ilgili.
3. Bu yükseltmeler Colab'ın kurulu `cudf/cuml/cucim` paketlerini de kırıyor
   (onlar `numba<0.62` ve `scikit-image<0.26` istiyor). Çözülemez bir çakışma.

**Çözüm:** `--no-deps` ile kurup Colab'ın `numpy`/`pillow`/`scikit-image`
sürümlerine hiç dokunmuyoruz. Eksik olan tek şey `onnxruntime` ve `pymatting`;
onları ayrıca kuruyoruz. Böylece yeniden başlatma uyarısı hiç çıkmıyor.

---

## Hücre 1 — kurulum ve doğrulama

Yeni bir not defteri aç. **Çalışma zamanı türü: T4 GPU.** Tek hücre:

```python
# Colab'in numpy/pillow/scikit-image surumlerine DOKUNMUYORUZ -> yeniden baslatma uyarisi cikmaz
!pip install -q --no-deps rembg pymatting
!pip install -q onnxruntime-gpu

import onnxruntime as ort
print("onnxruntime:", ort.__version__)
print("kullanilabilir saglayicilar:", ort.get_available_providers())

from rembg import new_session, remove
from PIL import Image
import numpy, sys
print("numpy:", numpy.__version__, "| pillow:", Image.__version__)

# GPU gercekten var mi
!nvidia-smi --query-gpu=name,memory.total --format=csv,noheader || echo "GPU YOK - Calisma zamani turunu T4 GPU yap"
print("\nKURULUM TAMAM")
```

Beklenen: `CUDAExecutionProvider` listede görünmeli ve yeniden başlatma uyarısı
**çıkmamalı**. `CUDAExecutionProvider` yoksa panik yok — Hücre 2 otomatik olarak
CPU'ya düşer ve bunu ekrana yazar.

---

## Hücre 2 — işleyici

```python
import os, time, glob
from pathlib import Path
from google.colab import drive
import onnxruntime as ort
from rembg import new_session, remove
from PIL import Image

drive.mount('/content/drive')

ROOT   = Path('/content/drive/MyDrive/cssberlin_ai')
INBOX  = ROOT / 'inbox'
OUTBOX = ROOT / 'outbox'
INBOX.mkdir(parents=True, exist_ok=True)
OUTBOX.mkdir(parents=True, exist_ok=True)

# GPU varsa GPU, yoksa CPU - sessizce coken degil, ne kullandigini SOYLEYEN kurulum
avail = ort.get_available_providers()
providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if 'CUDAExecutionProvider' in avail else ['CPUExecutionProvider']
print("Saglayici:", providers[0])

# isnet-general-use urun fotografinda u2net'ten belirgin daha temiz kenar veriyor
session = new_session('isnet-general-use', providers=providers)
print("Model hazir.\n")

def process_product(pdir: Path) -> int:
    out_dir = OUTBOX / pdir.name
    if (out_dir / '_DONE').exists():
        return 0                                  # zaten islenmis, atla (yeniden calistirmaya guvenli)
    out_dir.mkdir(parents=True, exist_ok=True)

    done = 0
    for src in sorted(pdir.iterdir()):
        if src.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
            continue
        dst = out_dir / f'{src.stem}.png'
        if dst.exists():
            done += 1
            continue
        try:
            img = Image.open(src).convert('RGB')
            cut = remove(img, session=session)     # RGBA, arka plan seffaf
            cut.save(dst, format='PNG')            # seffafligi korumak icin PNG
            done += 1
        except Exception as e:
            print(f"  HATA {src.name}: {type(e).__name__}: {e}")

    if done:
        (out_dir / '_DONE').write_text(str(done))
    return done

print(f"{INBOX} dinleniyor. Durdurmak icin hucreyi durdur.\n")
while True:
    dirs = [d for d in INBOX.iterdir() if d.is_dir()]
    pending = [d for d in dirs if not (OUTBOX / d.name / '_DONE').exists()]
    if not pending:
        print(f"\rBeklemede... ({len(dirs)} urun islenmis)", end='')
        time.sleep(10)
        continue
    for pdir in pending:
        t0 = time.time()
        n = process_product(pdir)
        if n:
            print(f"{pdir.name}: {n} gorsel, {time.time()-t0:.1f}s")
```

---

## Hızlı test (TATANGA'yı beklemeden)

Drive'da `MyDrive/cssberlin_ai/inbox/test1/` klasörü aç, içine 2-3 ürün fotoğrafı at.
Hücre 2 çalışırken saniyeler içinde `outbox/test1/` altında şeffaf PNG'ler oluşmalı.

---

## Bu çalışırsa sıradaki adım

TATANGA tarafına iki küçük iş kalıyor (bende, sen onay verince yaparım):

1. `recommendation='buy'` ve `bg_removed=0` olan ürünlerin ham görsellerini
   `inbox/<urun_id>/` altına yazan bir senkron.
2. `outbox/<urun_id>/_DONE` gören ürünleri çekip `processed_images_json` alanına
   yazan ve mevcut auto-publish akışını tetikleyen bir toplayıcı.

Drive'a erişim için Colab'daki hesabın aynısıyla `rclone` ya da Google Drive API
servis hesabı kullanılır — TATANGA'nın Drive'a yazması gerekiyor.

**Not:** Şu anki yerel BG hattı zaten çalışıyor (136/422 bitti, 125 ürün yayında).
Colab bunu hızlandırmak için; acil bir bağımlılık değil. Önce yukarıdaki hızlı testi
geçirelim, sonra entegrasyona geçelim.

---

## Güvenlik

Bu kurguda **API anahtarı hiç kullanılmıyor** — Drive kimlik doğrulaması Colab'ın
kendi Google oturumu üzerinden yürüyor.

`PamirNil2002?` anahtarını sohbete yapıştırdın ve eski Colab koduna gömülüydü.
İfşa olmuş sayılır: sunucudaki `.env` içindeki `COLAB_SECRET_KEY` değerini değiştir,
şifre kalıbını başka yerde kullanıyorsan oraları da. Anahtar bir daha koda gömülmesin.
