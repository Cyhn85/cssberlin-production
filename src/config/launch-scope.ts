/**
 * Yayin kapsami — hangi kategoriler SITEDE GORUNUR.
 *
 * NEDEN SILMIYORUZ: Category tablosu Product'a FK ile bagli
 * (ON DELETE RESTRICT). Kategori silmek hem urunleri kirar hem geri donusu
 * imkansizlastirir. Bunun yerine GORUNURLUK kapatilir: veri yerinde durur,
 * 6 ay sonra kategori adini bu listeye ekleyip geri acmak yeterlidir.
 *
 * Karar (2026-08-17): hizli yayina girmek icin kapsam giyim + ayakkabi +
 * aksesuar. Elektronik/kitap/ev/koleksiyon simdilik kapali.
 */

/** Yayinda gorunen KOK kategoriler (Category.name ile birebir eslesir). */
export const LAUNCH_ROOT_CATEGORIES = [
    'Damen',
    'Herren',
    'Kinder',
    'Schuhe',
    'Taschen & Accessoires',
    'Sport',
    'Vintage',
] as const;

/**
 * Mobil/dar ekran kategori seridinde kullanilan kisa etiketler.
 * Tam adlar serit icinde tasar ve okunmaz hale gelir.
 */
export const CATEGORY_SHORT_LABELS: Record<string, string> = {
    'Damen': 'Damen',
    'Herren': 'Herren',
    'Kinder': 'Kinder',
    'Schuhe': 'Schuhe',
    'Taschen & Accessoires': 'Taschen',
    'Sport': 'Sport',
    'Vintage': 'Vintage',
};

const AKTIF = new Set<string>(LAUNCH_ROOT_CATEGORIES);

/** Bu kok kategori yayinda gorunuyor mu. */
export function isLaunchCategory(rootName: string | null | undefined): boolean {
    return Boolean(rootName && AKTIF.has(rootName));
}

/** Serit/menu icin kisa etiket; tanimsizsa adin kendisi. */
export function shortLabel(name: string): string {
    return CATEGORY_SHORT_LABELS[name] ?? name;
}

/**
 * Kategori agacini yayin kapsamina gore filtreler.
 * Alt kategoriler kok kategorinin durumunu miras alir — alt seviyede ayri
 * bir liste tutmak bakim yuku olurdu ve kok kapaliyken altin acik kalmasi
 * zaten anlamsizdir.
 */
export function filterToLaunchScope<
    T extends { name: string; parentId?: string | null; id: string }
>(categories: T[]): T[] {
    const idToName = new Map(categories.map((c) => [c.id, c.name]));
    const kokAdi = (c: T): string => {
        let ad = c.name;
        let ust = c.parentId;
        // Dongu korumasi: bozuk veri sonsuz donguye sokmasin.
        for (let i = 0; ust && i < 10; i++) {
            const ustAd = idToName.get(ust);
            if (!ustAd) break;
            ad = ustAd;
            ust = categories.find((x) => x.id === ust)?.parentId ?? null;
        }
        return ad;
    };
    return categories.filter((c) => isLaunchCategory(kokAdi(c)));
}
