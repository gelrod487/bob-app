-- CreateTable
CREATE TABLE "agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producer" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "supabase_user_id" TEXT NOT NULL,
    "subscription_tier" TEXT NOT NULL DEFAULT 'individual',
    "subscription_status" TEXT NOT NULL DEFAULT 'inactive',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "producer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_info" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "policy_number" TEXT,
    "carrier" TEXT NOT NULL,
    "product_type" TEXT NOT NULL,
    "face_amount" DECIMAL(12,2),
    "monthly_premium" DECIMAL(10,2) NOT NULL,
    "issue_date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "lead_type" TEXT,
    "lead_vendor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_entry" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "owner_type" TEXT NOT NULL,
    "producer_id" TEXT,
    "agency_id" TEXT,
    "entry_type" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "entry_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reminder" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "months_after_issue" INTEGER NOT NULL,
    "reminder_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense" (
    "id" TEXT NOT NULL,
    "owner_type" TEXT NOT NULL,
    "producer_id" TEXT,
    "agency_id" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "vendor" TEXT,
    "quantity" INTEGER,
    "unit_cost" DECIMAL(10,2),
    "amount" DECIMAL(10,2) NOT NULL,
    "expense_date" DATE NOT NULL,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_draw" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "draw_date" DATE NOT NULL,
    "notes" TEXT,

    CONSTRAINT "owner_draw_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "producer_email_key" ON "producer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "producer_supabase_user_id_key" ON "producer"("supabase_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "producer_stripe_customer_id_key" ON "producer"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "producer_stripe_subscription_id_key" ON "producer"("stripe_subscription_id");

-- AddForeignKey
ALTER TABLE "producer" ADD CONSTRAINT "producer_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy" ADD CONSTRAINT "policy_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_entry" ADD CONSTRAINT "commission_entry_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_entry" ADD CONSTRAINT "commission_entry_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "producer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_entry" ADD CONSTRAINT "commission_entry_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminder" ADD CONSTRAINT "payment_reminder_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "producer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_draw" ADD CONSTRAINT "owner_draw_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
