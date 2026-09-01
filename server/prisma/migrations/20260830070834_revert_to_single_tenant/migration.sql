-- Reverts the multi-tenant SaaS retrofit back to a single-shop POS. Every
-- shopId column, FK, and shop-scoped index is dropped; the Shop table and
-- ShopSubscriptionStatus enum are dropped entirely. Order.sequenceNumber
-- goes back to a plain globally-unique autoincrement (safe here because,
-- before running this, every shop except the one real shop was deleted via
-- delete-shop.ts, so no sequenceNumber collisions exist across the
-- remaining rows). The three hand-written partial unique indexes
-- (Category/Modifier/Discount name-uniqueness among active rows) are
-- rewritten back to their pre-shop-scoped form, undoing
-- 20260826174956_rewrite_name_unique_indexes_for_shop_scoping.

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_shopId_fkey";

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_shopId_fkey";

-- DropForeignKey
ALTER TABLE "Discount" DROP CONSTRAINT "Discount_shopId_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_shopId_fkey";

-- DropForeignKey
ALTER TABLE "Modifier" DROP CONSTRAINT "Modifier_shopId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_shopId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_shopId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_shopId_fkey";

-- DropIndex
DROP INDEX "AuditLog_shopId_createdAt_idx";

-- DropIndex
DROP INDEX "Category_shopId_idx";

-- DropIndex
DROP INDEX "Discount_shopId_idx";

-- DropIndex
DROP INDEX "Expense_shopId_idx";

-- DropIndex
DROP INDEX "InventoryTransaction_shopId_createdAt_idx";

-- DropIndex
DROP INDEX "Modifier_shopId_idx";

-- DropIndex
DROP INDEX "Order_shopId_createdAt_idx";

-- DropIndex
DROP INDEX "Order_shopId_sequenceNumber_key";

-- DropIndex
DROP INDEX "OrderItem_shopId_idx";

-- DropIndex
DROP INDEX "Payment_shopId_idx";

-- DropIndex
DROP INDEX "Product_shopId_idx";

-- DropIndex
DROP INDEX "User_shopId_idx";

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "shopId";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "shopId";

-- AlterTable
ALTER TABLE "Discount" DROP COLUMN "shopId";

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "shopId";

-- AlterTable
ALTER TABLE "InventoryTransaction" DROP COLUMN "shopId";

-- AlterTable
ALTER TABLE "Modifier" DROP COLUMN "shopId";

-- AlterTable
CREATE SEQUENCE order_sequencenumber_seq;
ALTER TABLE "Order" DROP COLUMN "shopId",
ALTER COLUMN "sequenceNumber" SET DEFAULT nextval('order_sequencenumber_seq');
ALTER SEQUENCE order_sequencenumber_seq OWNED BY "Order"."sequenceNumber";
-- Advance the sequence past the highest existing receipt number so the
-- next checkout doesn't collide with historical data.
SELECT setval('order_sequencenumber_seq', COALESCE((SELECT MAX("sequenceNumber") FROM "Order"), 0) + 1, false);

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "shopId";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "shopId";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "shopId";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "shopId";

-- DropTable
DROP TABLE "Shop";

-- DropEnum
DROP TYPE "ShopSubscriptionStatus";

-- CreateIndex
CREATE UNIQUE INDEX "Order_sequenceNumber_key" ON "Order"("sequenceNumber");

-- Revert the shop-scoped partial unique indexes back to their
-- pre-multi-tenant form. No explicit DROP INDEX needed here: each of these
-- indexes includes shopId as an indexed column, so Postgres already
-- auto-dropped them as a side effect of the "ALTER TABLE ... DROP COLUMN
-- shopId" statements above.
CREATE UNIQUE INDEX "Category_name_active_key" ON "Category"("name") WHERE "isActive" = true;
CREATE UNIQUE INDEX "Modifier_name_active_key" ON "Modifier"("name") WHERE "isActive" = true;
CREATE UNIQUE INDEX "Discount_name_active_key" ON "Discount"("name") WHERE "isActive" = true;
