/*
  Warnings:

  - You are about to drop the column `personas` on the `interviews` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "interviews" DROP COLUMN "personas";

-- CreateTable
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_InterviewToPersona" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InterviewToPersona_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "personas_userId_name_key" ON "personas"("userId", "name");

-- CreateIndex
CREATE INDEX "_InterviewToPersona_B_index" ON "_InterviewToPersona"("B");

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InterviewToPersona" ADD CONSTRAINT "_InterviewToPersona_A_fkey" FOREIGN KEY ("A") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InterviewToPersona" ADD CONSTRAINT "_InterviewToPersona_B_fkey" FOREIGN KEY ("B") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
