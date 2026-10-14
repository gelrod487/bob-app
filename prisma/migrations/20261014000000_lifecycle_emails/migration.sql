-- Lifecycle emails (welcome + trial ending). Existing accounts are marked as already sent so the
-- new emails only ever go to people who sign up after this ships.
ALTER TABLE "producer" ADD COLUMN "welcome_email_sent_at" TIMESTAMP(3);
ALTER TABLE "producer" ADD COLUMN "trial_ending_email_sent_at" TIMESTAMP(3);
UPDATE "producer" SET "welcome_email_sent_at" = "created_at", "trial_ending_email_sent_at" = "created_at";
