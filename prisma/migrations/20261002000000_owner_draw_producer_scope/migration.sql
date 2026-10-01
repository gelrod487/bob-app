-- DropForeignKey
ALTER TABLE "owner_draw" DROP CONSTRAINT "owner_draw_agency_id_fkey";

-- AlterTable
ALTER TABLE "owner_draw" ADD COLUMN     "producer_id" TEXT,
ALTER COLUMN "agency_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "owner_draw_producer_id_idx" ON "owner_draw"("producer_id");

-- AddForeignKey
ALTER TABLE "owner_draw" ADD CONSTRAINT "owner_draw_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_draw" ADD CONSTRAINT "owner_draw_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "producer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
