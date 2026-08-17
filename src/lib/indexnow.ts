// IndexNow: Bing + Yandex'e "bu URL degisti, tekrar tara" anlik bildirimi.
// Ucretsiz, hesap gerektirmez — sadece public/{KEY}.txt dosyasi eslesmeli.
// Yeni/guncellenen urunler dakikalar icinde indekslenir.

const INDEXNOW_KEY = '7f3c9a2e5b8d4016c1e2f3a4b5c6d7e8';
const HOST = 'cssberlin.de';

export async function pingIndexNow(urls: string[]): Promise<void> {
  const list = urls.filter(Boolean).slice(0, 10000);
  if (list.length === 0) return;
  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
        urlList: list,
      }),
    });
  } catch {
    // Sessiz: indeksleme ping'i asla ana akisi (urun yayini) kirmasin.
  }
}
