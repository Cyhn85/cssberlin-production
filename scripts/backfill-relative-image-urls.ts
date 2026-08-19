/**
 * One-off backfill: rewrite absolute product image URLs to relative paths.
 *
 * Images saved before commit af5538b were stored as
 * `https://cssberlin.de/uploads/...`. That pins them to a single hostname, so a
 * visitor on www.cssberlin.de had every image blocked by the CSP `img-src 'self'`
 * rule and saw an empty gallery. saveProductImage() now returns `/uploads/...`;
 * this brings the existing rows in line.
 *
 * Safe to re-run - rows that are already relative are left untouched.
 *
 *   docker compose exec app npx tsx scripts/backfill-relative-image-urls.ts
 *   docker compose exec app npx tsx scripts/backfill-relative-image-urls.ts --apply
 */
import prisma from '../src/lib/db';

const PREFIXES = ['https://cssberlin.de', 'https://www.cssberlin.de', 'http://cssberlin.de'];

async function main() {
  const apply = process.argv.includes('--apply');

  const images = await prisma.productImage.findMany({ select: { id: true, url: true } });
  const stale = images.filter((img) => PREFIXES.some((p) => img.url.startsWith(p)));

  console.log(`${images.length} image rows, ${stale.length} with an absolute URL.`);

  if (stale.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  for (const img of stale.slice(0, 5)) {
    const prefix = PREFIXES.find((p) => img.url.startsWith(p))!;
    console.log(`  ${img.url}  ->  ${img.url.slice(prefix.length)}`);
  }
  if (stale.length > 5) console.log(`  ... and ${stale.length - 5} more`);

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to write these changes.');
    return;
  }

  let updated = 0;
  for (const img of stale) {
    const prefix = PREFIXES.find((p) => img.url.startsWith(p))!;
    const relative = img.url.slice(prefix.length);
    if (!relative.startsWith('/')) continue; // never write a malformed path
    await prisma.productImage.update({ where: { id: img.id }, data: { url: relative } });
    updated++;
  }

  console.log(`\nUpdated ${updated} rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
