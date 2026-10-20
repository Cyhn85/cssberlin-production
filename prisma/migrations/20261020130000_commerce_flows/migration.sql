-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_PICKUP';
ALTER TYPE "MessageType" ADD VALUE 'PERSONA_RELAY';

-- DropIndex
DROP INDEX "Review_orderId_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "city" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "notificationPrefs" JSONB,
ADD COLUMN     "offerMinPercent" INTEGER,
ADD COLUMN     "postalCode" TEXT;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "round" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledBy" TEXT,
ADD COLUMN     "cancelRequestedAt" TIMESTAMP(3),
ADD COLUMN     "cancelRequestReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "pickupDeadline" TIMESTAMP(3),
ADD COLUMN     "remindersSent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "shippingAddress" JSONB;

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "lastNotifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_userId_productId_key" ON "CartItem"("userId", "productId");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderId_authorId_key" ON "Review"("orderId", "authorId");

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill timeline stamps for orders that existed before these columns.
UPDATE "Order" SET "paidAt" = "createdAt" WHERE "status" IN ('PAID','SHIPPED','DELIVERED','COMPLETED','DISPUTED','REFUNDED') AND "paidAt" IS NULL;
UPDATE "Order" SET "shippedAt" = "updatedAt" WHERE "status" IN ('SHIPPED','DELIVERED','COMPLETED','DISPUTED') AND "shippedAt" IS NULL;
UPDATE "Order" SET "completedAt" = "updatedAt" WHERE "status" = 'COMPLETED' AND "completedAt" IS NULL;
-- Existing open offers get the standard 48 h answer window from now.
UPDATE "Offer" SET "expiresAt" = NOW() + INTERVAL '48 hours' WHERE "status" IN ('PENDING','ACCEPTED') AND "expiresAt" IS NULL;
-- Kontaktformular / DSA-Meldungen
-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "url" TEXT,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactRequest_status_createdAt_idx" ON "ContactRequest"("status", "createdAt");

