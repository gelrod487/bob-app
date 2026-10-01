-- DropForeignKey
ALTER TABLE "commission_entry" DROP CONSTRAINT "commission_entry_policy_id_fkey";

-- AlterTable
ALTER TABLE "commission_entry" ALTER COLUMN "policy_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "commission_entry" ADD CONSTRAINT "commission_entry_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
