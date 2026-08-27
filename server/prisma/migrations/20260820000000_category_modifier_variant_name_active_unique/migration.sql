-- Prisma's schema DSL has no syntax for a partial unique index, so these are
-- hand-written, mirroring Discount_name_active_key (see
-- 20260818090525_discount_name_active_unique). category.service.ts,
-- modifier.service.ts, and product.service.ts's assertVariantNameAvailable()
-- already check name-uniqueness among active rows at the application layer,
-- but that check-then-write has no atomicity guarantee — two concurrent
-- requests could both pass the check before either commits. These indexes
-- make the invariant the code already documents (unique name among active
-- rows) enforced by the database, not just by application logic.
CREATE UNIQUE INDEX "Category_name_active_key" ON "Category"("name") WHERE "isActive" = true;
CREATE UNIQUE INDEX "Modifier_name_active_key" ON "Modifier"("name") WHERE "isActive" = true;
CREATE UNIQUE INDEX "ProductVariant_productId_name_active_key" ON "ProductVariant"("productId", "name") WHERE "isActive" = true;
