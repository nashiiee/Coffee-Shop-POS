-- DropIndex
DROP INDEX "Order_sequenceNumber_key";

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Category" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Discount" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "InventoryTransaction" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Modifier" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "sequenceNumber" DROP DEFAULT,
ALTER COLUMN "shopId" SET NOT NULL;
DROP SEQUENCE "Order_sequenceNumber_seq";

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "shopId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "shopId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_shopId_sequenceNumber_key" ON "Order"("shopId", "sequenceNumber");
