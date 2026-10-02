-- AlterTable
ALTER TABLE "producer" ADD COLUMN     "admin_notes" TEXT,
ADD COLUMN     "is_comped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_seen_at" TIMESTAMP(3),
ADD COLUMN     "trial_ends_at_override" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "admin_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_producer_id" TEXT,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "audit_log_target_producer_id_idx" ON "audit_log"("target_producer_id");

