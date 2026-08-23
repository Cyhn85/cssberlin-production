import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

/**
 * Self-hosted product image storage: files are written into a directory that
 * is bind-mounted on the host (see docker-compose.cloudflare.yml `app` service
 * and the host nginx `location /uploads/` block) and served directly by nginx,
 * independent of the Next.js process. No third-party storage account needed.
 */

const UPLOAD_ROOT = process.env.LOCAL_UPLOAD_DIR || '/app/uploads';
const PUBLIC_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://cssberlin.de').replace(/\/$/, '');

const ALLOWED_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function extensionForMimeType(mimeType: string): string | null {
  return ALLOWED_EXTENSIONS[mimeType.toLowerCase()] || null;
}

/**
 * Saves a single image buffer under uploads/products/{productId}/{index}.{ext}
 * and returns the publicly reachable URL nginx will serve it at.
 */
export async function saveProductImage(
  buffer: Buffer,
  productId: string,
  index: number,
  mimeType: string
): Promise<{ url: string; thumbUrl: string; mediumUrl: string }> {
  const ext = extensionForMimeType(mimeType);
  if (!ext) {
    throw new Error(`Nicht unterstützter Bildtyp: ${mimeType}`);
  }

  const dir = path.join(UPLOAD_ROOT, 'products', productId);
  await mkdir(dir, { recursive: true });

  const sharp = (await import('sharp')).default;

  const filename = `${index}.${ext}`;
  const origPath = path.join(dir, filename);
  await sharp(buffer)
    .resize(1200, 1200, { fit: 'cover' })
    .toFile(origPath);

  const thumbFilename = `${index}-thumb.webp`;
  await sharp(buffer)
    .resize(320, 320, { fit: 'cover' })
    .webp({ quality: 80 })
    .toFile(path.join(dir, thumbFilename));

  const mediumFilename = `${index}-medium.webp`;
  await sharp(buffer)
    .resize(800, 800, { fit: 'cover' })
    .webp({ quality: 85 })
    .toFile(path.join(dir, mediumFilename));

  return {
    url: `/uploads/products/${productId}/${filename}`,
    thumbUrl: `/uploads/products/${productId}/${thumbFilename}`,
    mediumUrl: `/uploads/products/${productId}/${mediumFilename}`
  };
}
