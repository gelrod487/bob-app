-- AlterTable
ALTER TABLE "expense" ADD COLUMN     "is_recurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurring_end_date" DATE;

