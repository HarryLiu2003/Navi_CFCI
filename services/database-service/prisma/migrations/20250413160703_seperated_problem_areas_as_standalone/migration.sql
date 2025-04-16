-- CreateTable
CREATE TABLE "problem_areas" (
    "id" TEXT NOT NULL,
    "interview_id" TEXT NOT NULL,
    "analysis_problem_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problem_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excerpts" (
    "id" TEXT NOT NULL,
    "problem_area_id" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "categories" TEXT[],
    "insight" TEXT NOT NULL,
    "chunk_number" INTEGER NOT NULL,

    CONSTRAINT "excerpts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "problem_areas_interview_id_idx" ON "problem_areas"("interview_id");

-- CreateIndex
CREATE INDEX "excerpts_problem_area_id_idx" ON "excerpts"("problem_area_id");

-- AddForeignKey
ALTER TABLE "problem_areas" ADD CONSTRAINT "problem_areas_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excerpts" ADD CONSTRAINT "excerpts_problem_area_id_fkey" FOREIGN KEY ("problem_area_id") REFERENCES "problem_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
