CREATE TABLE "academic_year_options" (
    "id" UUID NOT NULL,
    "value" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_year_options_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "academic_year_options_value_positive" CHECK ("value" > 0)
);

CREATE UNIQUE INDEX "academic_year_options_value_key" ON "academic_year_options"("value");
CREATE INDEX "academic_year_options_is_active_value_idx" ON "academic_year_options"("is_active", "value");
