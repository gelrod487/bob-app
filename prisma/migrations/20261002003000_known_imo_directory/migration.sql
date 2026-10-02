-- CreateTable
CREATE TABLE "known_imo" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "known_imo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "known_imo_name_key" ON "known_imo"("name");

-- Seed a small starting directory of well-known IMOs/FMOs in the independent life
-- insurance space, so the typo-match check has real names to compare against before any
-- producer has typed one in. gen_random_uuid() matches how every other id column here
-- is generated (see Prisma's @default(uuid()) -> gen_random_uuid() mapping).
INSERT INTO "known_imo" ("id", "name") VALUES
  (gen_random_uuid(), 'Family First Life'),
  (gen_random_uuid(), 'Senior Life'),
  (gen_random_uuid(), 'Symmetry Financial Group'),
  (gen_random_uuid(), 'Quility'),
  (gen_random_uuid(), 'PHP Agency'),
  (gen_random_uuid(), 'Equis Financial'),
  (gen_random_uuid(), 'AmeriLife'),
  (gen_random_uuid(), 'Integrity Marketing Group'),
  (gen_random_uuid(), 'Senior Marketing Specialists'),
  (gen_random_uuid(), 'National Agents Alliance'),
  (gen_random_uuid(), 'Surex'),
  (gen_random_uuid(), 'American Senior Benefits')
ON CONFLICT ("name") DO NOTHING;
