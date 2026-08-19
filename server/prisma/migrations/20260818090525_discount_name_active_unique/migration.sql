-- Prisma's schema DSL has no syntax for a partial unique index, so this is
-- hand-written. `discount.service.ts`'s assertNameAvailable() already
-- checks name-uniqueness among active discounts at the application layer,
-- but that check-then-write has no atomicity guarantee — two concurrent
-- requests could both pass the check before either commits. This index
-- makes the invariant the code already documents (unique name among active
-- discounts) enforced by the database, not just by application logic.
CREATE UNIQUE INDEX "Discount_name_active_key" ON "Discount"("name") WHERE "isActive" = true;
