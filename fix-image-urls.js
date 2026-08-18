const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixImageUrls() {
  console.log('Fixing absolute URLs in ProductImage table...');
  const images = await prisma.productImage.findMany();
  
  let updatedCount = 0;
  for (const img of images) {
    if (img.url.startsWith('http://') || img.url.startsWith('https://')) {
      try {
        const urlObj = new URL(img.url);
        const relativeUrl = urlObj.pathname;
        
        await prisma.productImage.update({
          where: { id: img.id },
          data: { url: relativeUrl }
        });
        updatedCount++;
      } catch (e) {
        console.error('Failed to parse URL:', img.url, e);
      }
    }
  }
  
  console.log(`Updated ${updatedCount} image URLs to relative paths.`);
}

fixImageUrls()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
