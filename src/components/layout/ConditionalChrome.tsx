'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

// Internal tool - own layout (admin/layout.tsx), the marketing header/footer
// would look broken floating around a dashboard.
const NO_CHROME_PREFIXES = ['/admin'];

// Focused single-task flows - a Footer full of marketing/legal links is pure
// distraction here, same reasoning most checkout/auth flows use. Header stays
// so the user can still navigate away.
const NO_FOOTER_PREFIXES = ['/checkout', '/login', '/register', '/upload'];

// Header `position: fixed`. Icerigin ustten ne kadar itilecegi eskiden SABIT
// 7.5rem (120px) yazilmisti — ama header'in gercek yuksekligi 133px'ti, cunku
// ustte kayan duyuru seridi, altta kategori seridi var. Sonuc: sayfa basligi
// header'in ALTINA giriyordu (canli olculdu: 13px ortusme).
//
// Sabit sayi bu isi cozemez: serit satir sarabilir, duyuru kapatilabilir,
// kullanici yazi tipini buyutebilir. Bu yuzden yukseklik CALISMA ANINDA
// olculur ve degistikce guncellenir. Sunucu tarafinda olcum yapilamadigi icin
// ilk kare 7.5rem ile cizilir, ardindan gercek deger devralir.
const FALLBACK_OFFSET = '7.5rem';

// Header ile ilk baslik arasindaki nefes payi. Offset'i tam header
// yuksekligine esitlemek matematiksel olarak dogru ama GORSEL olarak yanlis:
// baslik cubuga yapisik durur, sayfa sikisik ve amator gorunur.
const BREATHING_ROOM_PX = 20;

export default function ConditionalChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const hideChrome = NO_CHROME_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const hideFooter = hideChrome || NO_FOOTER_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  const [offset, setOffset] = useState<string>(FALLBACK_OFFSET);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (hideChrome) return;
    const header = wrapperRef.current?.querySelector('header');
    if (!header) return;

    const olc = () => {
      // Math.ceil: alt-piksel yukseklikte (orn. 130.4px) asagi yuvarlamak
      // 1px'lik ortusme birakir. Yukari yuvarlamak guvenli taraftir.
      const h = Math.ceil(header.getBoundingClientRect().height);
      if (h > 0) setOffset(`${h + BREATHING_ROOM_PX}px`);
    };
    olc();

    // ResizeObserver: ekran donusu, yazi tipi degisimi, seridin satir sarmasi
    // veya duyuru seridinin kapanmasi — hepsinde offset kendini duzeltir.
    const ro = new ResizeObserver(olc);
    ro.observe(header);
    window.addEventListener('resize', olc);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', olc);
    };
  }, [hideChrome, pathname]);

  if (hideChrome) {
    return <main style={{ minHeight: '100vh' }}>{children}</main>;
  }

  return (
    <div ref={wrapperRef}>
      <Header />
      <main style={{ paddingTop: offset, minHeight: '100vh' }}>{children}</main>
      {hideFooter ? null : <Footer />}
    </div>
  );
}
