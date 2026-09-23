-- CreateTable
CREATE TABLE "team_goal" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "issued_paid_target" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "new_writers_target" INTEGER NOT NULL DEFAULT 0,
    "headcount_target" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "team_goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_goal_agency_id_month_key" ON "team_goal"("agency_id", "month");

-- AddForeignKey
ALTER TABLE "team_goal" ADD CONSTRAINT "team_goal_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
