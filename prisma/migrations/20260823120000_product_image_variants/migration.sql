-- AlterTable
-- Responsive image variants written by saveProductImage() (sharp).
-- Nullable on purpose: rows imported before this migration keep only `url`,
-- and ProductCard falls back to `url` when a variant is missing.
ALTER TABLE "ProductImage" ADD COLUMN IF NOT EXISTS "thumbUrl" TEXT;
ALTER TABLE "ProductImage" ADD COLUMN IF NOT EXISTS "mediumUrl" TEXT;
