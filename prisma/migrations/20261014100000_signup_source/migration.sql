-- Where a customer came from (first-touch marketing attribution). Existing accounts stay null = unknown.
ALTER TABLE "producer" ADD COLUMN "signup_source" TEXT;
ALTER TABLE "producer" ADD COLUMN "signup_medium" TEXT;
ALTER TABLE "producer" ADD COLUMN "signup_campaign" TEXT;
