/**
 * YERLESIM DENETIMI — tarayicida calisan, tekrarlanabilir olcum.
 *
 * NEDEN BU VAR: "Site amator gorunuyor" hissinin arkasinda genelde tek bir
 * buyuk tasarim hatasi degil, kucuk olcum hatalari yigini vardir: 13px
 * ortusme, 1px kayma, kirpilan baslik, yatay tasma. Bunlar goze "bir tuhaflik"
 * olarak carpar ama nereye bakacagini bilmezsen bulunamaz.
 *
 * Hazir bir arayuz kutuphanesi bunlari COZEMEZ — cunku hata kutuphanede degil,
 * senin sayfandaki gercek olculerde. Cozen sey OLCUM'dur ve olcum
 * tekrarlanabilir olmali: her degisiklikten sonra ayni kontroller kosmali.
 *
 * KULLANIM (tarayici konsolunda, herhangi bir sayfada):
 *   1. Bu dosyanin icerigini kopyala, konsola yapistir
 *   2. layoutAudit()  -> mevcut genislikte rapor
 *
 * Ya da Claude/Playwright ile otomatik: her breakpoint'te calistirilir.
 */
(function () {
  'use strict';

  // Denetim esikleri — hangi sapma "hata" sayilir.
  const ESIK = {
    ortusme_px: 0,        // sabit header ile icerik hic ortusmemeli
    min_nefes_px: 8,      // sabit header ile ilk baslik arasi en az bosluk
    min_dokunma_px: 44,   // WCAG: dokunulabilir hedef en az 44x44
    kirpma_toleransi: 2,  // scrollHeight - clientHeight bu kadari asarsa kirpilmis
  };

  function gorunur(el) {
    if (!el || !el.offsetParent) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function kesisiyor(a, b) {
    return !(a.bottom <= b.top || a.top >= b.bottom ||
             a.right <= b.left || a.left >= b.right);
  }

  window.layoutAudit = function layoutAudit() {
    const bulgular = [];
    const ekle = (tur, ciddiyet, mesaj, olcum) =>
      bulgular.push({ tur, ciddiyet, mesaj, olcum });

    // --- 1. SABIT/YAPISKAN header ile icerik ortusmesi ---
    // Bugunku gercek hata tam olarak buydu: header 133px, main padding 120px.
    const sabitler = [...document.querySelectorAll('header, [class*="fixed"], [class*="sticky"]')]
      .filter((el) => {
        const p = getComputedStyle(el).position;
        return (p === 'fixed' || p === 'sticky') && gorunur(el);
      });
    const main = document.querySelector('main');
    if (main && sabitler.length) {
      const mR = main.getBoundingClientRect();
      for (const s of sabitler) {
        const sR = s.getBoundingClientRect();
        if (sR.top > 200) continue;              // ust seride yapisik olanlar
        // main'in ilk gorunur basligi
        const baslik = [...main.querySelectorAll('h1,h2,h3')]
          .find((h) => gorunur(h) && h.getBoundingClientRect().top > 0);
        if (!baslik) continue;
        const bR = baslik.getBoundingClientRect();
        const bosluk = bR.top - sR.bottom;
        if (bosluk < ESIK.ortusme_px) {
          ekle('ortusme', 'KRITIK',
            `Sabit "${s.tagName.toLowerCase()}" icerigin uzerine biniyor. ` +
            `Genelde main'e ELLE yazilmis padding-top, header'in GERCEK ` +
            `yuksekliginden kucuk oldugu icin olur.`,
            { header_yuk: +sR.height.toFixed(1), bosluk_px: +bosluk.toFixed(1) });
        } else if (bosluk < ESIK.min_nefes_px) {
          ekle('sikisik', 'ORTA',
            `Baslik sabit cubuga neredeyse yapisik (${bosluk.toFixed(1)}px). ` +
            `Matematiksel olarak ortusme yok ama gorsel olarak sikisik durur.`,
            { bosluk_px: +bosluk.toFixed(1) });
        }
      }
    }

    // --- 2. Yatay tasma ---
    const kok = document.documentElement;
    if (kok.scrollWidth > window.innerWidth + 1) {
      // Hangi eleman tasiriyor
      const suclular = [...document.querySelectorAll('body *')]
        .filter(gorunur)
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 3)
        .map((el) => el.tagName.toLowerCase() + '.' +
             (el.className || '').toString().split(' ').slice(0, 2).join('.'));
      ekle('yatay_tasma', 'KRITIK',
        'Sayfa yatay kayiyor. Mobilde en cok sikayet edilen hatadir.',
        { sayfa_genislik: kok.scrollWidth, ekran: window.innerWidth, suclular });
    }

    // --- 3. Kirpilmis metin (sabit yukseklikli kutuda tasan icerik) ---
    // ProductCard'daki h-[122px] gibi sabit yukseklikler bunun kaynagidir.
    const kirpilan = [];
    for (const el of document.querySelectorAll('div,p,h1,h2,h3,span,a')) {
      if (!gorunur(el) || el.children.length > 3) continue;
      const st = getComputedStyle(el);
      if (st.overflow === 'visible' && st.overflowY === 'visible') continue;
      if (st.webkitLineClamp && st.webkitLineClamp !== 'none') continue;  // kasitli
      if (el.scrollHeight - el.clientHeight > ESIK.kirpma_toleransi &&
          el.clientHeight > 0 && (el.innerText || '').trim().length > 0) {
        kirpilan.push({
          etiket: el.tagName.toLowerCase(),
          metin: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 40),
          gorunen: el.clientHeight, gercek: el.scrollHeight,
        });
      }
      if (kirpilan.length >= 6) break;
    }
    if (kirpilan.length) {
      ekle('kirpilan_metin', 'ORTA',
        'Sabit yukseklikli kutularda metin kesiliyor. Uzun baslik veya buyuk ' +
        'yazi tipinde son satir kayboluyor.', { ornekler: kirpilan });
    }

    // --- 4. Cok kucuk dokunma hedefleri (mobil) ---
    if (window.innerWidth < 768) {
      const kucuk = [...document.querySelectorAll('a,button,[role="button"]')]
        .filter(gorunur)
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.height < ESIK.min_dokunma_px || r.width < 24)
        .slice(0, 6)
        .map(({ el, r }) => ({
          etiket: (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 24),
          boyut: `${Math.round(r.width)}x${Math.round(r.height)}`,
        }));
      if (kucuk.length) {
        ekle('kucuk_hedef', 'DUSUK',
          `Dokunma hedefi ${ESIK.min_dokunma_px}px altinda (WCAG). ` +
          'Parmakla isabet ettirmek zor, kullanici yanlis tiklar.',
          { ornekler: kucuk });
      }
    }

    // --- 5. Ust uste binen etkilesimli ogeler ---
    // Bir buton digerinin uzerine biniyorsa tiklama yanlis yere gider.
    const etkilesimli = [...document.querySelectorAll('a,button')].filter(gorunur).slice(0, 120);
    const cakismalar = [];
    for (let i = 0; i < etkilesimli.length && cakismalar.length < 3; i++) {
      for (let j = i + 1; j < etkilesimli.length; j++) {
        const a = etkilesimli[i], b = etkilesimli[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        if (kesisiyor(ar, br)) {
          cakismalar.push({
            a: (a.innerText || a.getAttribute('aria-label') || 'a').trim().slice(0, 20),
            b: (b.innerText || b.getAttribute('aria-label') || 'b').trim().slice(0, 20),
          });
          break;
        }
      }
    }
    if (cakismalar.length) {
      ekle('tiklama_cakismasi', 'ORTA',
        'Iki tiklanabilir oge ust uste biniyor; tiklama yanlis hedefe gidebilir.',
        { ornekler: cakismalar });
    }

    const siralama = { KRITIK: 0, ORTA: 1, DUSUK: 2 };
    bulgular.sort((x, y) => siralama[x.ciddiyet] - siralama[y.ciddiyet]);

    return {
      sayfa: location.pathname,
      ekran: `${window.innerWidth}x${window.innerHeight}`,
      SONUC: bulgular.length === 0 ? 'TEMIZ' : `${bulgular.length} bulgu`,
      kritik: bulgular.filter((b) => b.ciddiyet === 'KRITIK').length,
      bulgular,
    };
  };

  if (typeof module !== 'undefined') module.exports = { };
})();
