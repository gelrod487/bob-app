-- CreateTable
CREATE TABLE "trial_use" (
    "email_hash" TEXT NOT NULL,
    "first_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trial_use_pkey" PRIMARY KEY ("email_hash")
);

-- Same protection as every other table: the public REST API must not be able to read or write it
-- (the app reaches it through the server's owner role, which bypasses row-level security).
ALTER TABLE "trial_use" ENABLE ROW LEVEL SECURITY;
