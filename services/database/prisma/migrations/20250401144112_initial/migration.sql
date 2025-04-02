-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "problem_count" INTEGER NOT NULL,
    "transcript_length" INTEGER NOT NULL,
    "analysis_data" JSONB NOT NULL,
    "project_id" TEXT,
    "interviewer" TEXT,
    "interview_date" TIMESTAMP(3),

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);
