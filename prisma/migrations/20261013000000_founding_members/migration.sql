-- Founding Members: the first 75 testers get a locked-in discount. A number (1..75) marks a member.
ALTER TABLE "producer" ADD COLUMN "founding_number" INTEGER;
CREATE UNIQUE INDEX "producer_founding_number_key" ON "producer"("founding_number");
