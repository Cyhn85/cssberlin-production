-- AlterTable
-- Checkout reservation window (see Product.reservedUntil in schema.prisma).
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "reservedUntil" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "reservedById" TEXT;

-- The cron sweep scans for expired reservations; without this it is a full
-- table scan every run.
CREATE INDEX IF NOT EXISTS "Product_reservedUntil_idx" ON "Product"("reservedUntil");
