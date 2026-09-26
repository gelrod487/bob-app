-- AlterTable
ALTER TABLE "producer" ADD COLUMN     "imo" TEXT;

-- CreateTable
CREATE TABLE "imo_commission_rate" (
    "id" TEXT NOT NULL,
    "imo_name" TEXT NOT NULL,
    "carrier_name" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "contract_level" INTEGER NOT NULL,
    "payout_rate" DECIMAL(6,3) NOT NULL,

    CONSTRAINT "imo_commission_rate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "imo_commission_rate_imo_name_carrier_name_product_name_cont_key" ON "imo_commission_rate"("imo_name", "carrier_name", "product_name", "contract_level");

