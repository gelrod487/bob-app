-- AlterTable
ALTER TABLE "agency" ADD COLUMN "owner_id" TEXT;
ALTER TABLE "agency" ADD COLUMN "parent_agency_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "agency_owner_id_key" ON "agency"("owner_id");

-- AddForeignKey
ALTER TABLE "agency" ADD CONSTRAINT "agency_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "producer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency" ADD CONSTRAINT "agency_parent_agency_id_fkey" FOREIGN KEY ("parent_agency_id") REFERENCES "agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
