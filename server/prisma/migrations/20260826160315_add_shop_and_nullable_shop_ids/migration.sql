-- CreateEnum
CREATE TYPE "ShopSubscriptionStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "shopId" TEXT;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "shopId" TEXT;

-- AlterTable
ALTER TABLE "Discount" ADD COLUMN     "shopId" TEXT;

-- AlterTable
ALTER TABLE "InventoryTransaction" ADD COLUMN     "shopId" TEXT;

-- AlterTable
ALTER TABLE "Modifier" ADD COLUMN     "shopId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shopId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "shopId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "shopId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "shopId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "shopId" TEXT;

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subscriptionStatus" "ShopSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedAt" TIMESTAMPTZ(3),
    "suspendedReason" TEXT,
    "nextOrderSequence" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_shopId_createdAt_idx" ON "AuditLog"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "Category_shopId_idx" ON "Category"("shopId");

-- CreateIndex
CREATE INDEX "Discount_shopId_idx" ON "Discount"("shopId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_shopId_createdAt_idx" ON "InventoryTransaction"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "Modifier_shopId_idx" ON "Modifier"("shopId");

-- CreateIndex
CREATE INDEX "Order_shopId_createdAt_idx" ON "Order"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_shopId_idx" ON "OrderItem"("shopId");

-- CreateIndex
CREATE INDEX "Payment_shopId_idx" ON "Payment"("shopId");

-- CreateIndex
CREATE INDEX "Product_shopId_idx" ON "Product"("shopId");

-- CreateIndex
CREATE INDEX "User_shopId_idx" ON "User"("shopId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Modifier" ADD CONSTRAINT "Modifier_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
