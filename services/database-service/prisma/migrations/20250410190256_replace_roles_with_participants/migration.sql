/*
  Warnings:

  - You are about to drop the column `interviewee` on the `interviews` table. All the data in the column will be lost.
  - You are about to drop the column `interviewer` on the `interviews` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "interviews" DROP COLUMN "interviewee",
DROP COLUMN "interviewer",
ADD COLUMN     "participants" TEXT;
