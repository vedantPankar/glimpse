/*
  Warnings:

  - Added the required column `updatedAt` to the `Carousel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Carousel" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'device';
