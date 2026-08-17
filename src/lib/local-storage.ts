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
): Promise<string> {
  const ext = extensionForMimeType(mimeType);
  if (!ext) {
    throw new Error(`Nicht unterstuetzter Bildtyp: ${mimeType}`);
  }

  const dir = path.join(UPLOAD_ROOT, 'products', productId);
  await mkdir(dir, { recursive: true });

  const filename = `${index}.${ext}`;
  await writeFile(path.join(dir, filename), buffer);

  return `${PUBLIC_BASE_URL}/uploads/products/${productId}/${filename}`;
}
