-- CreateTable
CREATE TABLE "suggestion" (
    "id" TEXT NOT NULL,
    "producer_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "suggestion" ADD CONSTRAINT "suggestion_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

