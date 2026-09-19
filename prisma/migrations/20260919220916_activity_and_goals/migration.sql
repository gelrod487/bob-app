-- CreateTable
CREATE TABLE "daily_activity" (
    "id" TEXT NOT NULL,
    "producer_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dials" INTEGER NOT NULL DEFAULT 0,
    "appointments" INTEGER NOT NULL DEFAULT 0,
    "presentations" INTEGER NOT NULL DEFAULT 0,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal" (
    "id" TEXT NOT NULL,
    "producer_id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "dials_target" INTEGER NOT NULL DEFAULT 0,
    "appointments_target" INTEGER NOT NULL DEFAULT 0,
    "sits_target" INTEGER NOT NULL DEFAULT 0,
    "sales_target" INTEGER NOT NULL DEFAULT 0,
    "fyc_target" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_activity_producer_id_date_key" ON "daily_activity"("producer_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "goal_producer_id_month_key" ON "goal"("producer_id", "month");

-- AddForeignKey
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal" ADD CONSTRAINT "goal_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
