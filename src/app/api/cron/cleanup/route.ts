import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Assuming this exists, fallback to standard Next.js prisma import

// Güvenlik için sadece doğrulanmış Cron Job (Örn: Vercel Cron veya Hetzner Cron) bu adrese istek atabilir.
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const DAYS_TO_KEEP = 7;
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - DAYS_TO_KEEP);

    // 1. Satılmış veya kaldırılmış ürünleri bul (7 günden eski)
    const obsoleteProducts = await prisma.product.findMany({
      where: {
        status: { in: ['SOLD', 'REMOVED'] },
        updatedAt: { lt: thresholdDate }
      },
      include: { images: true }
    });

    if (obsoleteProducts.length === 0) {
      return NextResponse.json({ message: 'No obsolete products to clean up.' });
    }

    let deletedImagesCount = 0;

    // 2. Fotoğraf Kayıtlarını (veya bağlantılarını) sil
    for (const product of obsoleteProducts) {
      for (const image of product.images) {
        // Fiziksel silme (Node.js fs veya UploadThing API) işlemi buraya entegre edilir.
        // Bu örnekte sadece veritabanı kaydı temizlenmektedir.
        await prisma.productImage.delete({ where: { id: image.id } });
        deletedImagesCount++;
      }
      
      // Ürünü sil veya 'DELETED' durumuna çek
      await prisma.product.delete({ where: { id: product.id } });
    }

    return NextResponse.json({ 
      message: 'Cleanup successful', 
      productsDeleted: obsoleteProducts.length,
      imagesDeleted: deletedImagesCount
    });

  } catch (error) {
    console.error('CRON Cleanup Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
