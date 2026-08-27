-- Rewrites the partial unique indexes from 20260818090525 and 20260820000000
-- to be scoped per-shop, now that Category/Modifier/Discount all carry a
-- required shopId. Without this, two different shops could never both have
-- an active category/modifier/discount named e.g. "Coffee" — a near-certain
-- real collision now that the app serves multiple shops. ProductVariant's
-- index is untouched: it's already correctly scoped via productId, a global
-- cuid, regardless of which shop owns the product.
DROP INDEX "Category_name_active_key";
DROP INDEX "Modifier_name_active_key";
DROP INDEX "Discount_name_active_key";

CREATE UNIQUE INDEX "Category_shopId_name_active_key" ON "Category"("shopId", "name") WHERE "isActive" = true;
CREATE UNIQUE INDEX "Modifier_shopId_name_active_key" ON "Modifier"("shopId", "name") WHERE "isActive" = true;
CREATE UNIQUE INDEX "Discount_shopId_name_active_key" ON "Discount"("shopId", "name") WHERE "isActive" = true;
