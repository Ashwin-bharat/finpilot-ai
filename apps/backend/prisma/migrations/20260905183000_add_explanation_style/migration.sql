-- CreateEnum
CREATE TYPE "ExplanationStyle" AS ENUM ('BEGINNER', 'ADVANCED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "explanation_style" "ExplanationStyle" NOT NULL DEFAULT 'BEGINNER';
