-- AlterTable
ALTER TABLE "producer" ADD COLUMN     "annuity_tier" TEXT;

-- CreateTable
CREATE TABLE "annuity_commission_rate" (
    "id" TEXT NOT NULL,
    "imo_name" TEXT NOT NULL,
    "carrier_name" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "payout_rate" DECIMAL(6,3) NOT NULL,

    CONSTRAINT "annuity_commission_rate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "annuity_commission_rate_imo_name_carrier_name_product_name__key" ON "annuity_commission_rate"("imo_name", "carrier_name", "product_name", "tier");

