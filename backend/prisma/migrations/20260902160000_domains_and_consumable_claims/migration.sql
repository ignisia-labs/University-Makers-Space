-- Domains, consumable variants and depleting stock, and material claims.

CREATE TYPE "ConsumableClaimStatus" AS ENUM ('PENDING', 'ISSUED', 'REJECTED', 'CANCELLED');

-- A themed area of the MakerSpace, cutting across categories.
CREATE TABLE "domains" (
    "id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "image_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "domains_lab_id_name_key" ON "domains"("lab_id", "name");
CREATE INDEX "domains_lab_id_is_active_sort_order_idx" ON "domains"("lab_id", "is_active", "sort_order");
ALTER TABLE "domains" ADD CONSTRAINT "domains_lab_id_fkey"
  FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "equipment" ADD COLUMN "domain_id" UUID;
CREATE INDEX "equipment_lab_id_domain_id_visible_idx" ON "equipment"("lab_id", "domain_id", "visible");
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_domain_id_fkey"
  FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "consumables"
  ADD COLUMN "domain_id" UUID,
  ADD COLUMN "variants" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "max_per_project" INTEGER,
  ADD COLUMN "stock_quantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "low_stock_threshold" INTEGER;
CREATE INDEX "consumables_lab_id_domain_id_is_active_idx" ON "consumables"("lab_id", "domain_id", "is_active");
ALTER TABLE "consumables" ADD CONSTRAINT "consumables_domain_id_fkey"
  FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Stock is a count of things on a shelf; it cannot be negative, and a ceiling
-- of zero or less would mean "you may request none", which is not a ceiling.
ALTER TABLE "consumables"
  ADD CONSTRAINT "consumables_stock_quantity_chk" CHECK ("stock_quantity" >= 0),
  ADD CONSTRAINT "consumables_max_per_project_chk"
    CHECK ("max_per_project" IS NULL OR "max_per_project" > 0),
  ADD CONSTRAINT "consumables_low_stock_threshold_chk"
    CHECK ("low_stock_threshold" IS NULL OR "low_stock_threshold" >= 0);

ALTER TABLE "project_consumable_requirements" ADD COLUMN "variant" TEXT;

-- A team asking for material, and the desk's answer.
CREATE TABLE "consumable_claims" (
    "id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "consumable_id" UUID NOT NULL,
    "booking_id" UUID,
    "claimed_by_id" UUID NOT NULL,
    "decided_by_id" UUID,
    "quantity" INTEGER NOT NULL,
    "variant" TEXT,
    "status" "ConsumableClaimStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "decision_reason" TEXT,
    "idempotency_key" UUID NOT NULL,
    "consumable_name_snapshot" TEXT NOT NULL,
    "unit_snapshot" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "consumable_claims_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "consumable_claims_claimed_by_id_idempotency_key_key"
  ON "consumable_claims"("claimed_by_id", "idempotency_key");
CREATE INDEX "consumable_claims_lab_id_status_created_at_idx"
  ON "consumable_claims"("lab_id", "status", "created_at");
CREATE INDEX "consumable_claims_project_id_consumable_id_status_idx"
  ON "consumable_claims"("project_id", "consumable_id", "status");
CREATE INDEX "consumable_claims_booking_id_status_idx"
  ON "consumable_claims"("booking_id", "status");

ALTER TABLE "consumable_claims"
  ADD CONSTRAINT "consumable_claims_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "consumable_claims_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "consumable_claims_consumable_id_fkey" FOREIGN KEY ("consumable_id") REFERENCES "consumables"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "consumable_claims_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "consumable_claims_claimed_by_id_fkey" FOREIGN KEY ("claimed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "consumable_claims_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Claiming nothing is not a claim.
ALTER TABLE "consumable_claims"
  ADD CONSTRAINT "consumable_claims_quantity_chk" CHECK ("quantity" > 0);

-- A decided claim must record who decided it and when; a pending one must not
-- pretend to have been decided.
ALTER TABLE "consumable_claims"
  ADD CONSTRAINT "consumable_claims_decision_chk" CHECK (
    ("status" = 'PENDING' AND "decided_at" IS NULL AND "decided_by_id" IS NULL)
    OR ("status" <> 'PENDING' AND "decided_at" IS NOT NULL)
  );
